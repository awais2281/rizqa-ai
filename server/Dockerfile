FROM python:3.11-slim

WORKDIR /app

# Install system dependencies and clean up in same layer to reduce size
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy requirements first (for better caching)
COPY requirements.txt .

# Install Python dependencies with optimizations
# CRITICAL: Install NumPy < 2.0 FIRST before anything else to prevent conflicts
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir "numpy<2.0" && \
    pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.1.0+cpu torchaudio==2.1.0+cpu && \
    pip install --no-cache-dir fastapi==0.104.1 uvicorn[standard]==0.24.0 python-multipart==0.0.6 gdown==4.7.1 && \
    pip install --no-cache-dir openai-whisper==20231117 && \
    pip cache purge && \
    rm -rf /root/.cache/pip

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run the server
CMD ["python", "main.py"]

