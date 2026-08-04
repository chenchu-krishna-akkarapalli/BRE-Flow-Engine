# ==========================================
# STAGE 1: Builder Stage
# ==========================================
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build-essential dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency specifications
COPY requirements.txt .

# openbharatocr declares easyocr, which declares torch. Nothing in the PAN or
# Aadhaar path calls it, but pip installs it regardless — and on Linux the
# default PyPI torch wheel bundles the CUDA runtime and triton, over a gigabyte
# of GPU tooling. Installing the CPU build from PyTorch's own index FIRST
# satisfies the requirement, so the pass below resolves torch as already-present
# and never reaches for the CUDA wheel. Kept out of requirements.txt on purpose:
# that file also drives local installs, where the default is already CPU-only.
RUN pip install --no-cache-dir --user \
    --index-url https://download.pytorch.org/whl/cpu \
    torch torchvision

# Install python dependencies to a temporary wheels directory
RUN pip install --no-cache-dir --user -r requirements.txt

# ==========================================
# STAGE 2: Runner Stage
# ==========================================
FROM python:3.11-slim AS runner

WORKDIR /app

# tesseract-ocr is the OCR engine openbharatocr shells out to and is not a pip
# package; libgl1 + libglib2.0-0 are what its OpenCV dependency links against.
# Omit either and uploads fall back to simulated extraction with no error.
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root system group and user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/bash -m appuser

# Copy installed packages from builder stage
COPY --from=builder /root/.local /home/appuser/.local

# Ensure path includes user installed packages
ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Copy application source code
COPY --chown=appuser:appgroup . .

# Set working permissions for non-root user
USER appuser

EXPOSE 8000

# Container liveness probe using Python built-in urllib (no curl package needed in slim image)
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health')" || exit 1

# Start ASGI application using Gunicorn + Uvicorn workers
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "--timeout", "30"]
