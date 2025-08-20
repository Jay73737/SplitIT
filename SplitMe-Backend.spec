# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[('src', 'src'), ('api', 'api'), ('assets', 'assets'), ('config', 'config')],
    hiddenimports=['torch', 'torchaudio', 'demucs', 'PyQt6', 'PyQt6.QtMultimedia', 'googleapiclient', 'googleapiclient.discovery', 'google.auth', 'google_auth_httplib2', 'yt_dlp'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='SplitMe-Backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
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
    upx=True,
    upx_exclude=[],
    name='SplitMe-Backend',
)
app = BUNDLE(
    coll,
    name='SplitMe-Backend.app',
    icon=None,
    bundle_identifier=None,
)
