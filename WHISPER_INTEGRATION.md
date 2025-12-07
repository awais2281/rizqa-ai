# Whisper GGML Integration Guide

## Overview
The TestScreen uses the Whisper service (`src/lib/whisper.ts`) to transcribe Arabic audio recordings. Currently, the service has a placeholder implementation that needs to be replaced with actual Whisper GGML model integration.

## Current Status
- ✅ Audio recording configured for 16kHz mono WAV
- ✅ Whisper service structure created
- ⚠️ Whisper model integration needs native module

## Model Location
The Whisper tiny model should be located at:
```
/models/ggml-tiny.bin
```

## Integration Options

### Option 1: react-native-whisper (Recommended)
If available for Expo, you can use:
```bash
npm install react-native-whisper
```

### Option 2: Custom Native Module
Create a native module that:
1. Loads the GGML model from the bundle
2. Accepts audio file path
3. Runs inference with language="ar"
4. Returns transcribed text

### Option 3: Expo Module
Create an Expo module that wraps whisper.cpp:
1. Add native code for iOS/Android
2. Bundle the model with the app
3. Expose JavaScript API

## Implementation Steps

1. **Install Whisper Library**
   ```bash
   npm install <whisper-library>
   ```

2. **Update `src/lib/whisper.ts`**
   - Replace placeholder `transcribe()` method
   - Load model from `/models/ggml-tiny.bin`
   - Configure for Arabic language
   - Return transcribed text

3. **Test Integration**
   - Record Arabic audio
   - Verify transcription accuracy
   - Adjust similarity threshold if needed

## Model Requirements
- Format: GGML (ggml-tiny.bin)
- Language: Arabic (ar)
- Sample Rate: 16kHz
- Channels: Mono

## Notes
- The model should be bundled with the app (not downloaded)
- No internet connection required
- Transcription should be fast enough for real-time use

