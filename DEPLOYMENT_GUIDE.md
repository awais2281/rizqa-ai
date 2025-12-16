# Deployment Guide - Whisper Arabic Transcription Server

## Quick Start

### 1. Railway Deployment

1. **Push to GitHub** (already done)
2. **Deploy on Railway:**
   - Go to https://railway.app
   - New Project → Deploy from GitHub
   - Select your repository
   - Set **Root Directory** to: `server`
   - Deploy!

3. **Wait for Model Download:**
   - First deployment takes 5-10 minutes (model download)
   - Check logs for: "✓ Model loaded successfully"
   - Model is cached on disk for faster restarts

4. **Get Your Server URL:**
   - Railway → Settings → Domains
   - Copy the URL (e.g., `https://your-app.up.railway.app`)

### 2. Update Expo App

Edit `src/config/whisper-server.ts`:

```typescript
baseUrl: 'https://your-railway-url.up.railway.app'
```

### 3. Test

1. **Test Server:**
   ```bash
   curl https://your-railway-url.up.railway.app/health
   ```

2. **Test Transcription:**
   - Run your Expo app
   - Record audio in Test screen
   - Should transcribe via server!

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Expo App   │ ──────> │  FastAPI     │ ──────> │  Hugging    │
│  (Client)   │  HTTP   │  Server      │  Download│  Face       │
│             │         │  (Railway)   │         │  (Model)    │
└─────────────┘         └──────────────┘         └─────────────┘
                              │
                              │ Loads into memory
                              ▼
                        ┌──────────────┐
                        │  Whisper     │
                        │  Model       │
                        │  (In Memory) │
                        └──────────────┘
```

## Model Download Flow

1. **Server Starts** → Downloads model from Hugging Face
2. **Model Cached** → Saved to disk (`models_cache/`)
3. **Model Loaded** → Into memory for inference
4. **Requests** → Fast transcription using in-memory model

## Environment Variables (Optional)

Railway doesn't require any environment variables - model ID is hardcoded.

Optional variables:
- `MODEL_CACHE_DIR`: Where to cache model (default: `./models_cache`)
- `HOST`: Server host (default: `0.0.0.0`)
- `PORT`: Server port (default: `8000`, Railway sets this automatically)

## Monitoring

### Check Model Status
```bash
curl https://your-server-url/health
```

### Check Server Status
```bash
curl https://your-server-url/
```

## Troubleshooting

### Model Download Fails
- Check Railway logs
- Verify Hugging Face is accessible
- Check disk space

### Server Won't Start
- Check Railway logs for Python errors
- Verify `requirements.txt` is correct
- Check root directory is set to `server`

### Transcription Returns Empty
- Check audio file format
- Verify audio is ≤10 seconds
- Check model is loaded (`/health` endpoint)

## Cost Optimization

- Model is downloaded once and cached
- No model in Docker image (keeps size < 4GB)
- CPU-only PyTorch (smaller, works on Railway free tier)
- Model stays in memory (fast inference)

## Next Steps

1. ✅ Deploy to Railway
2. ✅ Wait for model download
3. ✅ Update app config with server URL
4. ✅ Test transcription
5. 🎉 Enjoy your working Arabic transcription service!

