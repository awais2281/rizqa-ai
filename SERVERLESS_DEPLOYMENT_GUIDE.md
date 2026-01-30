# Serverless Deployment Guide - Railway with Scale to Zero

## Overview

This guide will help you deploy the Whisper transcription server on Railway with **Scale to Zero** enabled, which will reduce costs from ~$91/month to ~$5-15/month.

**Model:** `tarteel-ai/whisper-tiny-ar-quran` (already configured)  
**Platform:** Railway with Serverless/Scale to Zero  
**Expected Cost:** $5-15/month (only pay when processing requests)

---

## Step 1: Deploy to Railway

### Option A: Deploy from GitHub (Recommended)

1. **Make sure your code is pushed to GitHub:**
   ```bash
   git add .
   git commit -m "Serverless deployment ready"
   git push
   ```

2. **Go to Railway Dashboard:**
   - Visit https://railway.app
   - Click **"New Project"**
   - Select **"Deploy from GitHub repo"**
   - Authorize Railway (if first time)
   - Select your repository: **`Rizqa AI`** (or your repo name)
   - Click **"Deploy Now"**

3. **Configure Root Directory:**
   - After deployment starts, click on your service
   - Go to **"Settings"** tab
   - Under **"Root Directory"**, set: `server`
   - Click **"Save"**

4. **Wait for Initial Deployment:**
   - First deployment takes **5-10 minutes** (model download from Hugging Face)
   - Check **"Deployments"** tab → Latest deployment → **"View Logs"**
   - Look for: `✓ Model loaded successfully into memory`
   - Once you see this, the server is ready!

---

## Step 2: Enable Scale to Zero (CRITICAL for Cost Savings!)

This is the **most important step** to reduce costs:

1. **In Railway Dashboard:**
   - Click on your **service** (the Whisper server)
   - Go to **"Settings"** tab
   - Scroll down to find **"Scale to Zero"** or **"Serverless"** option
   - **Enable it** ✅
   - Save changes

2. **If you don't see "Scale to Zero" option:**
   - Look for **"Scaling"** or **"Resources"** section
   - Or check **"Advanced"** settings
   - Railway's UI may vary - the feature might be called:
     - "Scale to Zero"
     - "Serverless Mode"
     - "On-Demand Scaling"
     - "Auto-Scale to Zero"

3. **What this does:**
   - Service automatically shuts down when idle (no requests for ~5 minutes)
   - Wakes up automatically when a request comes in
   - **Cost savings: Only pay when actually processing requests**
   - First request after idle takes ~15-25 seconds (cold start)
   - Subsequent requests are fast (model already loaded)

---

## Step 3: Configure Resource Limits (Optional but Recommended)

To further reduce costs, set minimum resources:

1. **In Railway Dashboard → Settings:**
   - **CPU**: Set to minimum (0.5 vCPU or 1 vCPU)
   - **Memory**: Set to 1GB or 2GB (Whisper tiny needs ~500MB-1GB)
   - **Don't over-provision** - only set what you need

---

## Step 4: Get Your Server URL

1. **In Railway Dashboard:**
   - Click on your service
   - Go to **"Settings"** tab
   - Scroll to **"Domains"** section
   - Copy the URL (e.g., `https://your-service.up.railway.app`)

2. **Or create a custom domain:**
   - Click **"Generate Domain"** or **"Add Domain"**
   - Railway will provide a URL like: `https://rizqa-ai-production.up.railway.app`

---

## Step 5: Update Your Mobile App

1. **Edit `src/config/whisper-server.ts`:**
   ```typescript
   export const WHISPER_SERVER_CONFIG = {
     baseUrl: 'https://your-railway-url.up.railway.app', // Replace with your Railway URL
     timeout: 300000, // 300 seconds (5 minutes) - increased for cold starts
   };
   ```

2. **Rebuild your app:**
   ```bash
   eas build --platform android --profile preview
   ```

---

