# PyInstaller spec for the desktop app's bundled backend.
# Build with: pyinstaller desktop/backend.spec
#
# Produces a single-file executable that starts the FastAPI backend on
# 127.0.0.1 (see backend/run_server.py). The Electron shell (desktop/main.js)
# spawns this as a background process instead of requiring a separate
# Python/ffmpeg install.

import os

from PyInstaller.utils.hooks import collect_all

repo_root = os.path.abspath(os.path.join(SPECPATH, ".."))
frontend_dir = os.path.join(repo_root, "frontend")

datas = [(frontend_dir, "frontend")]
binaries = []
hiddenimports = []

# yt-dlp loads most of its site extractors dynamically, and imageio-ffmpeg
# ships its static ffmpeg binary as package data — both can be missed by
# PyInstaller's static import analysis, so pull everything in explicitly.
# collect_all() returns raw (source, dest) specs meant for Analysis(), not
# the processed TOC entries Analysis produces afterwards — these must go
# in *before* Analysis runs, not be appended to a.datas/a.binaries after.
for pkg in ("yt_dlp", "imageio_ffmpeg"):
    pkg_datas, pkg_binaries, pkg_hiddenimports = collect_all(pkg)
    datas += pkg_datas
    binaries += pkg_binaries
    hiddenimports += pkg_hiddenimports

a = Analysis(
    [os.path.join(repo_root, "backend", "run_server.py")],
    pathex=[os.path.join(repo_root, "backend")],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="utube-download-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
)
