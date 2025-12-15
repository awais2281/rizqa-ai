# Uploading Model File to Railway

Since your model file (`whisper_tiny_ar_quran.pt`) is too large for GitHub (144MB), we need to upload it directly to Railway.

## Option 1: Railway CLI (Recommended)

### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
```

### Step 2: Login to Railway
```bash
railway login
```

### Step 3: Link to Your Project
```bash
cd server
railway link
```
Select your Railway project when prompted.

### Step 4: Upload Model File
```bash
# Make sure you're in the server directory
railway run --service your-service-name -- bash

# Then upload the file (you'll need to use Railway's file system)
# Or use Railway's web interface (see Option 2)
```

## Option 2: Railway Web Interface (Easier)

### Step 1: After Railway Deploys
1. Go to your Railway project dashboard
2. Click on your service
3. Go to **"Settings"** tab
4. Scroll to **"Volumes"** section

### Step 2: Create a Volume (if needed)
1. Click **"New Volume"**
2. Mount path: `/app/models`
3. Create volume

### Step 3: Upload Model File
Railway doesn't have a direct file upload in the web UI, so we'll use a different approach:

**Better Option: Use Railway's File System via Terminal**

1. In Railway dashboard, go to your service
2. Click **"Deployments"** tab
3. Click on the latest deployment
4. Click **"View Logs"**
5. You'll see a terminal option - use that to upload files

**OR: Modify Server to Download Model**

We can modify the server to download the model from a URL on first startup. This is the easiest approach!

## Option 3: Host Model Elsewhere (Easiest!)

### Step 1: Upload Model to Cloud Storage
Upload `whisper_tiny_ar_quran.pt` to:
- Google Drive (make it shareable)
- Dropbox (get direct download link)
- AWS S3
- Any file hosting service

### Step 2: Update Server Code
Modify `server/main.py` to download the model on startup if it doesn't exist.

### Step 3: Set Environment Variable
In Railway, add environment variable:
- `MODEL_DOWNLOAD_URL=https://your-file-host.com/whisper_tiny_ar_quran.pt`

## Option 4: Use Railway's Persistent Storage

1. In Railway, go to your service
2. Settings → Volumes
3. Create a volume mounted to `/app/models`
4. Use Railway CLI to copy file:
   ```bash
   railway run --service your-service -- cp /local/path/to/whisper_tiny_ar_quran.pt /app/models/
   ```

## Recommended: Quick Fix

The **easiest** solution is to modify the server to download the model from a URL. Let me update the server code to support this!

