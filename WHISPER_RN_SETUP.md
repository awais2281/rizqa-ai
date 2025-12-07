# Whisper.rn Setup Guide

## Important: Development Build Required

`whisper.rn` requires native modules, so you **cannot** use it in Expo Go. You need to create a **development build** using EAS Build.

## Setup Steps

### 1. Install EAS CLI (if not already installed)
```bash
npm install -g eas-cli
eas login
```

### 2. Configure EAS Build
```bash
eas build:configure
```

### 3. Create Development Build

**For Android:**
```bash
eas build --profile development --platform android
```

**For iOS:**
```bash
eas build --profile development --platform ios
```

### 4. Install the Development Build

After the build completes, install it on your device:
- Android: Download the APK from the EAS Build dashboard
- iOS: Install via TestFlight or direct install

### 5. Model File Setup

The `ggml-tiny.bin` file needs to be accessible to the app:

**Option A: Bundle with app (Recommended)**
1. Move `models/ggml-tiny.bin` to `assets/models/ggml-tiny.bin`
2. Update `app.json` to include it in `assetBundlePatterns`:
```json
"assetBundlePatterns": [
  "**/*",
  "assets/models/**"
]
```

**Option B: Copy at runtime**
The code will try to copy the model from the bundle to the document directory on first run.

## Model File Location

The model file should be at:
- Source: `models/ggml-tiny.bin` (or `assets/models/ggml-tiny.bin`)
- Runtime: `FileSystem.documentDirectory/ggml-tiny.bin`

## Testing

1. Create and install the development build
2. Open the app
3. Navigate to Test screen
4. Record audio
5. The model will transcribe Arabic audio

## Troubleshooting

### "Model file not found"
- Ensure the model file is in `models/` folder
- Check that `assetBundlePatterns` includes the models folder
- Verify the file is copied to document directory (check logs)

### "Native module not found"
- You must use a development build, not Expo Go
- Run `npx expo prebuild` if needed
- Rebuild the app after adding native modules

### Build Errors
- Ensure you have the latest EAS CLI
- Check that all dependencies are installed
- Review EAS Build logs for specific errors

## API Usage

The service is already integrated in `TestScreen.tsx`. The `whisperService` will:
1. Load the model on first transcription
2. Transcribe Arabic audio
3. Return the transcribed text for comparison

## Performance

- **Model size**: ~75MB (ggml-tiny.bin)
- **First load**: ~2-5 seconds
- **Transcription**: ~1-3 seconds per recording (depending on length)

