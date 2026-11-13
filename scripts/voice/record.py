"""Record while Control and Option are held. Only modifier events are observed."""
import sys
import threading
import time
import wave
import Quartz as q
import sounddevice as sd

RATE = 16000
LIMIT_SECONDS = 45
MIN_SECONDS = 0.25
CONTROL = q.kCGEventFlagMaskControl
OPTION = q.kCGEventFlagMaskAlternate
BLOCKING = q.kCGEventFlagMaskCommand | q.kCGEventFlagMaskShift


class HoldState:
    """Require both modifiers to be released before accepting a new hold."""
    def __init__(self, initial_flags=0):
        self.armed = not bool(initial_flags & (CONTROL | OPTION))
        self.recording = False
        self.consumed = False

    def update(self, flags):
        control = bool(flags & CONTROL)
        option = bool(flags & OPTION)
        if self.recording and not (control and option):
            self.recording = False
            return "stop"
        if not control and not option:
            self.armed = True
        if not self.consumed and self.armed and control and option and not flags & BLOCKING:
            self.armed = False
            self.consumed = True
            self.recording = True
            return "start"
        return None


def main(path):
    if not q.CGPreflightListenEventAccess():
        q.CGRequestListenEventAccess()
        print("Enable Input Monitoring for the Python or terminal host in macOS Privacy & Security, then restart voice mode.", file=sys.stderr, flush=True)
        return 3

    flags = q.CGEventSourceFlagsState(q.kCGEventSourceStateCombinedSessionState)
    state = HoldState(flags)
    stopped = threading.Event()
    interrupted = threading.Event()
    finished = threading.Event()
    loop = q.CFRunLoopGetCurrent()
    result = {"code": 1}
    tap_ref = {"tap": None}

    def record():
        frames = []
        frame_count = 0
        remaining = RATE * LIMIT_SECONDS
        started = time.monotonic()

        def capture(indata, count, _time_info, _status):
            nonlocal remaining, frame_count
            if stopped.is_set() or remaining <= 0:
                raise sd.CallbackStop
            take = min(count, remaining)
            frames.append(bytes(indata[:take * 2]))
            frame_count += take
            remaining -= take

        try:
            if not stopped.is_set():
                with sd.RawInputStream(samplerate=RATE, channels=1, dtype="int16", callback=capture):
                    print("Recording. Release Control or Option to finish.", flush=True)
                    stopped.wait(LIMIT_SECONDS)
            if interrupted.is_set():
                print("Modifier monitoring was interrupted; please try again.", flush=True)
                result["code"] = 4
            elif frame_count < RATE * MIN_SECONDS:
                print("Hold the keys a little longer to record a question.", flush=True)
                result["code"] = 4
            else:
                with wave.open(path, "wb") as output:
                    output.setnchannels(1)
                    output.setsampwidth(2)
                    output.setframerate(RATE)
                    output.writeframes(b"".join(frames))
                if time.monotonic() - started >= LIMIT_SECONDS:
                    print("Recording stopped at the 45-second limit.", flush=True)
                result["code"] = 0
        except Exception:
            print("Recording failed. Check microphone permissions and the selected input device.", file=sys.stderr, flush=True)
        finally:
            finished.set()
            q.CFRunLoopStop(loop)

    def on_event(_proxy, event_type, event, _refcon):
        if event_type in (q.kCGEventTapDisabledByTimeout, q.kCGEventTapDisabledByUserInput):
            # Events may have been missed; discard a potentially incomplete hold.
            if state.recording:
                interrupted.set()
                stopped.set()
            else:
                q.CGEventTapEnable(tap_ref["tap"], True)
            return event
        action = state.update(q.CGEventGetFlags(event))
        if action == "start":
            threading.Thread(target=record, daemon=True).start()
        elif action == "stop":
            stopped.set()
        return event

    tap = q.CGEventTapCreate(q.kCGSessionEventTap, q.kCGHeadInsertEventTap,
                             q.kCGEventTapOptionListenOnly,
                             q.CGEventMaskBit(q.kCGEventFlagsChanged), on_event, None)
    if tap is None:
        print("Could not monitor modifier keys. Check Input Monitoring permission and restart voice mode.", file=sys.stderr, flush=True)
        return 3
    tap_ref["tap"] = tap
    source = q.CFMachPortCreateRunLoopSource(None, tap, 0)
    q.CFRunLoopAddSource(loop, source, q.kCFRunLoopCommonModes)
    q.CGEventTapEnable(tap, True)
    print("Hold Control + Option to speak; release either key to finish. Ctrl-C exits.", flush=True)
    q.CFRunLoopRun()
    q.CGEventTapEnable(tap, False)
    if not finished.is_set():
        return 1
    return result["code"]


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
