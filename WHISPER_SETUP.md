# Whisper Integration Setup

## Current Implementation

The app now uses `@xenova/transformers` with the Whisper-tiny model for on-device transcription. This works in Expo Go and doesn't require custom native builds.

## How It Works

1. **Model Loading**: The Whisper-tiny model is automatically downloaded and cached on first use
2. **Audio Processing**: Audio recordings are converted to the format required by the model
3. **Transcription**: The model transcribes Arabic audio to text
4. **Comparison**: The transcribed text is compared with the expected verse using similarity matching

## Model Details

- **Model**: `Xenova/whisper-tiny` (compatible with ggml-tiny)
- **Language**: Arabic (ar)
- **Format**: ONNX (optimized for JavaScript/WebAssembly)
- **Size**: ~75MB (downloaded and cached automatically)

## Important Notes

### Your ggml-tiny.bin File

The `@xenova/transformers` library uses ONNX models, not GGML. Your `ggml-tiny.bin` file is in GGML format, which requires a different library (`whisper.rn`) that needs custom native builds.

### If You Need to Use Your Specific ggml-tiny.bin File

If you specifically need to use your `ggml-tiny.bin` file, you'll need to:

1. **Use `whisper.rn` library** (requires EAS Build):
   ```bash
   npm install whisper.rn
   ```

2. **Create a custom development build**:
   ```bash
   eas build --profile development --platform android
   ```

3. **Update `src/lib/whisper.ts`** to use `whisper.rn` instead of `@xenova/transformers`

### Current Solution Benefits

- ✅ Works immediately in Expo Go
- ✅ No custom builds required
- ✅ Automatic model caching
- ✅ Similar performance to ggml-tiny
- ✅ Supports Arabic transcription

## Testing

1. Record audio in the Test screen
2. The model will transcribe the Arabic audio
3. The transcription is compared with the verse text
4. If similarity >= 70%, the test passes

## Troubleshooting

If transcription doesn't work:

1. **Check internet connection** (first-time model download requires internet)
2. **Check console logs** for error messages
3. **Verify audio format** (should be 16kHz mono WAV)
4. **Check device storage** (model cache requires ~75MB)

## Performance

- **First load**: ~5-10 seconds (model download)
- **Subsequent loads**: ~1-2 seconds (cached model)
- **Transcription**: ~2-5 seconds per recording (depending on length)

