# Custom Arabic Font Setup

## Instructions

1. **Download the TTF format** of your Arabic font (TTF is the recommended format for React Native/Expo)

2. **Place the font file** in this directory (`assets/fonts/`)

3. **Name the font file** `QuranFont.ttf`

   - If your font has a different name, you can either:
     - Rename it to `QuranFont.ttf`, OR
     - Update the font name in `App.tsx` (line with `'QuranFont': require('./assets/fonts/QuranFont.ttf')`) to match your font file name

4. **Restart your Expo development server** after adding the font:
   ```bash
   npm start -- --clear
   ```

## Font Usage

The custom font is automatically loaded and used in:
- `HomeScreen.tsx` - Arabic verse display
- `SurahScreen.tsx` - Verse list display  
- `TestScreen.tsx` - Results display

The font family name used in the app is `'QuranFont'`.

