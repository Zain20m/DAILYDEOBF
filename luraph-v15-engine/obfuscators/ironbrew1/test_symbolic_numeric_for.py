import unittest
from types import SimpleNamespace

from obfuscators.ironbrew1 import devirt


class SymbolicNumericForTests(unittest.TestCase):
    def test_symbolic_lin_step_is_preserved_as_a_fused_loop(self):
        values = iter((1, 5, devirt.Lin(0, object())))
        interp = SimpleNamespace(eval=lambda _node, _scope: next(values))
        st = {
            "type": "AstStatFor",
            "from": object(),
            "to": object(),
            "step": object(),
        }

        self.assertEqual(devirt.LiftInterp.fused_loop(interp, st, None), "for")

    def test_unknown_step_uses_a_runtime_sign_check(self):
        emitted = []
        conditions = []

        class FakeLifter:
            def __init__(self):
                self.lvreg = {}

            def fval(self, _expr):
                return devirt.NOFOLD

            def emit(self, statement):
                emitted.append(statement)

        def lv(key):
            return interp.L.lvreg.setdefault(key, len(interp.L.lvreg) + 1)

        interp = SimpleNamespace(
            L=FakeLifter(),
            dlog=False,
            _loop_locals=lambda _scope: [],
            _lv=lv,
            cond_true=lambda condition: conditions.append(condition) or True,
            exec_block=lambda _body, _scope: None,
        )
        st = {
            "type": "AstStatFor",
            "location": (0, 245),
            "var": {"location": "i"},
            "body": {"body": []},
        }

        with self.assertRaises(devirt.LoopSig):
            devirt.LiftInterp.loop_head(interp, st, devirt.Scope())

        self.assertEqual(len(conditions), 1)
        self.assertIsInstance(conditions[0], devirt.Bin)
        self.assertEqual(conditions[0].op, "Or")
        self.assertEqual(len(emitted), 1)
        self.assertIsInstance(emitted[0], devirt.Assign)
        self.assertEqual(emitted[0].value.op, "Add")


if __name__ == "__main__":
    unittest.main()