## Step 6: Test the Deployment

### Test 1: Health Check

```bash
curl https://your-railway-url.up.railway.app/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "device": "cpu",
  "model_id": "tarteel-ai/whisper-tiny-ar-quran"
}
```

### Test 2: Transcription (from Mobile App)

1. Open your Expo app
2. Go to **Test** screen
3. Record audio (3-5 seconds)
4. Wait for transcription result

**Note:** First request after idle may take 15-25 seconds (cold start). Subsequent requests are fast.

---

## Cost Monitoring

### Check Your Usage:

1. **In Railway Dashboard:**
   - Go to **"Usage"** or **"Metrics"** tab
   - Check:
     - **CPU usage** - Should be low when idle (0% with Scale to Zero)
     - **Memory usage** - Should be 0 when idle
     - **Request count** - Number of transcriptions processed
     - **Uptime** - Should show periods of inactivity

2. **Expected Costs:**
   - **With Scale to Zero:** $5-15/month (depending on usage)
   - **Without Scale to Zero:** ~$91/month (running 24/7)

### If Costs Are Still High:

1. ✅ Verify Scale to Zero is enabled
2. ✅ Check for runaway processes in logs
3. ✅ Verify service is actually scaling down (check metrics)
4. ✅ Consider setting resource limits lower

---

## Troubleshooting

### Issue: Service Not Scaling Down

**Symptoms:** Service stays running even when idle

**Solution:**
1. Verify Scale to Zero is enabled in Settings
2. Check Railway logs for errors
3. Ensure no health checks are keeping it alive
4. Contact Railway support if feature is not available

### Issue: Cold Start Takes Too Long

**Symptoms:** First request takes 30+ seconds

**Solution:**
1. This is normal for serverless - model needs to load
2. Consider keeping a "warm" instance (but this costs more)
3. Or accept the cold start for cost savings

### Issue: Transcription Errors

**Symptoms:** "Transcription failed" errors

**Solution:**
1. Check Railway logs for detailed error messages
2. Verify model is loaded: `curl https://your-url/health`
3. Ensure audio file is valid (3-10 seconds, clear speech)
4. Check that `decoder_start_token_id` is set correctly (already configured)

### Issue: Model Not Loading

**Symptoms:** `model_loaded: false` in health check

**Solution:**
1. Check Railway logs for download errors
2. Verify Hugging Face model ID: `tarteel-ai/whisper-tiny-ar-quran`
3. Ensure internet connectivity during deployment
4. Check disk space (model is ~150MB)

---

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Expo App   │ ──────> │  FastAPI     │ ──────> │  Hugging    │
│  (Client)   │  HTTP   │  Server      │  Download│  Face       │
│             │         │  (Railway)   │         │  (Model)    │
└─────────────┘         └──────────────┘         └─────────────┘
                              │
                              │ Loads on first request
                              │ (Cold start: 15-25s)
                              ▼
                        ┌──────────────┐
                        │  Whisper     │
                        │  Model       │
                        │  (In Memory) │
                        └──────────────┘
                              │
                              │ Scales to Zero
                              │ when idle (5 min)
                              ▼
                        ┌──────────────┐
                        │  Idle        │
                        │  (No Cost)   │
                        └──────────────┘
```

---

## Summary

✅ **Deploy from GitHub** → Railway auto-detects Python  
✅ **Set Root Directory** → `server`  
✅ **Enable Scale to Zero** → Critical for cost savings  
✅ **Update App Config** → Point to Railway URL  
✅ **Test** → Verify health and transcription  
✅ **Monitor Costs** → Should be $5-15/month  

**Expected Results:**
- Service scales to zero when idle
- Wakes up on request (15-25s cold start)
- Processes transcription normally
- Costs reduced by 80-90%

---

## Need Help?

If you encounter issues:
1. Check Railway logs for errors
2. Verify Scale to Zero is enabled
3. Test health endpoint
4. Review this guide's troubleshooting section

