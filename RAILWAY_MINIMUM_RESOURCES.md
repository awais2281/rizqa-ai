# Railway Minimum Resources Configuration

## Set Minimum Resources for Cost Optimization

To reduce costs from $35/month to $8-15/month, set your Railway service to use minimum resources.

### Steps:

1. **Go to Railway Dashboard**
   - Open your project
   - Click on your service (Whisper server)

2. **Go to Settings**
   - Click **"Settings"** tab at the top

3. **Set Resources to Minimum**
   - Look for **"Resources"** or **"Compute"** section
   - Set the following:
     - **Memory**: **512MB** (or minimum allowed, e.g., 256MB if available)
     - **CPU**: **0.25 vCPU** (or minimum allowed, e.g., 0.1 vCPU if available)

4. **Save Changes**
   - Click **"Save"** or **"Update"**
   - Railway will redeploy with new resource limits

### Expected Cost Impact:

- **Before (2GB RAM, 1 vCPU)**: ~$35/month
- **After (512MB RAM, 0.25 vCPU)**: ~$8-15/month
- **Savings**: 60-75% reduction

### Notes:

- Whisper tiny model needs ~300-400MB RAM
- 512MB should be sufficient for the model + processing
- Lower CPU = slower inference, but acceptable for cost savings
- If you get out-of-memory errors, increase to 1GB RAM

### Verify:

After setting resources, check:
1. Service deploys successfully
2. Transcription still works
3. Estimated bill decreases over 24-48 hours

