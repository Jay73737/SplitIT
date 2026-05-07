# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the SplitIT backend.

Builds a one-folder bundle at backend/dist/splitit-backend/.
Run via: pyinstaller backend/splitit-backend.spec --noconfirm
"""

from pathlib import Path
from PyInstaller.utils.hooks import collect_all, collect_data_files

SPEC_DIR = Path(SPECPATH).resolve()
PROJECT_ROOT = SPEC_DIR.parent

datas = []
binaries = []
hiddenimports = []

for pkg in ("torch", "torchaudio", "_demucs"):
    pkg_datas, pkg_binaries, pkg_hidden = collect_all(pkg)
    datas += pkg_datas
    binaries += pkg_binaries
    hiddenimports += pkg_hidden

datas += collect_data_files("_demucs", includes=["remote/*.yaml", "remote/*.txt"])

hiddenimports += [
    "uvicorn.logging",
    "uvicorn.loops.auto",
    "uvicorn.loops.asyncio",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.protocols.websockets.websockets_impl",
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
    "h11",
    "anyio._backends._asyncio",
    "soundfile",
    "_soundfile_data",
    "app",
    "split_service",
]

excludes = [
    "matplotlib",
    "tensorboard",
    "tensorboardX",
    "jupyter",
    "IPython",
    "notebook",
    "pytest",
]

a = Analysis(
    [str(SPEC_DIR / "server.py")],
    pathex=[str(PROJECT_ROOT), str(SPEC_DIR)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="splitit-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="splitit-backend",
)
