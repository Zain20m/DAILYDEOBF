"""Regression tests for the Luraph v14 silent-loop watchdog."""
import subprocess
import sys
import unittest
from pathlib import Path

ENGINE_ROOT = Path(__file__).resolve().parent
if str(ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ENGINE_ROOT))

import harness  # noqa: E402
from obfuscators.luraph_v14_9.driver import patch_entries, patch_spin  # noqa: E402


SPIN_SNIPPET = "__SPIN.n=__SPIN.n+1;if __SPIN.n>=__SPIN.step then __SPIN.f()end;"


class V14SpinInstrumentationTests(unittest.TestCase):
    def test_repeat_and_while_dispatchers_are_instrumented(self):
        source = """\
local function repeatVm(ops, pc)
    repeat
        local op = ops[pc];
        if op == 1 then
            pc += 1;
        else
            break;
        end
    until false
end

local function whileVm(ops, pc)
    while true do
        local op = ops[pc];
        if op == 1 then
            pc += 1;
        else
            break;
        end
    end
end

local function ordinaryLoop(flag)
    while true do
        if flag then break end
    end
end
"""
        patched = patch_spin(source)

        self.assertEqual(
            patched.count(SPIN_SNIPPET),
            2,
            "both repeat/until-false and while-true VM dispatchers must be instrumented",
        )
        ordinary = patched.split("local function ordinaryLoop", 1)[1]
        self.assertNotIn(
            SPIN_SNIPPET,
            ordinary,
            "ordinary application loops must not be mistaken for VM dispatchers",
        )

    def test_repository_v14_9_sample_has_a_patched_vm_dispatcher(self):
        sample_path = ENGINE_ROOT / "samples" / "v14.9.txt"
        source = sample_path.read_text(encoding="latin-1")
        with_entry_hooks = patch_entries(source, str(sample_path))
        patched = patch_spin(with_entry_hooks)
        self.assertGreater(
            patched.count(SPIN_SNIPPET),
            0,
            "the bundled v14.9 sample must retain a recognized VM dispatcher after entry hooks",
        )

    def test_repeat_dispatcher_keeps_its_loop_form_and_body(self):
        source = """\
local function vm(ops, pc)
    repeat
        local opcode = ops[pc];
        if opcode then
            pc += 1;
        else
            break;
        end
    until false
end
"""
        patched = patch_spin(source)
        self.assertIn("repeat", patched)
        self.assertIn("until false", patched)
        self.assertIn("local opcode = ops[pc];" + SPIN_SNIPPET, patched)


class V14HarnessWatchdogTests(unittest.TestCase):
    def test_silent_process_timeout_is_classified_as_heartbeat_stall(self):
        with self.assertRaises(subprocess.TimeoutExpired) as caught:
            harness._communicate(
                [sys.executable, "-c", "import time; print('started', flush=True); time.sleep(2)"],
                timeout=5,
                stall=0.25,
            )
        error = caught.exception
        self.assertEqual(getattr(error, "reason", None), "heartbeat")
        self.assertIn(b"started", error.output or b"")

    def test_total_timeout_is_distinguished_from_heartbeat_stall(self):
        with self.assertRaises(subprocess.TimeoutExpired) as caught:
            harness._communicate(
                [sys.executable, "-c", "import time; print('started', flush=True); time.sleep(2)"],
                timeout=0.25,
                stall=None,
            )
        error = caught.exception
        self.assertEqual(getattr(error, "reason", None), "overall")
        self.assertIn(b"started", error.output or b"")

    def test_v14_default_stall_window_allows_long_vm_operations(self):
        self.assertGreaterEqual(harness.STALL, 60)
        self.assertLess(harness.STALL, 600)


if __name__ == "__main__":
    unittest.main()
