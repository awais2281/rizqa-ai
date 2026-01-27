# Whisper Arabic Transcription Server

Production inference server for fine-tuned Whisper model (`tarteel-ai/whisper-tiny-ar-quran`).

## Architecture

- **Model Source**: Hugging Face (`tarteel-ai/whisper-tiny-ar-quran`)
- **Model Download**: Automatic at server startup (cached on disk)
- **Inference**: Server-side only (model never sent to client)
- **Deployment**: Railway Serverless (scales to zero when idle, wakes on request)
- **Keep-Alive**: GitHub Actions pings `/health` every 45 minutes during active hours (6 AM - 11 PM UK time)

## Features

- ✅ Downloads model from Hugging Face at startup
- ✅ Caches model on disk for faster restarts
- ✅ Loads model into memory for fast inference
- ✅ Accepts audio files ≤10 seconds
- ✅ Returns Arabic transcription
- ✅ Production-ready error handling
- ✅ Health check endpoints

## API Endpoints

### `GET /health`
Check server and model status

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "device": "cpu",
  "model_id": "tarteel-ai/whisper-tiny-ar-quran"
}
```

### `POST /transcribe`
Transcribe audio file to Arabic text

**Request:**
- `file`: Audio file (multipart/form-data)
- `language`: Language code (optional, default: "ar")

**Response:**
```json
{
  "success": true,
  "text": "transcribed Arabic text here",
  "language": "ar",
  "model": "tarteel-ai/whisper-tiny-ar-quran"
}
```

## Local Development

```bash
cd server
pip install -r requirements.txt
python main.py
```

Server will start on `http://localhost:8000`

Model will be downloaded from Hugging Face on first run (cached in `./models_cache/`)

## Railway Serverless Deployment

1. Push code to GitHub
2. Deploy on Railway
3. Set root directory to `server`
4. Configure Railway service for **serverless/on-demand scaling**:
   - Enable "Scale to Zero" option in Railway dashboard
   - Service will automatically wake on incoming requests
5. Model downloads automatically at startup (cached for faster subsequent starts)

**No environment variables needed** - model ID is hardcoded in the server.

### Keep-Alive System

To prevent cold starts during active hours, a GitHub Actions workflow automatically pings the `/health` endpoint every 45 minutes between 6 AM - 11 PM UK time (GMT/BST).

**Setup:**
1. The workflow is already configured in `.github/workflows/keep-alive.yml`
2. Optionally set `WHISPER_SERVER_URL` as a GitHub secret if your server URL differs from the default
3. The workflow runs automatically on schedule (no manual setup needed)

**Benefits:**
- Prevents cold starts during peak usage hours
- Zero cost (GitHub Actions free tier)
- Automatic timezone handling (GMT/BST)
- Skips pings outside active hours to save resources

## Model Details

- **Model**: `tarteel-ai/whisper-tiny-ar-quran`
- **Source**: Hugging Face
- **Format**: PyTorch (pytorch_model.bin)
- **Language**: Arabic
- **Size**: ~75MB (downloaded at runtime, smaller than base model for faster cold starts)

## Performance

### Serverless Cold Starts
- **Cold Start (first request after idle)**: ~15-25 seconds (with cached model)
- **Cold Start (first-time download)**: ~45-90 seconds (one-time only)
- **Warm Requests**: ~2-5 seconds (model already loaded)
- **Keep-Alive**: Prevents cold starts during active hours (6 AM - 11 PM UK time)

### Model Loading
- **First Request**: May take longer (model loading)
- **Subsequent Requests**: Fast (model in memory)
- **Model Cache**: Persists between restarts (in `models_cache/`)
- **Tiny Model**: Faster loading than base model (~75MB vs ~150MB)

## Troubleshooting

### Model Not Loading
- Check Railway logs for download errors
- Verify Hugging Face model is accessible
- Check disk space (model needs ~200MB)

### Transcription Fails
- Verify audio file format is supported
- Check audio file is ≤10 seconds
- Ensure model is loaded (check `/health` endpoint)
