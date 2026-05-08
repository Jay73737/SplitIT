from __future__ import annotations

import json
import os
import socket
import sys
import threading
from pathlib import Path


def _frozen_data_root() -> Path:
    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    return base / "SplitIT" / "data"


def _pick_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


_DEMUCS_SUBMODULES = (
    "states", "utils", "transformer", "demucs", "hdemucs",
    "spec", "audio", "repitch", "pretrained", "wav", "apply", "api",
)


def _alias_demucs_to_vendored() -> None:
    """The vendored _demucs/ package has cross-references like
    `from demucs.states import capture_init` (referencing the upstream package
    name, not the vendored one). Rather than rewrite the vendored source or
    pip-install upstream demucs alongside, alias the import name at runtime."""
    import importlib

    try:
        _demucs = importlib.import_module("_demucs")
    except ImportError as exc:
        sys.stderr.write(f"[alias] could not import _demucs: {exc}\n")
        return
    sys.modules["demucs"] = _demucs
    for submod in _DEMUCS_SUBMODULES:
        try:
            mod = importlib.import_module(f"_demucs.{submod}")
        except Exception as exc:  # noqa: BLE001 - surface the real error
            sys.stderr.write(f"[alias] _demucs.{submod} failed: {exc!r}\n")
            continue
        sys.modules[f"demucs.{submod}"] = mod


def main() -> None:
    is_frozen = getattr(sys, "frozen", False)

    if is_frozen:
        os.environ.setdefault("SPLITIT_DATA_DIR", str(_frozen_data_root()))

    backend_dir = Path(__file__).resolve().parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    project_root = backend_dir.parent
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    _alias_demucs_to_vendored()

    import uvicorn
    from app import app

    port = int(os.environ.get("SPLITIT_PORT") or _pick_free_port())
    host = os.environ.get("SPLITIT_HOST", "127.0.0.1")

    config = uvicorn.Config(app, host=host, port=port, log_level="warning", access_log=False)
    server = uvicorn.Server(config)

    def _announce_when_ready() -> None:
        while not server.started:
            if server.should_exit:
                return
            threading.Event().wait(0.05)
        sys.stdout.write(json.dumps({"event": "ready", "host": host, "port": port}) + "\n")
        sys.stdout.flush()

    threading.Thread(target=_announce_when_ready, daemon=True).start()
    server.run()


if __name__ == "__main__":
    main()
