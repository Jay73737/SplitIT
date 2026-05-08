from __future__ import annotations

import sys
import os
from pathlib import Path
from typing import Iterable

import torch


ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def _alias_demucs_to_vendored() -> None:
    """The vendored _demucs/ package cross-references the upstream `demucs` name
    (e.g. `from demucs.states import capture_init`). Alias `demucs.X` →
    `_demucs.X` in sys.modules so those imports resolve to the vendored copy.
    Must run before any `from _demucs.X import ...` triggers the chain."""
    import importlib

    try:
        _demucs = importlib.import_module("_demucs")
    except ImportError:
        return
    sys.modules.setdefault("demucs", _demucs)
    # Inference-time submodules only. Training-only modules (repitch, wav, augment,
    # automix, solver, train, evaluate) are skipped - they have heavy side effects
    # at import time (eg repitch hardcodes a temp dir) and the inference path
    # doesn't need them.
    for submod in (
        "states", "utils", "transformer", "demucs", "hdemucs",
        "spec", "audio", "pretrained", "apply", "api",
    ):
        try:
            sys.modules.setdefault(
                f"demucs.{submod}",
                importlib.import_module(f"_demucs.{submod}"),
            )
        except Exception:  # noqa: BLE001 - swallow any side-effect crash
            pass


_alias_demucs_to_vendored()

from _demucs.api import Separator, save_audio  # noqa: E402 - must follow alias


def _normalize_instruments(instruments: Iterable[str]) -> list[str]:
    normalized = sorted({i.strip().lower() for i in instruments if i and i.strip()})
    return [i for i in normalized if i in {"vocals", "bass", "drums", "other", "guitar", "piano"}]


def _resolve_models(models: list[str], instruments: list[str], shifts: int, overlap: float, device: str):
    selected_models = list(models)
    guitar_separator = None

    if "combo" in selected_models:
        if "mdx_extra" not in selected_models:
            selected_models.insert(0, "mdx_extra")
        selected_models = [m for m in selected_models if m != "combo"]
        guitar_separator = Separator("htdemucs_6s", shifts=shifts, split=True, overlap=0.75, progress=False, device=device)
        if "other" not in instruments:
            instruments.append("other")

    separators = [
        Separator(model_name, shifts=shifts, split=True, overlap=overlap, progress=False, device=device)
        for model_name in selected_models
    ]
    return separators, guitar_separator


def split_audio_file(
    input_path: Path,
    output_root: Path,
    models: list[str],
    instruments: list[str],
    shifts: int = 1,
    overlap: float = 0.5,
    requested_device: str | None = None,
) -> Path:
    input_path = Path(input_path)
    output_root = Path(output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    device = requested_device or ("cuda:0" if torch.cuda.is_available() else "cpu")
    if str(device).startswith("cuda") and not torch.cuda.is_available():
        device = "cpu"

    selected_instruments = _normalize_instruments(instruments)
    if not selected_instruments:
        raise ValueError("No valid instruments were provided")

    selected_models = [m.strip() for m in models if m and m.strip()]
    if not selected_models:
        raise ValueError("No model was provided")

    separators, guitar_separator = _resolve_models(selected_models, selected_instruments, shifts, overlap, str(device))

    track_output_dir = output_root / input_path.stem
    track_output_dir.mkdir(parents=True, exist_ok=True)

    for separator in separators:
        _, stems = separator.separate_audio_file(input_path)

        for stem_name, stem_audio in stems.items():
            if stem_name not in selected_instruments:
                continue

            stem_path = track_output_dir / f"{stem_name}.wav"
            save_audio(stem_audio, stem_path, separator.samplerate, as_float=True)

            if stem_name == "other" and guitar_separator is not None:
                _, guitar_stems = guitar_separator.separate_audio_file(stem_path)
                save_audio(guitar_stems["guitar"], track_output_dir / "guitar.wav", guitar_separator.samplerate, as_float=True)
                save_audio(guitar_stems["other"], track_output_dir / "other.wav", guitar_separator.samplerate, as_float=True)

    produced = [p for p in track_output_dir.iterdir() if p.is_file() and p.suffix.lower() == ".wav"]
    if not produced:
        raise RuntimeError("Separation finished but no output stems were produced")

    return track_output_dir
