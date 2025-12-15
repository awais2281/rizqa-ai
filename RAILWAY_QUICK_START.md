# Railway Quick Start Guide

## ✅ Step 1: Code is Already on GitHub!
Your code is pushed to: `https://github.com/awais2281/rizqa-ai`

## Step 2: Deploy to Railway

1. Go to https://railway.app
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway (if first time)
5. Select repository: **`rizqa-ai`**
6. Click **"Deploy Now"**

Railway will automatically:
- Detect Python
- Install dependencies
- Start your server

## Step 3: Configure Environment Variables

1. In Railway dashboard, click on your service
2. Go to **"Variables"** tab
3. Click **"+ New Variable"**
4. Add:
   - **Name:** `WHISPER_MODEL`
   - **Value:** `whisper_tiny_ar_quran.pt`
   - Click **"Add"**

## Step 4: Set Root Directory

1. In your service, go to **"Settings"**
2. Under **"Root Directory"**, set: `server`
3. Save

## Step 5: Upload Model File

Since the model file is too large for GitHub, upload it directly to Railway:

### Option A: Using Railway CLI (Easiest)

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login:**
   ```bash
   railway login
   ```

3. **Link to your project:**
   ```bash
   cd server
   railway link
   ```
   Select your Railway project.

4. **Upload model file:**
   ```bash
   # Create models directory in Railway
   railway run mkdir -p models
   
   # Upload the file (from your local machine)
   railway run --service your-service-name -- sh -c "cat > models/whisper_tiny_ar_quran.pt" < ../models/whisper_tiny_ar_quran.pt
   ```

### Option B: Use Railway Web Terminal

1. In Railway dashboard, go to your service
2. Click **"Deployments"** → Latest deployment
3. Click **"View Logs"**
4. Look for terminal/console option
5. Run:
   ```bash
   mkdir -p models
   ```
6. Then upload file via Railway's file upload feature (if available)

### Option C: Host Model Elsewhere (Recommended for Easy Setup)

1. **Upload model to Google Drive:**
   - Upload `whisper_tiny_ar_quran.pt` to Google Drive
   - Right-click → Get shareable link
   - Change sharing to "Anyone with the link"
   - Get direct download link (use a service like `gdrive-direct-link` or similar)

2. **Or use Dropbox:**
   - Upload to Dropbox
   - Get shareable link
   - Change `?dl=0` to `?dl=1` for direct download

3. **Add Environment Variable in Railway:**
   - Go to Variables tab
   - Add: `MODEL_DOWNLOAD_URL` = `https://your-direct-download-link.com/whisper_tiny_ar_quran.pt`
   - The server will download it automatically on startup!

## Step 6: Get Your Server URL

1. In Railway dashboard, go to your service
2. **"Settings"** → **"Domains"**
3. Copy the URL: `https://your-app.up.railway.app`

## Step 7: Update App Config

Edit `src/config/whisper-server.ts`:

```typescript
baseUrl: 'https://your-app.up.railway.app'  // Your Railway URL
```

## Step 8: Test!

1. Check health endpoint: `https://your-app.up.railway.app/health`
2. Should return: `{"status": "healthy", "model_loaded": true}`
3. Run your app and test transcription!

## Troubleshooting

### Model Not Loading?
- Check Railway logs for errors
- Verify model file is uploaded (check file size)
- Check `WHISPER_MODEL` environment variable is set

### Server Won't Start?
- Check Railway logs
- Verify `server/requirements.txt` is correct
- Check root directory is set to `server`

### Can't Upload Model?
- Use Option C (host elsewhere) - it's the easiest!
- Or use Railway CLI (Option A)

---

**Need help?** Check Railway logs or ask me!

