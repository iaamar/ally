import unittest

from app.core import MAX_INPUTS, QUERY_INSTRUCTION, prepare_inputs


class PrepareInputsTest(unittest.TestCase):
    def test_prefixes_queries_only(self):
        self.assertEqual(
            prepare_inputs(["keyboard traps"], "query"),
            [f"{QUERY_INSTRUCTION}keyboard traps"],
        )
        self.assertEqual(
            prepare_inputs(["keyboard traps"], "passage"),
            ["keyboard traps"],
        )

    def test_rejects_empty_and_oversized_batches(self):
        with self.assertRaises(ValueError):
            prepare_inputs([], "query")
        with self.assertRaises(ValueError):
            prepare_inputs(["x"] * (MAX_INPUTS + 1), "query")

    def test_trims_inputs(self):
        self.assertEqual(
            prepare_inputs(["  contrast ratio  "], "query"),
            [f"{QUERY_INSTRUCTION}contrast ratio"],
        )


if __name__ == "__main__":
    unittest.main()
