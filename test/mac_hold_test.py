import importlib.util
import pathlib
import unittest

module_path = pathlib.Path(__file__).resolve().parents[1] / 'scripts' / 'voice' / 'record.py'
spec = importlib.util.spec_from_file_location('voice_record', module_path)
record = importlib.util.module_from_spec(spec)
spec.loader.exec_module(record)

class HoldStateTest(unittest.TestCase):
    def test_press_both_and_release_either(self):
        for first, second in [(record.CONTROL, record.OPTION), (record.OPTION, record.CONTROL)]:
            state = record.HoldState()
            self.assertIsNone(state.update(first))
            self.assertEqual(state.update(first | second), 'start')
            self.assertIsNone(state.update(first | second))
            self.assertEqual(state.update(first), 'stop')
            self.assertIsNone(state.update(0))
            self.assertIsNone(state.update(first | second))

    def test_waits_until_initial_modifiers_released_and_ignores_shift(self):
        state = record.HoldState(record.CONTROL | record.OPTION)
        self.assertIsNone(state.update(record.CONTROL | record.OPTION))
        self.assertIsNone(state.update(record.CONTROL))
        self.assertIsNone(state.update(0))
        self.assertIsNone(state.update(record.CONTROL | record.OPTION | record.q.kCGEventFlagMaskShift))
        self.assertEqual(state.update(record.CONTROL | record.OPTION), 'start')
        self.assertEqual(state.update(record.OPTION), 'stop')

if __name__ == '__main__':
    unittest.main()
