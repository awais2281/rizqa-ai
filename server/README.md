# Whisper Transcription Server

FastAPI server for transcribing audio using PyTorch Whisper models.

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd server
pip install -r requirements.txt
```

### 2. Place Your Model File

Place your `whisper_tiny_ar_quran.pt` model file in one of these locations:
- `server/models/whisper_tiny_ar_quran.pt` (recommended)
- `server/whisper_tiny_ar_quran.pt`
- `models/whisper_tiny_ar_quran.pt` (parent directory)

### 3. Run the Server

**Local Development:**
```bash
cd server
python main.py
```

Or with uvicorn directly:
```bash
cd server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The server will start on `http://localhost:8000`

### 4. Test the Server

```bash
# Health check
curl http://localhost:8000/health

# Test transcription (replace with your audio file)
curl -X POST "http://localhost:8000/transcribe?language=ar" \
  -F "file=@test_audio.wav"
```

## Environment Variables

Create a `.env` file (optional):

```env
WHISPER_MODEL=whisper_tiny_ar_quran.pt
HOST=0.0.0.0
PORT=8000
```

## API Endpoints

### `GET /health`
Check server and model status

### `POST /transcribe`
Transcribe audio file

**Parameters:**
- `file`: Audio file (multipart/form-data)
- `language`: Language code (default: "ar")
- `task`: "transcribe" or "translate" (default: "transcribe")

**Response:**
```json
{
  "success": true,
  "text": "transcribed text here",
  "language": "ar",
  "segments": [...]
}
```

## Deployment Options

### Option 1: Railway (Recommended - Easy & Free Tier)

1. Go to https://railway.app
2. Sign up/login with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect Python
6. Set environment variables:
   - `WHISPER_MODEL=whisper_tiny_ar_quran.pt`
7. Upload your model file to the `server/models/` directory in your repo
8. Deploy!

**Railway will give you a URL like:** `https://your-app.railway.app`

### Option 2: Render

1. Go to https://render.com
2. Sign up/login
3. Click "New" → "Web Service"
4. Connect your GitHub repository
5. Settings:
   - **Build Command:** `cd server && pip install -r requirements.txt`
   - **Start Command:** `cd server && python main.py`
   - **Environment:** Python 3
6. Add environment variable: `WHISPER_MODEL=whisper_tiny_ar_quran.pt`
7. Deploy!

**Render will give you a URL like:** `https://your-app.onrender.com`

### Option 3: Google Cloud Run

1. Install Google Cloud SDK
2. Build container:
   ```bash
   cd server
   docker build -t whisper-server .
   ```
3. Deploy:
   ```bash
   gcloud run deploy whisper-server --source .
   ```

### Option 4: AWS EC2 / DigitalOcean Droplet

1. Create a VM instance (Ubuntu recommended)
2. SSH into the server
3. Install Python 3.9+
4. Clone your repo
5. Install dependencies: `pip install -r requirements.txt`
6. Run: `python main.py`
7. Use nginx as reverse proxy (optional)

### Option 5: Local Network (For Testing)

If running on your local machine:

1. Find your local IP:
   - Windows: `ipconfig` → IPv4 Address
   - Mac/Linux: `ifconfig` or `ip addr`
2. Run server: `python main.py`
3. Use your local IP: `http://YOUR_LOCAL_IP:8000`
4. Make sure your phone and computer are on the same WiFi network

## Troubleshooting

### Model Not Found
- Check that `whisper_tiny_ar_quran.pt` is in the correct location
- Check the server logs for the exact path it's searching

### CUDA/GPU Issues
- The server will automatically use CPU if CUDA is not available
- For GPU support, install CUDA-enabled PyTorch:
  ```bash
  pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
  ```

### Port Already in Use
- Change the port: `PORT=8001 python main.py`
- Or kill the process using port 8000

### CORS Errors
- The server allows all origins by default
- In production, update `allow_origins` in `main.py` to your app's domain

## Model Format

The server supports:
- PyTorch `.pt` files (custom fine-tuned models)
- Standard Whisper model names: `tiny`, `base`, `small`, `medium`, `large`

If your `.pt` file is a standard Whisper checkpoint, it will load correctly. If it's a custom fine-tuned model, make sure it's compatible with the `openai-whisper` library format.

