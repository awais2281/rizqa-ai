# Quick Start: Serverless Deployment Checklist

## ✅ Pre-Deployment Checklist

- [x] Model configured: `tarteel-ai/whisper-tiny-ar-quran`
- [x] Server code ready in `server/` directory
- [x] Requirements.txt includes all dependencies
- [x] Railway.json configured
- [x] Client timeout set to 300 seconds (for cold starts)

---

## 🚀 Deployment Steps (5 minutes)

### 1. Push Code to GitHub
```bash
git add .
git commit -m "Ready for serverless deployment"
git push
```

### 2. Deploy on Railway
1. Go to https://railway.app
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Select your repository
5. Click **"Deploy Now"**

### 3. Configure Service
1. Click on your service
2. **Settings** → **Root Directory**: Set to `server`
3. **Settings** → **Scale to Zero**: **ENABLE** ✅ (CRITICAL!)
4. **Settings** → **Resources**: Set to minimum (1GB RAM, 0.5 vCPU)

### 4. Get URL
1. **Settings** → **Domains** → Copy URL
2. Example: `https://rizqa-ai-production.up.railway.app`

### 5. Update App (if needed)
Edit `src/config/whisper-server.ts`:
```typescript
baseUrl: 'https://your-railway-url.up.railway.app'
```

### 6. Test
```bash
curl https://your-railway-url.up.railway.app/health
```

---

## 💰 Cost Optimization

**Before (without Scale to Zero):**
- Running 24/7: ~$91/month

**After (with Scale to Zero):**
- Only when processing: ~$5-15/month
- **Savings: 80-90%**

---

## ⚠️ Important Notes

1. **First request after idle:** Takes 15-25 seconds (cold start)
2. **Subsequent requests:** Fast (~2-5 seconds)
3. **Scale to Zero:** Service shuts down after 5 minutes of inactivity
4. **Model:** Downloads automatically from Hugging Face on first request

---

## 🐛 Troubleshooting

**Service not scaling down?**
- Verify Scale to Zero is enabled in Settings
- Check Railway logs for errors

**Cold start too slow?**
- This is normal for serverless
- Consider keeping a warm instance (costs more)

**Transcription errors?**
- Check Railway logs
- Verify model is loaded: `curl https://your-url/health`
- Ensure audio is valid (3-10 seconds, clear speech)

---

## 📊 Expected Results

✅ Service scales to zero when idle  
✅ Wakes up on request (15-25s cold start)  
✅ Processes transcription normally  
✅ Costs reduced by 80-90%  

---

**Need detailed instructions?** See `SERVERLESS_DEPLOYMENT_GUIDE.md`

