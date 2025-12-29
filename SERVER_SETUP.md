# Whisper Server Setup Guide

Complete guide to set up and deploy your Whisper transcription server.

## Quick Start

### 1. Place Your Model File

Place `whisper_tiny_ar_quran.pt` in:
```
server/models/whisper_tiny_ar_quran.pt
```

### 2. Install Dependencies

```bash
cd server
pip install -r requirements.txt
```

### 3. Run Server Locally

```bash
cd server
python main.py
```

Server will start at `http://localhost:8000`

### 4. Update App Configuration

Edit `src/config/whisper-server.ts`:

**For Android Emulator:**
```typescript
baseUrl: 'http://10.0.2.2:8000'
```

**For iOS Simulator:**
```typescript
baseUrl: 'http://localhost:8000'
```

**For Physical Device (same WiFi):**
```typescript
baseUrl: 'http://YOUR_LOCAL_IP:8000'  // e.g., http://192.168.1.100:8000
```

**For Production:**
```typescript
baseUrl: 'https://your-app.railway.app'  // Your deployed server URL
```

## Deployment Options

### Option 1: Railway (Recommended - Easiest)

**Why Railway:**
- ✅ Free tier available
- ✅ Automatic deployments from GitHub
- ✅ Easy to set up
- ✅ Handles SSL/HTTPS automatically
- ✅ Good for small to medium traffic

**Steps:**

1. **Sign up at Railway:**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure Deployment:**
   - Railway auto-detects Python
   - It will look for `requirements.txt` in the `server/` folder
   - Set root directory to `server/` if needed

4. **Add Environment Variables:**
   - Go to Variables tab
   - Add: `WHISPER_MODEL=whisper_tiny_ar_quran.pt`
   - Add: `PORT=8000` (optional)

5. **Upload Model File:**
   - Make sure `whisper_tiny_ar_quran.pt` is in `server/models/` directory
   - Commit and push to GitHub
   - Railway will deploy automatically

6. **Get Your URL:**
   - Railway gives you a URL like: `https://your-app.up.railway.app`
   - Update `src/config/whisper-server.ts` with this URL

**Railway Free Tier:**
- $5 free credit per month
- Enough for testing and small apps
- Auto-sleeps after inactivity (wakes on request)

---

### Option 2: Render

**Why Render:**
- ✅ Free tier available
- ✅ Easy setup
- ✅ Good documentation

**Steps:**

1. **Sign up at Render:**
   - Go to https://render.com
   - Sign up with GitHub

2. **Create Web Service:**
   - Click "New" → "Web Service"
   - Connect your GitHub repository

3. **Configure:**
   - **Name:** `whisper-server` (or any name)
   - **Environment:** `Python 3`
   - **Build Command:** `cd server && pip install -r requirements.txt`
   - **Start Command:** `cd server && python main.py`
   - **Root Directory:** `server` (if your server code is in server/)

4. **Environment Variables:**
   - `WHISPER_MODEL=whisper_tiny_ar_quran.pt`
   - `PORT=8000`

5. **Deploy:**
   - Click "Create Web Service"
   - Render will build and deploy
   - Get your URL: `https://your-app.onrender.com`

**Render Free Tier:**
- Free tier available
- Spins down after 15 min inactivity
- Takes ~30 seconds to wake up

---

### Option 3: Google Cloud Run

**Why Cloud Run:**
- ✅ Pay per use (very cheap)
- ✅ Auto-scaling
- ✅ Good for production

**Steps:**

1. **Install Google Cloud SDK:**
   ```bash
   # Download from https://cloud.google.com/sdk/docs/install
   ```

2. **Authenticate:**
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Build and Deploy:**
   ```bash
   cd server
   gcloud run deploy whisper-server \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars WHISPER_MODEL=whisper_tiny_ar_quran.pt
   ```

4. **Get URL:**
   - Cloud Run gives you: `https://whisper-server-xxx.run.app`
   - Update your app config

---

### Option 4: AWS EC2 / DigitalOcean Droplet

