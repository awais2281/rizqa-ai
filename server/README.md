# Whisper Arabic Transcription Server

Production inference server for fine-tuned Whisper model (`tarteel-ai/whisper-tiny-ar-quran`).

## Architecture

- **Model Source**: Hugging Face (`tarteel-ai/whisper-tiny-ar-quran`)
- **Model Download**: Automatic at server startup (cached on disk)
- **Inference**: Server-side only (model never sent to client)
- **Deployment**: Railway (model downloaded at runtime, not in Docker image)

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

## Railway Deployment

1. Push code to GitHub
2. Deploy on Railway
3. Set root directory to `server`
4. Model downloads automatically at startup

**No environment variables needed** - model ID is hardcoded in the server.

## Model Details

- **Model**: `tarteel-ai/whisper-tiny-ar-quran`
- **Source**: Hugging Face
- **Format**: PyTorch (pytorch_model.bin)
- **Language**: Arabic
- **Size**: ~150MB (downloaded at runtime)

## Performance

- **First Request**: May take longer (model loading)
- **Subsequent Requests**: Fast (model in memory)
- **Model Cache**: Persists between restarts (in `models_cache/`)

## Troubleshooting

### Model Not Loading
- Check Railway logs for download errors
- Verify Hugging Face model is accessible
- Check disk space (model needs ~200MB)

### Transcription Fails
- Verify audio file format is supported
- Check audio file is ≤10 seconds
- Ensure model is loaded (check `/health` endpoint)
