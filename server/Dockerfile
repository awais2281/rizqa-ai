FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy requirements first (for better Docker layer caching)
COPY requirements.txt .

# Install Python dependencies
# Install NumPy first to avoid conflicts, then PyTorch CPU, then rest
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir "numpy<2.0" && \
    pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch torchaudio && \
    pip install --no-cache-dir -r requirements.txt && \
    pip cache purge && \
    rm -rf /root/.cache/pip

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run the server
# Model will be downloaded at startup from Hugging Face
CMD ["python", "main.py"]
