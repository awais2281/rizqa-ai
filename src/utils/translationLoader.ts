/**
 * Translation loader utility
 * Loads and provides access to English translations from en-sarwar-simple.json
 */

interface TranslationData {
  [key: string]: {
    t: string;
  };
}

// Load translation data
const translationData: TranslationData = require('../../qurandata/en-sarwar-simple.json');

/**
 * Get English translation for a verse by surah and ayah number
 * @param surah - Surah number (1-114)
 * @param ayah - Ayah number within the surah
 * @returns Translation text or empty string if not found
 */
export function getTranslation(surah: number, ayah: number): string {
  const key = `${surah}:${ayah}`;
  const verse = translationData[key];
  return verse?.t || '';
}

/**
 * Get full verse translation (useful for displaying complete verse)
 * @param surah - Surah number (1-114)
 * @param ayah - Ayah number within the surah
 * @returns Translation text or empty string if not found
 */
export function getVerseTranslation(surah: number, ayah: number): string {
  return getTranslation(surah, ayah);
}

