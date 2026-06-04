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
    git \
    unzip \
    perl \
    && rm -rf /var/lib/apt/lists/*

# Install nikto from GitHub
RUN git clone --depth 1 https://github.com/sullo/nikto.git /opt/nikto \
    && ln -s /opt/nikto/program/nikto.pl /usr/local/bin/nikto \
    && chmod +x /usr/local/bin/nikto

# Install Go-based security tools (nuclei, subfinder, httpx)
RUN ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "arm64" ]; then GOARCH="arm64"; else GOARCH="amd64"; fi && \
    # nuclei
    curl -sL "https://github.com/projectdiscovery/nuclei/releases/latest/download/nuclei_linux_${GOARCH}.zip" -o /tmp/nuclei.zip && \
    unzip -o /tmp/nuclei.zip -d /tmp && mv /tmp/nuclei /usr/local/bin/nuclei && chmod +x /usr/local/bin/nuclei && rm /tmp/nuclei.zip && \
    # subfinder
    curl -sL "https://github.com/projectdiscovery/subfinder/releases/latest/download/subfinder_linux_${GOARCH}.zip" -o /tmp/subfinder.zip && \
    unzip -o /tmp/subfinder.zip -d /tmp && mv /tmp/subfinder /usr/local/bin/subfinder && chmod +x /usr/local/bin/subfinder && rm /tmp/subfinder.zip && \
    # httpx
    curl -sL "https://github.com/projectdiscovery/httpx/releases/latest/download/httpx_linux_${GOARCH}.zip" -o /tmp/httpx.zip && \
    unzip -o /tmp/httpx.zip -d /tmp && mv /tmp/httpx /usr/local/bin/httpx && chmod +x /usr/local/bin/httpx && rm /tmp/httpx.zip

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
