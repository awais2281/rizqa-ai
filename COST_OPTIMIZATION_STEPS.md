# Cost Optimization Steps - Reduce $35 to $5-15/month

## Current Status
- ✅ Transcription is working
- ⚠️ Estimated bill: $35/month (should be $5-15/month)
- Goal: Reduce costs by 50-70%

---

## Step 1: Verify Serverless Mode is Enabled

1. Go to **Railway Dashboard** → Your Project → Your Service
2. Click **"Settings"** tab
3. Look for **"Serverless"** or **"Deployment Type"**
4. **Verify it's set to "Serverless"** (not "Traditional" or "Scale to Zero")
5. If not enabled, **enable it now** ✅

**What to look for:**
- **"Serverless"** option enabled
- **"Compute Type"** = "Serverless"
- **"Deployment Type"** = "Serverless"

---

## Step 2: Set Minimum Resource Limits

1. In **Settings** → **Resources**:
   - **Memory**: Set to **512MB** or **1GB** (minimum for Whisper tiny)
   - **CPU**: Set to **0.25 vCPU** or **0.5 vCPU** (minimum)
   - **Don't over-provision!**

**Current vs Optimized:**
- If you have 2GB RAM → Reduce to 1GB (saves 50%)
- If you have 1 vCPU → Reduce to 0.5 vCPU (saves 50%)

---

## Step 3: Disable Keep-Alive (If Enabled)

If you have a keep-alive system pinging your server, it prevents scaling down:

1. Check **Railway Logs** for frequent `/health` requests
2. If you see regular pings, disable them:
   - Check `.github/workflows/` for GitHub Actions workflows
   - Disable any cron jobs pinging your server
   - Remove any external monitoring that pings frequently

**Why:** Keep-alive prevents serverless scaling down, keeping costs high.

---

## Step 4: Check Idle Timeout Settings

1. In **Settings** → **Serverless** or **Scaling**:
   - **Idle Timeout**: Set to **5 minutes** (minimum)
   - This ensures service scales down quickly when idle

---

## Step 5: Monitor Usage Patterns

1. Go to **Railway Dashboard** → **Metrics** or **Usage**
2. Check:
   - **CPU Usage**: Should be 0% when idle
   - **Memory Usage**: Should be 0MB when idle
   - **Request Count**: How many transcriptions per day?
   - **Uptime**: Should show periods of inactivity

**If you see:**
- Constant CPU/memory usage → Service not scaling down
- High request count → Normal usage, but check if all are necessary
- 100% uptime → Service never scales down (problem!)

---

## Step 6: Verify Auto-Scaling Behavior

1. **Test scaling down:**
   - Wait 10 minutes without making any requests
   - Check **Metrics** → Should show 0% CPU, 0MB memory
   - If not, serverless mode isn't working correctly

2. **Test scaling up:**
   - Make a transcription request
   - Check **Metrics** → Should see CPU/memory spike
   - Service should wake up automatically

---

## Step 7: Check for Background Processes

1. Check **Railway Logs** for:
   - Infinite loops
   - Background tasks
   - Scheduled jobs
   - Health checks from external services

2. **Remove any:**
   - Cron jobs
   - Background workers
   - Keep-alive scripts
   - Monitoring pings

---

## Expected Cost Breakdown

### Current ($35/month):
- Service running too much
- Resource limits too high
- Keep-alive preventing scale-down

### Optimized ($5-15/month):
- **Serverless mode**: Pay only per request
- **Minimal resources**: 512MB-1GB RAM, 0.25-0.5 vCPU
- **No keep-alive**: Service scales to zero when idle
- **Fast scale-down**: 5-minute idle timeout

---

## Quick Checklist

- [ ] Serverless mode enabled in Railway Settings
- [ ] Memory set to 512MB-1GB (minimum)
- [ ] CPU set to 0.25-0.5 vCPU (minimum)
- [ ] Idle timeout set to 5 minutes
- [ ] Keep-alive disabled (no external pings)
- [ ] No background processes running
- [ ] Service scales to zero when idle (verify in Metrics)

---

## If Costs Are Still High

1. **Check actual usage:**
   - How many transcriptions per day?
   - Each transcription = ~2-5 seconds of compute
   - 100 transcriptions/day × 5 seconds = 500 seconds = ~8 minutes/day
   - At $0.000463/GB-second: Should be very cheap

2. **Verify serverless billing:**
   - Railway should charge per request, not per hour
   - If you see hourly charges, serverless isn't enabled

3. **Contact Railway Support:**
   - Ask about serverless billing
   - Verify your service is in serverless mode
   - Check if there are any hidden costs

---

## Alternative: Use Railway's Free Tier More Efficiently

If serverless mode isn't available or working:

1. **Enable "Scale to Zero"** (alternative to serverless)
2. **Set minimum resources** (512MB RAM, 0.25 vCPU)
3. **Disable keep-alive**
4. **Monitor closely** for first week

**Expected cost with Scale to Zero:** $10-20/month (better than $35, but not as good as true serverless)

---

## Summary

**To reduce costs from $35 to $5-15/month:**

1. ✅ Enable **Serverless** mode (not Scale to Zero)
2. ✅ Set **minimum resources** (512MB-1GB RAM, 0.25-0.5 vCPU)
3. ✅ **Disable keep-alive** (no external pings)
4. ✅ Set **5-minute idle timeout**
5. ✅ Verify service **scales to zero** when idle

**After optimization, check your estimated bill in 24-48 hours - it should drop significantly!**

