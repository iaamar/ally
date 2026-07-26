"""Model-independent request preparation for the BGE embedding service."""

from __future__ import annotations

QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "
MAX_INPUTS = 32
MAX_CHARACTERS = 16_000


def prepare_inputs(inputs: list[str], kind: str) -> list[str]:
    if not inputs:
        raise ValueError("At least one input is required.")
    if len(inputs) > MAX_INPUTS:
        raise ValueError(f"At most {MAX_INPUTS} inputs are allowed per request.")
    if kind not in {"query", "passage"}:
        raise ValueError('kind must be either "query" or "passage".')

    prepared: list[str] = []
    for value in inputs:
        text = value.strip()
        if not text:
            raise ValueError("Inputs cannot be empty.")
        if len(text) > MAX_CHARACTERS:
            raise ValueError(
                f"Each input must be at most {MAX_CHARACTERS} characters."
            )
        prepared.append(
            f"{QUERY_INSTRUCTION}{text}" if kind == "query" else text
        )
    return prepared
