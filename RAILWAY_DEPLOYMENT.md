# Railway Deployment Guide - Step by Step

## Step 1: Prepare Your Model File

First, make sure your model file is ready:

1. **Find your model file** (`whisper_tiny_ar_quran.pt`)
2. **Create the models directory** if it doesn't exist:
   ```bash
   mkdir server/models
   ```
3. **Copy your model** to the server folder:
   ```
   server/models/whisper_tiny_ar_quran.pt
   ```

## Step 2: Deploy to Railway

### Option A: Deploy from GitHub (Recommended)

1. **Push your code to GitHub** (if not already):
   ```bash
   git add .
   git commit -m "Add Whisper server"
   git push origin main
   ```

2. **In Railway Dashboard:**
   - Click **"New Project"**
   - Select **"Deploy from GitHub repo"**
   - Authorize Railway to access your GitHub
   - Select your repository: `Rizqa AI` (or your repo name)
   - Click **"Deploy Now"**

3. **Railway will automatically:**
   - Detect it's a Python project
   - Install dependencies from `requirements.txt`
   - Start the server

### Option B: Deploy from Local Directory

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway:**
   ```bash
   railway login
   ```

3. **Initialize Railway in your project:**
   ```bash
   cd server
   railway init
   ```

4. **Deploy:**
   ```bash
   railway up
   ```

## Step 3: Configure Environment Variables

1. **In Railway Dashboard:**
   - Click on your project
   - Go to **"Variables"** tab
   - Click **"New Variable"**

2. **Add these variables:**
   - **Name:** `WHISPER_MODEL`
   - **Value:** `whisper_tiny_ar_quran.pt`
   - Click **"Add"**

   - **Name:** `PORT`
   - **Value:** `8000`
   - Click **"Add"** (optional, Railway sets this automatically)

## Step 4: Set Root Directory (If Needed)

If Railway doesn't detect the server folder automatically:

1. Go to your service settings
2. Click **"Settings"** tab
3. Under **"Root Directory"**, set: `server`
4. Save

## Step 5: Get Your Server URL

1. **In Railway Dashboard:**
   - Click on your project
   - Click on the service
   - Go to **"Settings"** tab
   - Scroll to **"Domains"** section
   - You'll see a URL like: `https://your-app.up.railway.app`
   - **Copy this URL** - you'll need it for your app!

## Step 6: Update Your App Configuration

1. **Open:** `src/config/whisper-server.ts`

2. **Update the baseUrl:**
   ```typescript
   baseUrl: 'https://your-app.up.railway.app'  // Replace with your Railway URL
   ```

3. **Save the file**

## Step 7: Verify Deployment

1. **Check Railway Logs:**
   - In Railway dashboard, click on your service
   - Go to **"Deployments"** tab
   - Click on the latest deployment
   - Check logs for:
     - ✅ "Loading Whisper model from: ..."
     - ✅ "✓ Whisper model loaded successfully"
     - ✅ "Starting Whisper server on 0.0.0.0:8000"

2. **Test Health Endpoint:**
   Open in browser: `https://your-app.up.railway.app/health`
   
   Should return:
   ```json
   {
     "status": "healthy",
     "model_loaded": true,
     "model_path": "models/whisper_tiny_ar_quran.pt"
   }
   ```

## Step 8: Test Your App

1. **Run your React Native app:**
   ```bash
   npm start
   ```

2. **Test transcription:**
   - Go to Test screen
   - Record audio
   - Should transcribe via Railway server! 🎉

## Troubleshooting

### Model Not Found Error

**Problem:** Server logs show "Model file not found"

**Solution:**
1. Make sure `whisper_tiny_ar_quran.pt` is in `server/models/` folder
2. Commit and push to GitHub:
   ```bash
   git add server/models/whisper_tiny_ar_quran.pt
   git commit -m "Add Whisper model"
   git push
   ```
3. Railway will redeploy automatically

### Server Won't Start

**Problem:** Deployment fails or server crashes

**Solution:**
1. Check Railway logs for errors
2. Verify `requirements.txt` is correct
3. Make sure Python version is compatible (3.9+)
4. Check that `main.py` is in `server/` folder

### App Can't Connect

**Problem:** App shows "Cannot connect to server"

**Solution:**
1. Verify Railway URL is correct in `src/config/whisper-server.ts`
2. Check Railway service is running (green status)
3. Test health endpoint in browser
4. Check Railway logs for errors

### Model Loading Takes Too Long

**Problem:** First request times out

**Solution:**
1. Railway free tier may sleep after inactivity
2. First request after sleep takes ~30 seconds
3. Consider upgrading to paid plan for always-on
4. Or use a service that doesn't sleep (like Cloud Run)

## Railway Free Tier Limits

- ✅ $5 free credit per month
- ✅ Auto-deployments from GitHub
- ✅ HTTPS/SSL included
- ⚠️ May sleep after inactivity (wakes automatically)
- ⚠️ First request after sleep may be slow

## Next Steps

1. ✅ Deploy to Railway
2. ✅ Get your server URL
3. ✅ Update app config
4. ✅ Test transcription
5. 🎉 Enjoy your working Whisper server!

Need help? Check Railway logs or ask me!


