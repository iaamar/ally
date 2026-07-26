"""HTTP service for BAAI/bge-large-en-v1.5 query and passage embeddings."""

from __future__ import annotations

import asyncio
import os
import threading
import time
from collections import OrderedDict
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

from .core import prepare_inputs

MODEL_ID = os.getenv("BGE_MODEL_ID", "BAAI/bge-large-en-v1.5")
DEVICE = os.getenv("BGE_DEVICE", "cpu")
BATCH_SIZE = int(os.getenv("BGE_BATCH_SIZE", "16"))
MAX_CONCURRENCY = int(os.getenv("BGE_MAX_CONCURRENCY", "2"))
CACHE_SIZE = int(os.getenv("BGE_CACHE_SIZE", "2048"))
SERVICE_TOKEN = os.getenv("EMBEDDING_SERVICE_TOKEN", "").strip()
WARMUP_ENABLED = os.getenv("BGE_WARMUP", "true").lower() not in {
    "0",
    "false",
    "no",
}


class EmbeddingRequest(BaseModel):
    input: str | list[str]
    kind: Literal["query", "passage"] = "query"


class EmbeddingResponse(BaseModel):
    model: str
    dimensions: int
    embeddings: list[list[float]]
    duration_ms: int = Field(ge=0)


class ModelRuntime:
    def __init__(self) -> None:
        self.model: SentenceTransformer | None = None
        self.loaded_at: float | None = None
        self.semaphore = asyncio.Semaphore(max(1, MAX_CONCURRENCY))
        self.cache: OrderedDict[str, list[float]] = OrderedDict()
        self.cache_lock = threading.Lock()

    def load(self) -> None:
        self.model = SentenceTransformer(MODEL_ID, device=DEVICE)
        if WARMUP_ENABLED:
            self.encode(
                prepare_inputs(
                    ["WCAG accessibility guidance"],
                    "query",
                )
            )
        self.loaded_at = time.time()

    def encode(self, values: list[str]) -> list[list[float]]:
        if self.model is None:
            raise RuntimeError("Embedding model is not ready.")

        resolved: dict[str, list[float]] = {}
        with self.cache_lock:
            for value in values:
                cached = self.cache.get(value)
                if cached is not None:
                    self.cache.move_to_end(value)
                    resolved[value] = cached

        missing = list(dict.fromkeys(value for value in values if value not in resolved))
        if missing:
            encoded = self.model.encode(
                missing,
                batch_size=BATCH_SIZE,
                normalize_embeddings=True,
                convert_to_numpy=True,
                show_progress_bar=False,
            ).tolist()
            with self.cache_lock:
                for value, vector in zip(missing, encoded, strict=True):
                    resolved[value] = vector
                    if CACHE_SIZE > 0:
                        self.cache[value] = vector
                        self.cache.move_to_end(value)
                while len(self.cache) > max(0, CACHE_SIZE):
                    self.cache.popitem(last=False)

        return [resolved[value] for value in values]


runtime = ModelRuntime()


def authorize(authorization: str | None = Header(default=None)) -> None:
    if not SERVICE_TOKEN:
        return
    if authorization != f"Bearer {SERVICE_TOKEN}":
        raise HTTPException(status_code=401, detail="Invalid service token.")


@asynccontextmanager
async def lifespan(_: FastAPI):
    await run_in_threadpool(runtime.load)
    yield


app = FastAPI(
    title="Ally BGE Embeddings",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health/live")
def live() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
def ready() -> dict[str, str | float]:
    if runtime.model is None or runtime.loaded_at is None:
        raise HTTPException(status_code=503, detail="Model is loading.")
    return {
        "status": "ready",
        "model": MODEL_ID,
        "loaded_at": runtime.loaded_at,
    }


@app.post(
    "/v1/embeddings",
    response_model=EmbeddingResponse,
    dependencies=[Depends(authorize)],
)
async def embeddings(body: EmbeddingRequest, request: Request) -> EmbeddingResponse:
    values = [body.input] if isinstance(body.input, str) else body.input
    try:
        prepared = prepare_inputs(values, body.kind)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    started = time.perf_counter()
    async with runtime.semaphore:
        if await request.is_disconnected():
            raise HTTPException(status_code=499, detail="Client disconnected.")
        vectors = await run_in_threadpool(runtime.encode, prepared)

    dimensions = len(vectors[0]) if vectors else 0
    if dimensions != 1024:
        raise HTTPException(
            status_code=500,
            detail=f"Model returned {dimensions} dimensions; expected 1024.",
        )
    return EmbeddingResponse(
        model=MODEL_ID,
        dimensions=dimensions,
        embeddings=vectors,
        duration_ms=round((time.perf_counter() - started) * 1000),
    )