**Why EC2/Droplet:**
- ✅ Full control
- ✅ Good for production
- ✅ Can handle high traffic

**Steps:**

1. **Create VM:**
   - EC2: Launch Ubuntu instance (t2.micro for free tier)
   - DigitalOcean: Create Ubuntu Droplet ($6/month minimum)

2. **SSH into Server:**
   ```bash
   ssh user@your-server-ip
   ```

3. **Install Dependencies:**
   ```bash
   sudo apt update
   sudo apt install python3 python3-pip ffmpeg -y
   ```

4. **Clone and Setup:**
   ```bash
   git clone YOUR_REPO_URL
   cd YOUR_REPO/server
   pip3 install -r requirements.txt
   ```

5. **Run Server (with PM2 for auto-restart):**
   ```bash
   npm install -g pm2
   pm2 start main.py --name whisper-server --interpreter python3
   pm2 save
   pm2 startup  # Follow instructions to enable on boot
   ```

6. **Configure Firewall:**
   ```bash
   sudo ufw allow 8000/tcp
   ```

7. **Access:**
   - Use: `http://YOUR_SERVER_IP:8000`
   - Or set up nginx reverse proxy with SSL

---

### Option 5: Local Network (For Testing)

**For Physical Device Testing:**

1. **Find Your Local IP:**
   ```bash
   # Windows
   ipconfig
   # Look for IPv4 Address (e.g., 192.168.1.100)
   
   # Mac/Linux
   ifconfig
   # or
   ip addr
   ```

2. **Run Server:**
   ```bash
   cd server
   python main.py
   ```

3. **Update App Config:**
   ```typescript
   // In src/config/whisper-server.ts
   baseUrl: 'http://192.168.1.100:8000'  // Your local IP
   ```

4. **Make Sure:**
   - Phone and computer on same WiFi
   - Firewall allows port 8000
   - Server is running

---

## Testing Your Server

### Test Health Endpoint:
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_path": "models/whisper_tiny_ar_quran.pt",
  "device": "cpu"
}
```

### Test Transcription:
```bash
curl -X POST "http://localhost:8000/transcribe?language=ar" \
  -F "file=@test_audio.wav"
```

Expected response:
```json
{
  "success": true,
  "text": "transcribed text here",
  "language": "ar",
  "segments": [...]
}
```

## Troubleshooting

### Server Won't Start
- Check Python version: `python --version` (need 3.9+)
- Check dependencies: `pip install -r requirements.txt`
- Check model file exists: `ls server/models/whisper_tiny_ar_quran.pt`

### Model Not Loading
- Check model file path in logs
- Verify model file format (should be `.pt`)
- Try reloading: `curl -X POST http://localhost:8000/reload-model`

### App Can't Connect
- **Android Emulator:** Use `http://10.0.2.2:8000` (not localhost)
- **iOS Simulator:** Use `http://localhost:8000`
- **Physical Device:** Use your local IP, ensure same WiFi
- **Production:** Check server URL is correct and server is running

### CORS Errors
- Server already allows all origins by default
- If issues persist, check server logs

### Timeout Errors
- Increase timeout in `src/config/whisper-server.ts`
- Check server performance (CPU/RAM)
- Consider using GPU if available

## Production Checklist

- [ ] Server deployed and accessible
- [ ] Model file uploaded to server
- [ ] Environment variables set
- [ ] App config updated with production URL
- [ ] SSL/HTTPS enabled (automatic on Railway/Render)
- [ ] Health endpoint responding
- [ ] Test transcription working
- [ ] App can connect and transcribe

## Cost Estimates

- **Railway:** Free tier ($5 credit/month) → ~$5-10/month for small usage
- **Render:** Free tier → ~$7/month for always-on
- **Cloud Run:** Pay per use → ~$1-5/month for low traffic
- **EC2/Droplet:** $6-10/month minimum

## Next Steps

1. Deploy server using one of the options above
2. Update `src/config/whisper-server.ts` with your server URL
3. Test the app - it should now transcribe via server!
4. Monitor server logs for any issues


