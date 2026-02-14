# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

import sys
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

# Collect hidden imports for Demucs and Torch
hidden_imports = collect_submodules('demucs') + collect_submodules('torchaudio') + [
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'engineio.async_drivers.threading',
]

# Collect data files
datas = [
    ('frontend', 'frontend'),
    ('ffmpeg.exe', '.'), 
]
datas += collect_data_files('demucs')
datas += collect_data_files('torchaudio')

a = Analysis(
    ['desktop_app.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='AudioExtractor',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True, # Set to False to hide console window, but keep True for debugging initially
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='AudioExtractor',
)
