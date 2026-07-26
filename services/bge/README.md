# Ally BGE embedding service

Dedicated HTTP inference for `BAAI/bge-large-en-v1.5`. It returns normalized
1,024-dimensional vectors and applies the BGE query instruction only to query
inputs.

The root Compose stack builds this service automatically:

```bash
docker compose up --build -d
```

The local image uses the CPU-only PyTorch wheel and keeps model weights in the
host-mounted `.model-cache` directory, so later starts reuse the download.

For a standalone build:

```bash
docker build -t ally-bge services/bge
docker run --rm -p 8080:8080 \
  -e EMBEDDING_SERVICE_TOKEN=replace-me \
  -v "$PWD/services/bge/.model-cache:/models/huggingface" \
  ally-bge
```

For a self-contained production image, add `--build-arg BAKE_MODEL=true`.
