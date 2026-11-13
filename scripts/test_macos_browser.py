"""Exercise insertion only in a disposable Chrome profile and synthetic local page."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

root = Path(__file__).resolve().parent.parent
chrome = Path('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
if not chrome.exists(): raise SystemExit('Google Chrome is unavailable')
env = {**os.environ, 'DEVELOPER_DIR':'/Applications/Xcode.app/Contents/Developer'}
with tempfile.TemporaryDirectory(prefix='ripple-browser-test-') as directory:
    tmp = Path(directory)
    html = tmp/'fixture.html'
    html.write_text('''<!doctype html><title>Temporary dictation test</title><textarea id="field">before after</textarea><script>const f=document.getElementById('field');f.focus();f.setSelectionRange(7,7);</script>''')
    binary = tmp/'probe'
    subprocess.run(['xcrun','swiftc',str(root/'native/macos/FocusedTarget.swift'),str(root/'test/native/browser/main.swift'),'-o',str(binary)],env=env,check=True)
    child = subprocess.Popen([str(chrome),'--user-data-dir='+str(tmp/'profile'),'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-sync','--disable-extensions','--force-renderer-accessibility','--new-window',html.as_uri()],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        time.sleep(7)
        result = subprocess.run([str(binary),str(child.pid)],timeout=20)
        if result.returncode: sys.exit(result.returncode)
    finally:
        if child.poll() is None:
            child.terminate()
            try: child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
