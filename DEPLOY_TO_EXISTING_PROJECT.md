# Deploy to Existing Railway Project - Serverless Mode

## ✅ Code Updated
Your code has been updated and pushed to GitHub with serverless configuration.

---

## Step 1: Go to Your Existing Railway Project

1. Go to **https://railway.app**
2. Log in to your account
3. Find your existing project (the one with `rizqa-ai-production.up.railway.app`)
4. Click on the project

---

## Step 2: Add New Service (or Redeploy Existing)

### Option A: If You Deleted All Services (Recommended)

1. In your project, click **"+ New"** or **"Add Service"**
2. Select **"GitHub Repo"**
3. Select your repository: **`rizqa-ai`** (or `awais2281/rizqa-ai`)
4. Click **"Deploy Now"**

### Option B: If Service Still Exists

1. Click on your existing service
2. Go to **"Settings"** → **"Source"**
3. Click **"Redeploy"** or **"Redeploy from GitHub"**
4. This will pull the latest code from GitHub

---

## Step 3: Configure Root Directory

1. Click on your service
2. Go to **"Settings"** tab
3. Find **"Root Directory"**
4. Set it to: **`server`**
5. Click **"Save"**

---

## Step 4: Enable Serverless Mode (NOT Scale to Zero)

1. Still in **"Settings"** tab
2. Look for **"Serverless"** option (this is different from "Scale to Zero")
3. **Enable Serverless** ✅
4. If you don't see "Serverless", look for:
   - **"Deployment Type"** → Select **"Serverless"**
   - **"Compute Type"** → Select **"Serverless"**
   - **"Runtime"** → Select **"Serverless"**
5. Save changes

**Note:** Railway's "Serverless" mode is different from "Scale to Zero":
- **Serverless**: True serverless functions (pay per request, auto-scales)
- **Scale to Zero**: Traditional service that scales down when idle

---

## Step 5: Set Resource Limits (Optional)

1. In **Settings** → **Resources**:
   - **Memory**: 1GB (minimum for Whisper)
   - **CPU**: 0.5 vCPU (minimum)
2. Save

---

## Step 6: Wait for Deployment

1. Go to **"Deployments"** tab
2. Click on the latest deployment
3. Click **"View Logs"**
4. Watch for:
   - `Installing dependencies...`
   - `Downloading model from Hugging Face...`
   - `✓ Model loaded successfully into memory`

**First deployment takes 5-10 minutes** (model download)

---

## Step 7: Verify Serverless Mode

1. Go to **"Settings"** → **"Deployment"** or **"Compute"**
2. Verify it shows **"Serverless"** as the deployment type
3. Check **"Metrics"** tab - should show serverless metrics (requests, invocations)

---

## Step 8: Test

```bash
curl https://rizqa-ai-production.up.railway.app/health
```

**Expected:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_id": "tarteel-ai/whisper-tiny-ar-quran"
}
```

---

## Cost Expectations with Serverless

- **Pay per request**: Only charged when processing transcriptions
- **No idle costs**: Service doesn't run when not in use
- **Expected cost**: $5-15/month (much lower than $91!)

---

## Troubleshooting

**Can't find "Serverless" option?**
- Railway's UI may vary
- Look in **"Settings"** → **"Deployment Type"** or **"Compute Type"**
- If not available, "Scale to Zero" is the closest alternative

**Service not deploying?**
- Check logs for errors
- Verify Root Directory is set to `server`
- Ensure `server/requirements.txt` exists

**Model not loading?**
- Check logs for download errors
- Model downloads automatically from Hugging Face on first request

---

## Summary

✅ Deploy to existing project  
✅ Set Root Directory to `server`  
✅ Enable **Serverless** mode (not Scale to Zero)  
✅ Wait for deployment  
✅ Test health endpoint  

Your service will now run in true serverless mode with pay-per-request pricing!

