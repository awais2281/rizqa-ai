# Alternative Ways to Upload Your Model File

Since Google Drive is having permission issues, here are better alternatives:

## Option 1: Dropbox (Recommended - Easiest)

### Step 1: Upload to Dropbox
1. Go to https://www.dropbox.com
2. Sign up/login
3. Upload your `whisper_tiny_ar_quran.pt` file (or compressed archive)
4. Right-click the file → "Copy link" or "Share"

### Step 2: Get Direct Download Link
1. The shareable link will look like:
   ```
   https://www.dropbox.com/s/xxxxx/whisper_tiny_ar_quran.pt?dl=0
   ```
2. Change `?dl=0` to `?dl=1` for direct download:
   ```
   https://www.dropbox.com/s/xxxxx/whisper_tiny_ar_quran.pt?dl=1
   ```

### Step 3: Update Railway
1. Go to Railway → Your service → "Variables"
2. Update `MODEL_DOWNLOAD_URL` with your Dropbox link (`?dl=1`)
3. Railway will redeploy automatically

**✅ Dropbox works much better than Google Drive for large files!**

---

## Option 2: Use Railway Volumes (Direct Upload)

### Step 1: Create a Volume in Railway
1. In Railway dashboard, go to your service
2. Go to "Settings" → "Volumes"
3. Click "New Volume"
4. Mount path: `/app/models`
5. Create volume

### Step 2: Upload File via Railway CLI
1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

2. Login:
   ```bash
   railway login
   ```

3. Link to your project:
   ```bash
   cd server
   railway link
   ```

4. Copy file to Railway:
   ```bash
   # Make sure you're in the server directory
   railway run --service your-service-name -- mkdir -p /app/models
   
   # Upload the file (adjust path to your local file)
   railway run --service your-service-name -- sh -c "cat > /app/models/whisper_tiny_ar_quran.pt" < ../models/whisper_tiny_ar_quran.pt
   ```

---

## Option 3: Use a File Hosting Service

Upload to any file hosting service that provides direct download links:
- **WeTransfer**: https://wetransfer.com (free, up to 2GB)
- **MediaFire**: https://www.mediafire.com (free)
- **Mega.nz**: https://mega.nz (free, 20GB)
- **AWS S3**: If you have AWS account

Then update `MODEL_DOWNLOAD_URL` in Railway with the direct download link.

---

## Option 4: Fix Google Drive Permissions

If you want to stick with Google Drive:

1. **Make sure file is shared correctly:**
   - Right-click file in Google Drive
   - Click "Share"
   - Click "Change to anyone with the link"
   - Set to "Viewer" (not "Editor")
   - Click "Done"

2. **Verify the link:**
   - Open the file in a browser (incognito/private window)
   - Make sure you can download it without logging in
   - If you can't, permissions aren't set correctly

3. **For very large files:**
   - Google Drive may still block automated downloads
   - Consider using Dropbox instead (it's more reliable)

---

## Recommended: Use Dropbox

**Dropbox is the easiest and most reliable option.** It handles large files better than Google Drive and provides direct download links that work consistently.

Just upload your file, get the shareable link, change `?dl=0` to `?dl=1`, and update Railway!

