"""Build and exercise the focus guard against a disposable AppKit test window."""
import os
from pathlib import Path
import select
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parent.parent
env = {**os.environ, "DEVELOPER_DIR": "/Applications/Xcode.app/Contents/Developer"}
with tempfile.TemporaryDirectory(prefix="ripple-focus-test-") as directory:
    fixture = Path(directory) / "fixture"
    probe = Path(directory) / "probe"
    subprocess.run(["xcrun", "swiftc", str(root / "test/native/Fixture.swift"), "-o", str(fixture)], env=env, check=True)
    subprocess.run(["xcrun", "swiftc", str(root / "native/macos/FocusedTarget.swift"), str(root / "test/native/main.swift"), "-o", str(probe)], env=env, check=True)
    child = subprocess.Popen([str(fixture)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    try:
        ready, _, _ = select.select([child.stdout], [], [], 15)
        if not ready or child.stdout.readline().strip() != "READY":
            raise RuntimeError("Synthetic test window did not start")
        result = subprocess.run([str(probe), str(child.pid)], timeout=15)
        if result.returncode:
            sys.exit(result.returncode)
    finally:
        child.terminate()
        try: child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait()
