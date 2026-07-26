FROM python:3.11-slim

ARG BGE_MODEL_ID=BAAI/bge-large-en-v1.5
ARG TORCH_VERSION=2.7.1
ARG BAKE_MODEL=false
ENV BGE_MODEL_ID=${BGE_MODEL_ID} \
    HF_HOME=/models/huggingface \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /service

COPY requirements.txt .
RUN pip install --no-cache-dir \
      --index-url https://download.pytorch.org/whl/cpu \
      "torch==${TORCH_VERSION}" \
    && pip install --no-cache-dir -r requirements.txt

RUN if [ "${BAKE_MODEL}" = "true" ]; then \
      python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('${BGE_MODEL_ID}')"; \
    fi

COPY app ./app

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=600s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health/ready', timeout=4)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--no-access-log"]
