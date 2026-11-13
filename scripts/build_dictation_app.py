"""Build a local development .app without changing the selected system toolchain."""
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parent.parent
app = root / 'dist' / 'Ripple.app'
macos = app / 'Contents' / 'MacOS'
macos.mkdir(parents=True, exist_ok=True)
node = os.environ.get('npm_node_execpath') or shutil.which('node')
if not node or not Path(node).is_file():
    raise SystemExit('A working Node executable is required; use the project nvm Node.')
info = {
    'CFBundleIdentifier':'com.ripple.app',
    'CFBundleName':'Ripple',
    'CFBundleDisplayName':'Ripple',
    'CFBundleVersion':'1',
    'CFBundleShortVersionString':'0.1.0',
    'CFBundlePackageType':'APPL',
    'CFBundleExecutable':'Ripple',
    'LSUIElement':True,
    'LSMinimumSystemVersion':'14.0',
    'NSMicrophoneUsageDescription':'Record speech while you hold the dictation shortcut.',
    'RippleProjectRoot':str(root),
    'RippleNodePath':str(Path(node).resolve()),
}
with (app/'Contents'/'Info.plist').open('wb') as f: plistlib.dump(info,f)
env={**os.environ,'DEVELOPER_DIR':'/Applications/Xcode.app/Contents/Developer'}
subprocess.run(['xcrun','swiftc','-target','arm64-apple-macos14.0','-module-cache-path','/tmp/swift-module-cache',str(root/'native/macos/FocusedTarget.swift'),str(root/'native/macos/dictation/HubWindow.swift'),str(root/'native/macos/dictation/DropletView.swift'),str(root/'native/macos/dictation/main.swift'),'-o',str(macos/'Ripple')],check=True,env=env)
subprocess.run(['/usr/bin/codesign','--force','--sign','-',str(app)],check=True)
print('Built local development app:',app)
