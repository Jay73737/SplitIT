"""Cross-platform build of the frozen SplitIT backend.

Runs on Windows, macOS, and Linux. Creates an isolated venv, installs the
appropriate torch flavor, runs PyInstaller against splitit-backend.spec, and
stages the resulting one-folder bundle into frontend/resources/backend/ where
electron-builder picks it up via extraResources.

Usage:
    python backend/build_backend.py --flavor cpu
    python backend/build_backend.py --flavor cuda     # win/linux only
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
STAGE_DIR = PROJECT_ROOT / "frontend" / "resources" / "backend"

TORCH_VERSION = "2.4.1"
TORCHAUDIO_VERSION = "2.4.1"
PYINSTALLER_VERSION = "6.10.0"

DEMUCS_RUNTIME_DEPS = [
    "einops",
    "julius",
    "lameenc",
    "openunmix",
    "pyyaml",
    "soundfile==0.12.1",
    "numpy==1.26.4",
    "tqdm",
]


def log(msg: str) -> None:
    print(f"==> {msg}", flush=True)


def run(cmd: list[str], **kwargs) -> None:
    print("  $ " + " ".join(str(c) for c in cmd), flush=True)
    subprocess.check_call(cmd, **kwargs)


def venv_python(venv_dir: Path) -> Path:
    if os.name == "nt":
        return venv_dir / "Scripts" / "python.exe"
    return venv_dir / "bin" / "python"


def make_venv(venv_dir: Path) -> Path:
    if venv_dir.exists():
        log(f"Removing existing venv at {venv_dir}")
        shutil.rmtree(venv_dir)
    log(f"Creating venv at {venv_dir}")
    run([sys.executable, "-m", "venv", str(venv_dir)])
    return venv_python(venv_dir)


def install_torch(py: Path, flavor: str) -> None:
    is_mac = platform.system() == "Darwin"
    if is_mac:
        log("Installing torch (default PyPI wheel; uses MPS on Apple Silicon)")
        run([str(py), "-m", "pip", "install",
             f"torch=={TORCH_VERSION}", f"torchaudio=={TORCHAUDIO_VERSION}"])
        return

    if flavor == "cuda":
        log("Installing torch (CUDA 12.1)")
        index = "https://download.pytorch.org/whl/cu121"
    else:
        log("Installing torch (CPU)")
        index = "https://download.pytorch.org/whl/cpu"
    run([str(py), "-m", "pip", "install",
         f"torch=={TORCH_VERSION}", f"torchaudio=={TORCHAUDIO_VERSION}",
         "--index-url", index])


def install_deps(py: Path) -> None:
    log("Installing backend web deps")
    run([str(py), "-m", "pip", "install", "-r",
         str(BACKEND_DIR / "requirements-web.txt")])
    log("Installing demucs runtime deps")
    run([str(py), "-m", "pip", "install", *DEMUCS_RUNTIME_DEPS])
    log("Installing PyInstaller")
    run([str(py), "-m", "pip", "install", f"pyinstaller=={PYINSTALLER_VERSION}"])


def freeze(py: Path) -> Path:
    dist = BACKEND_DIR / "dist"
    build = BACKEND_DIR / "build"
    if dist.exists():
        shutil.rmtree(dist)
    if build.exists():
        shutil.rmtree(build)

    log("Running PyInstaller")
    run([str(py), "-m", "PyInstaller", "splitit-backend.spec",
         "--noconfirm", "--clean"], cwd=BACKEND_DIR)

    frozen = dist / "splitit-backend"
    exe_name = "splitit-backend.exe" if os.name == "nt" else "splitit-backend"
    exe = frozen / exe_name
    if not exe.exists():
        raise SystemExit(f"Expected frozen exe not found at {exe}")
    return frozen


def smoke_test(frozen: Path) -> None:
    """Spawn the frozen exe and confirm it announces the ready handshake."""
    exe_name = "splitit-backend.exe" if os.name == "nt" else "splitit-backend"
    exe = frozen / exe_name
    log(f"Smoke-testing {exe}")

    proc = subprocess.Popen(
        [str(exe)],
        cwd=str(frozen),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    ready = threading.Event()
    stderr_buf: list[str] = []

    def watch_stdout() -> None:
        assert proc.stdout is not None
        for line in proc.stdout:
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            if msg.get("event") == "ready" and msg.get("port"):
                ready.set()
                return

    def watch_stderr() -> None:
        assert proc.stderr is not None
        for line in proc.stderr:
            stderr_buf.append(line)

    threading.Thread(target=watch_stdout, daemon=True).start()
    threading.Thread(target=watch_stderr, daemon=True).start()

    deadline = time.monotonic() + 90
    while time.monotonic() < deadline and not ready.is_set() and proc.poll() is None:
        time.sleep(0.1)

    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

    if not ready.is_set():
        sys.stderr.write("".join(stderr_buf[-200:]))
        raise SystemExit("Frozen backend did not announce readiness within 90s")
    log("Smoke test ok")


def stage(frozen: Path) -> None:
    log(f"Staging to {STAGE_DIR}")
    if STAGE_DIR.exists():
        shutil.rmtree(STAGE_DIR)
    STAGE_DIR.mkdir(parents=True)
    for entry in frozen.iterdir():
        target = STAGE_DIR / entry.name
        if entry.is_dir():
            shutil.copytree(entry, target)
        else:
            shutil.copy2(entry, target)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--flavor", choices=("cpu", "cuda"), default="cpu")
    parser.add_argument("--skip-venv", action="store_true",
                        help="reuse existing venv if present (faster reruns)")
    args = parser.parse_args()

    if args.flavor == "cuda" and platform.system() == "Darwin":
        raise SystemExit("CUDA flavor not supported on macOS")

    venv_dir = BACKEND_DIR / f"build-venv-{args.flavor}"
    if args.skip_venv and venv_dir.exists():
        py = venv_python(venv_dir)
    else:
        py = make_venv(venv_dir)
        run([str(py), "-m", "pip", "install", "--upgrade", "pip", "wheel", "setuptools"])
        install_torch(py, args.flavor)
        install_deps(py)

    frozen = freeze(py)
    smoke_test(frozen)
    stage(frozen)

    flavor_marker = STAGE_DIR / "flavor.json"
    flavor_marker.write_text(json.dumps({
        "flavor": args.flavor,
        "platform": platform.system().lower(),
        "arch": platform.machine().lower(),
    }))

    log("Done. Frontend can now run electron-builder.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
