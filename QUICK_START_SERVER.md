# Quick Start: Server-Based Whisper Setup

## Step-by-Step Instructions

### Step 1: Prepare Your Model File

1. Rename your model to `whisper_tiny_ar_quran.pt` (if not already)
2. Place it in: `server/models/whisper_tiny_ar_quran.pt`

```
server/
  ├── models/
  │   └── whisper_tiny_ar_quran.pt  ← Your model here
  ├── main.py
  ├── requirements.txt
  └── README.md
```

### Step 2: Set Up Server Locally (For Testing)

```bash
# Install Python dependencies
cd server
pip install -r requirements.txt

# Run server
python main.py
```

Server will start at `http://localhost:8000`

### Step 3: Choose Your Deployment Option

#### 🚀 **Option A: Railway (Easiest - Recommended)**

1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway auto-detects Python
6. Add environment variable: `WHISPER_MODEL=whisper_tiny_ar_quran.pt`
7. Make sure `whisper_tiny_ar_quran.pt` is in `server/models/` folder
8. Deploy!
9. Get your URL: `https://your-app.railway.app`

**Cost:** Free tier available ($5 credit/month)

---

#### 🌐 **Option B: Render**

1. Go to https://render.com
2. Sign up with GitHub
3. Click "New" → "Web Service"
4. Connect your repo
5. Settings:
   - Build: `cd server && pip install -r requirements.txt`
   - Start: `cd server && python main.py`
6. Add env var: `WHISPER_MODEL=whisper_tiny_ar_quran.pt`
7. Deploy!
8. Get your URL: `https://your-app.onrender.com`

**Cost:** Free tier available

---

#### ☁️ **Option C: Google Cloud Run**

```bash
cd server
gcloud run deploy whisper-server \
  --source . \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars WHISPER_MODEL=whisper_tiny_ar_quran.pt
```

**Cost:** Pay per use (~$1-5/month)

---

### Step 4: Update App Configuration

Edit `src/config/whisper-server.ts`:

**For Local Testing:**
```typescript
baseUrl: 'http://localhost:8000'  // iOS Simulator
// OR
baseUrl: 'http://10.0.2.2:8000'   // Android Emulator
// OR
baseUrl: 'http://192.168.1.100:8000'  // Physical device (your local IP)
```

**For Production:**
```typescript
baseUrl: 'https://your-app.railway.app'  // Your deployed server URL
```

### Step 5: Test!

1. Start your server (local or deployed)
2. Run your React Native app
3. Record audio in the Test screen
4. It should transcribe via the server! 🎉

## Troubleshooting

### Server Not Starting?
- Check Python version: `python --version` (need 3.9+)
- Install dependencies: `pip install -r requirements.txt`
- Check model file exists: `ls server/models/whisper_tiny_ar_quran.pt`

### App Can't Connect?
- **Android Emulator:** Use `http://10.0.2.2:8000`
- **iOS Simulator:** Use `http://localhost:8000`
- **Physical Device:** Use your local IP (find with `ipconfig` or `ifconfig`)
- **Production:** Check server URL is correct

### Model Not Loading?
- Check server logs
- Verify model file is in `server/models/` folder
- Check file name matches: `whisper_tiny_ar_quran.pt`

## What Changed?

✅ **Server:** FastAPI server in `server/` folder  
✅ **Client:** Updated to call server API instead of on-device  
✅ **Config:** Server URL in `src/config/whisper-server.ts`  
✅ **No More:** On-device model loading issues!

## Next Steps

1. Deploy server (Railway recommended)
2. Update app config with server URL
3. Test transcription
4. Enjoy! 🚀

For detailed instructions, see `SERVER_SETUP.md`


