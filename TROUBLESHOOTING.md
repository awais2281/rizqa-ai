# Troubleshooting Guide

## APK Size (170MB)

**This is NORMAL and EXPECTED!**

The APK size breakdown:
- **Whisper model (`ggml-tiny.bin`)**: ~74MB
- **React Native + Expo**: ~40-50MB
- **Native dependencies**: ~20-30MB
- **App code + assets**: ~10-20MB
- **Total**: ~170MB

### To Reduce APK Size (Optional)

1. **Use Android App Bundle (AAB)** instead of APK:
   ```bash
   eas build --profile production --platform android
   ```
   This creates an `.aab` file that Google Play optimizes per device.

2. **Split by Architecture** (in `eas.json`):
   ```json
   {
     "build": {
       "android": {
         "buildType": "apk",
         "gradle": {
           "buildTypes": {
             "release": {
               "splits": {
                 "abi": {
                   "enable": true,
                   "universalApk": false
                 }
               }
             }
           }
         }
       }
     }
   }
   ```

3. **Enable ProGuard** (already enabled in production builds)

## Recording Button Issues

### Common Problems

1. **"Failed to start recording"**
   - **Check**: Microphone permission is granted
   - **Check**: No other app is using the microphone
   - **Check**: Device has a working microphone
   - **Solution**: Restart the app and try again

2. **"No recording URI"**
   - **Check**: Recording actually started (check logs)
   - **Check**: Device storage is not full
   - **Solution**: Free up storage space

3. **"Transcription failed"**
   - **Check**: You're using a development build (not Expo Go)
   - **Check**: Model file is bundled in the APK
   - **Check**: Console logs for specific error
   - **Solution**: Rebuild with `eas build --profile development --platform android`

### Debugging Steps

1. **Check Console Logs**:
   - Look for messages starting with:
     - `"Requesting microphone permission..."`
     - `"Creating recording..."`
     - `"Recording started successfully"`
     - `"Stopping recording..."`
     - `"Starting transcription..."`
     - `"Transcription received:"`

2. **Check Model Loading**:
   - Look for: `"Loading Whisper GGML model..."`
   - Look for: `"Whisper model loaded successfully"`
   - If you see errors, the model file might not be bundled

3. **Check File System**:
   - The recording file should exist at the URI
   - Check logs for: `"Recording file info:"`

## Whisper Model Not Working

### Symptoms
- Transcription always returns empty string
- Error: "Model file not found"
- Error: "Whisper is not available"

### Solutions

1. **Ensure Development Build**:
   ```bash
   eas build --profile development --platform android
   ```
   - Install the APK (not Expo Go)
   - Open the app from the installed APK

2. **Check Model File Location**:
   - Model should be at: `assets/models/ggml-tiny.bin`
   - Check `app.json` has: `"assetBundlePatterns": ["assets/**"]`
   - Check `metro.config.js` has: `assetExts.push('bin')`

3. **Rebuild After Changes**:
   - After moving model file or changing config, rebuild:
   ```bash
   eas build --profile development --platform android
   ```

4. **Check Logs**:
   - Look for model loading messages in console
   - Check if model is copied to document directory
   - Verify model path is correct

## Testing Checklist

Before testing the recording feature:

- [ ] App is a development build (not Expo Go)
- [ ] Microphone permission is granted
- [ ] Model file exists in `assets/models/ggml-tiny.bin`
- [ ] `app.json` includes `"assetBundlePatterns": ["assets/**"]`
- [ ] `metro.config.js` includes `'bin'` in `assetExts`
- [ ] App was rebuilt after any config changes
- [ ] Console logs are visible (for debugging)

## Getting Help

If issues persist:

1. **Check Console Logs**: Look for error messages
2. **Check Device Logs**: Use `adb logcat` for Android
3. **Verify Build**: Ensure you're using the development build APK
4. **Test Permissions**: Manually grant microphone permission in device settings
5. **Test Model**: Check if model file is accessible in the app bundle

## Expected Behavior

When everything works:

1. **Press Recording Button**:
   - Permission dialog appears (first time)
   - Button changes to "Stop & Test"
   - "Recording..." indicator appears

2. **Stop Recording**:
   - "Processing..." appears
   - Transcription runs (may take 5-10 seconds)
   - Result appears: "Correct! ✓" (green) or "Try again" (red)

3. **If Correct**:
   - Automatically moves to next verse after 2 seconds
   - Progress is saved

4. **If Incorrect**:
   - Shows "Try again" message
   - Shows what was heard (if transcription worked)
   - User can try again

