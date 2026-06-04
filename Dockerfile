# ═══════════════════════════════════════════════════════════════════════════
# Strix Pro - Multi-stage Dockerfile
# ═══════════════════════════════════════════════════════════════════════════

# ── Stage 1: Builder ──────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Install system dependencies needed for building wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    libxml2-dev \
    libxslt1-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Runtime ──────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

LABEL maintainer="Strix Pro Team"
LABEL description="Strix Pro - AI-Powered Security Platform"

# Runtime system deps (nmap for port scanning, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    nmap \
    whois \
    dnsutils \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

WORKDIR /app

# Copy application code
COPY src/ ./src/
COPY cli.py .
COPY setup.py .
COPY .env.example ./.env.example

# Create non-root user
RUN groupadd -r strix && useradd -r -g strix -d /app -s /sbin/nologin strix \
    && mkdir -p /app/reports /app/data/reports /home/strix/.strix \
    && chown -R strix:strix /app /home/strix/.strix

USER strix

# Expose API port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default: start the API server
CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
