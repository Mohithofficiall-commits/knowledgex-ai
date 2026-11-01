# ── Stage 1: Build & Dependencies ────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ── Stage 2: Production Runtime ───────────────────────────────────────
FROM python:3.12-slim AS runner

WORKDIR /app

# Create non-root system user
RUN groupadd -r knowledgex && useradd -r -g knowledgex -m knowledgex

COPY --from=builder /root/.local /home/knowledgex/.local
ENV PATH=/home/knowledgex/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

COPY . /app
RUN mkdir -p /app/data /app/storage/documents && \
    chown -R knowledgex:knowledgex /app

USER knowledgex

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
