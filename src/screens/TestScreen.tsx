import React, { useState, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { whisperServerService } from '../lib/whisper-server';
import { extractArabicChunkWords, splitArabicVerseIntoChunks, getChunkString } from '../utils/arabicChunking';
import { scoreWhisperAgainstChunk, normalizeArabic, tokenizeArabic } from '../utils/recitationScoring';
import { compareRecitation, calculateExpectedHash } from '../recitation/arabicCompare';

const quranMetadata = require('../../qurandata/indopaknew-data.json');
const loadingMessagesData = require('../../qurandata/loadingmessages.json');
import { loadQuranData, getVerseBySurahAndAyah, Verse } from '../utils/quranDataLoader';
import { getVerseTranslation } from '../utils/translationLoader';

// Optional: English translations (if available)
// Load without old data since it's optional and may not exist
const quranData = loadQuranData(quranMetadata, undefined);

interface TestScreenProps {
  navigation: any;
  route?: any;
}

export default function TestScreen({ navigation, route }: TestScreenProps) {
  const [currentSurah, setCurrentSurah] = useState(1);
  const [currentAyah, setCurrentAyah] = useState(1);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [verseText, setVerseText] = useState('');
  const [coreExpectedWords, setCoreExpectedWords] = useState<string[]>([]); // Core Arabic words from chunk
  const [fullVerseEnglish, setFullVerseEnglish] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [testResult, setTestResult] = useState<'pass' | 'partial' | 'fail' | null>(null);
  const [testStatus, setTestStatus] = useState<'PASS' | 'GOOD' | 'EXCELLENT' | 'FAIL' | null>(null);
  const [expectedChunkHash, setExpectedChunkHash] = useState<string>('');
  const [transcribedText, setTranscribedText] = useState('');
  const [wordComparison, setWordComparison] = useState<Array<{word: string, score: number}>>([]);
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [isRecordingFinished, setIsRecordingFinished] = useState(false);
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState('');
  const [showResultsButton, setShowResultsButton] = useState(false);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadProgressAndVerse();
    // Don't preload - model will load on first transcription attempt
    // This prevents console spam when model isn't bundled
  }, []);

  useEffect(() => {
    loadCurrentVerse();
  }, [currentSurah, currentAyah, currentChunkIndex]);

  // Handle loading message sequence and progress bar animation
  useEffect(() => {
    if (!isProcessing) {
      // Clean up intervals when processing stops
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
        messageIntervalRef.current = null;
      }
      progressAnim.setValue(0);
      setCurrentLoadingMessage('');
      setProgressPercentage(0);
      return;
    }

    // Start loading message sequence
    const messages = loadingMessagesData.loading_messages || [];
    const fixedMessages = [
      'Listening to audio',
      'identifying words',
      'comparing verse '
    ];
    
    // Filter out fixed messages from random pool (trim for comparison)
    const randomMessages = messages
      .map(msg => msg.trim())
      .filter(msg => msg.length > 0 && !fixedMessages.includes(msg.trim()));

    let messageIndex = 0;
    
    // Set first fixed message
    setCurrentLoadingMessage(fixedMessages[0]);
    
    // After 5-6 seconds, show second fixed message
    const firstTimeout = setTimeout(() => {
      setCurrentLoadingMessage(fixedMessages[1]);
    }, 5500);
    
    // After another 5-6 seconds, show third fixed message
    const secondTimeout = setTimeout(() => {
      setCurrentLoadingMessage(fixedMessages[2]);
    }, 11000);
    
    // After another 5-6 seconds, start showing random messages
    const thirdTimeout = setTimeout(() => {
      // Show random messages every 5-6 seconds
      messageIntervalRef.current = setInterval(() => {
        if (randomMessages.length > 0) {
          const randomIndex = Math.floor(Math.random() * randomMessages.length);
          setCurrentLoadingMessage(randomMessages[randomIndex]);
        }
      }, 5500);
    }, 16500);

    // Start progress bar animation (3 minutes = 180 seconds)
    const PROGRESS_DURATION = 180000; // 180 seconds in milliseconds
    const PROGRESS_STEPS = 1800; // Update every 100ms for smooth animation
    const stepValue = 1 / PROGRESS_STEPS;
    let currentStep = 0;

    progressAnim.setValue(0);
    
    progressIntervalRef.current = setInterval(() => {
      currentStep++;
      const progress = Math.min(currentStep * stepValue, 1);
      progressAnim.setValue(progress);
      setProgressPercentage(Math.round(progress * 100)); // Update percentage display
      
      if (progress >= 1) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      }
    }, 100);

    // Cleanup function
    return () => {
      clearTimeout(firstTimeout);
      clearTimeout(secondTimeout);
      clearTimeout(thirdTimeout);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
        messageIntervalRef.current = null;
      }
    };
  }, [isProcessing, progressAnim]);


  const loadProgressAndVerse = async () => {
    try {
      const savedSurah = await AsyncStorage.getItem('currentSurah');
      const savedAyah = await AsyncStorage.getItem('currentAyah');
      const savedChunkIndex = await AsyncStorage.getItem('currentChunkIndex');
      
      const surah = savedSurah ? parseInt(savedSurah) : 1;
      const ayah = savedAyah ? parseInt(savedAyah) : 1;
      const chunkIndex = savedChunkIndex ? parseInt(savedChunkIndex) : 0;
      
      // Set state values
      setCurrentSurah(surah);
      setCurrentAyah(ayah);
      setCurrentChunkIndex(chunkIndex);
      
      // Immediately load and calculate the verse chunk (synchronous operation)
      loadVerseChunk(surah, ayah, chunkIndex);
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  // Map transliteration words to Arabic words using positional alignment
  const mapTransliterationToArabic = (transliteration: string, arabicText: string): Map<number, number> => {
    const transliterationWords = transliteration.trim().split(/\s+/).filter(w => w.length > 0);
    const arabicWords = arabicText.trim().split(/\s+/).filter(w => w.length > 0);
    
    const mapping = new Map<number, number>();
    
    // Since transliteration is a phonetic representation of Arabic,
    // we align them positionally (transliteration word i maps to Arabic word i)
    // This works because transliteration follows the same word order as Arabic
    const minLength = Math.min(transliterationWords.length, arabicWords.length);
    for (let i = 0; i < minLength; i++) {
      mapping.set(i, i);
    }
    
    return mapping;
  };

  // Canonical tokenization function - used consistently everywhere
  // Handles: lowercase, punctuation removal, whitespace splitting, and glued token splitting
  const tokenizeTransliteration = (text: string): string[] => {
    if (!text) return [];
    
    // Step 1: Normalize text
    let normalized = text.trim();
    
    // Lowercase
    normalized = normalized.toLowerCase();
    
    // Remove punctuation except apostrophes, normalize hyphens/slashes to spaces
    normalized = normalized
      .replace(/[-/]/g, ' ') // Hyphens and slashes to spaces
      .replace(/[^\w\s']/g, '') // Remove punctuation except apostrophes and alphanumeric
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Step 2: Split by whitespace
    const words = normalized.split(/\s+/).filter((w: string) => w.length > 0);
    
    // Step 3: Split glued tokens by detecting Arabic clitics/prefixes/suffixes
    const tokens: string[] = [];
    
    // Arabic prefixes and particles (longer ones first to avoid false matches)
    const prefixes = [
      'allatheeist', // allathee + ist pattern
      'allathee',
      'thulumatinla', // thulumatin + la pattern
      'assufahaowalakin', // assufaha + o + walakin pattern
      'wal', 'fal', 'bil', 'lil', 'kal', // Combined prefixes
      'wa', 'fa', 'bi', 'li', 'ka', 'al', // Basic prefixes
      'la', 'ma', 'min', 'an', 'in', 'idha', 'idh', // Particles
    ];
    
    // Common glued patterns (algorithmic rules)
    const gluedPatterns = [
      { pattern: /(.+?)tinla$/i, split: (m: RegExpMatchArray) => [m[1] + 'tin', 'la'] }, // ...tinla → ...tin + la
      { pattern: /(.+?)aowalakin$/i, split: (m: RegExpMatchArray) => [m[1] + 'ao', 'wa', 'lakin'] }, // ...aowalakin → ...ao + wa + lakin
      { pattern: /allatheeist(.+)$/i, split: (m: RegExpMatchArray) => ['allathee', 'ist' + m[1]] }, // allatheeist... → allathee + ist...
    ];
    
    for (const word of words) {
      let remaining = word;
      let maxIterations = 15; // Prevent infinite loops
      let iterations = 0;
      let processed = false;
      
      // First, check for known glued patterns
      for (const gluedPattern of gluedPatterns) {
        const match = remaining.match(gluedPattern.pattern);
        if (match) {
          const split = gluedPattern.split(match);
          tokens.push(...split);
          processed = true;
          break;
        }
      }
      
      if (processed) continue;
      
      // Otherwise, split by prefixes/particles
      while (remaining.length > 0 && iterations < maxIterations) {
        iterations++;
        let prefixFound = false;
        const lowerRemaining = remaining.toLowerCase();
        
        // Check each prefix (longer ones first)
        for (const prefix of prefixes) {
          if (lowerRemaining.startsWith(prefix) && remaining.length > prefix.length) {
            // Verify it's a valid prefix (not part of a longer word)
            // For Arabic transliteration, prefixes are usually followed by consonants or vowels
            const nextChar = remaining[prefix.length].toLowerCase();
            // Allow if next char is a vowel (a, e, i, o, u) or consonant (not common in English words)
            if (/[aeiou]/.test(nextChar) || !/[a-z]/.test(nextChar) || remaining.length <= prefix.length + 2) {
              tokens.push(prefix);
              remaining = remaining.substring(prefix.length);
              prefixFound = true;
              break;
            }
          }
        }
        
        // If no prefix found, add the remaining word and break
        if (!prefixFound) {
          if (remaining.length > 0) {
            tokens.push(remaining);
          }
          break;
        }
      }
      
      // Safety: if we hit max iterations, add remaining as-is
      if (iterations >= maxIterations && remaining.length > 0) {
        tokens.push(remaining);
      }
    }
    
    return tokens.filter((t: string) => t.length > 0);
  };

  // Enhanced Arabic normalization for matching
  const normalizeArabicForMatching = (text: string): string => {
    if (!text) return '';
    
    // Remove all diacritics
    let normalized = text
      .replace(/[\u064B-\u065F\u0670]/g, '') // Remove Arabic diacritics
      .replace(/[\u0610-\u061A\u0640]/g, '') // Remove additional diacritics and tatweel
      .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]/g, '') // Keep only Arabic characters
      .replace(/\s+/g, ' ')
      .trim();
    
    // Normalize alif variants (أ, إ, آ, ا) to standard ا
    normalized = normalized
      .replace(/[أإآ]/g, 'ا')
      .replace(/\s+/g, ' ')
      .trim();
    
    return normalized;
  };

  // Extract Arabic chunk directly from verse (no transliteration needed)
  // This MUST match exactly the chunk shown to the user in HomeScreen
  // Uses the shared utility function - SINGLE SOURCE OF TRUTH
  const extractArabicChunkFromVerse = (
    arabicVerse: string,
    chunkIndex: number
  ): { arabicSegment: string; expectedHash: string; chunkWords: string[]; error?: 'chunk_not_found' } => {
    if (!arabicVerse) {
      return { arabicSegment: '', expectedHash: '', chunkWords: [], error: 'chunk_not_found' };
    }
    
    // Use the shared utility function - same as HomeScreen.getCurrentChunk()
    const arabicSegment = getChunkString(arabicVerse, chunkIndex, 8);
    
    if (!arabicSegment) {
      return { arabicSegment: '', expectedHash: '', chunkWords: [], error: 'chunk_not_found' };
    }
    
    // Calculate hash for verification (must match HomeScreen)
    const expectedHash = calculateExpectedHash(arabicSegment);
    
    // Extract words from the chunk for scoring
    // Split exactly as displayed (preserve spacing)
    const chunkWords = arabicSegment.trim().split(/\s+/).filter(w => w.length > 0);
    
    console.log(`[EXTRACT] Chunk ${chunkIndex + 1}:`);
    console.log(`[EXTRACT] Full Arabic verse:`, arabicVerse);
    console.log(`[EXTRACT] Extracted Arabic chunk (EXACT string from getChunkString):`, arabicSegment);
    console.log(`[EXTRACT] Expected chunk hash:`, expectedHash);
    console.log(`[EXTRACT] Chunk length:`, arabicSegment.length, 'chars');
    console.log(`[EXTRACT] Core expected words (${chunkWords.length} words):`, chunkWords.join(' | '));
    console.log(`[EXTRACT] ✅ This IS the EXACT same chunk shown in HomeScreen`);
    console.log(`[EXTRACT] ✅ Hash verification: HomeScreen hash MUST match:`, expectedHash);
    
    return { arabicSegment, expectedHash, chunkWords };
  };

  const loadVerseChunk = (surah: number, ayah: number, chunkIndex: number) => {
    // Find verse using helper function
    const verse = getVerseBySurahAndAyah(quranData, surah, ayah);
    if (verse) {
      // Extract Arabic chunk directly (no transliteration needed)
      const extractionResult = extractArabicChunkFromVerse(verse.ayah_ar, chunkIndex);
      
      // Check for extraction error
      if (extractionResult.error) {
        console.error('[LOAD] Failed to extract Arabic chunk for chunk index:', chunkIndex);
        // Set empty text and show error
        setVerseText('');
        setCoreExpectedWords([]);
        setExpectedChunkHash('');
        setFullVerseEnglish(getVerseTranslation(surah, ayah));
        return;
      }
      
      // Set the Arabic chunk for comparison
      // IMPORTANT: verseText and coreExpectedWords must match what HomeScreen displays
      setVerseText(extractionResult.arabicSegment);
      setExpectedChunkHash(extractionResult.expectedHash);
      setCoreExpectedWords(extractionResult.chunkWords); // Set from extraction result
      setFullVerseEnglish(getVerseTranslation(surah, ayah));
      
      // Verify hash matches HomeScreen (they should use same getChunkString function)
      const homeScreenChunk = getChunkString(verse.ayah_ar, chunkIndex, 8);
      const homeScreenHash = calculateExpectedHash(homeScreenChunk);
      const hashMatches = extractionResult.expectedHash === homeScreenHash;
      
      // Print expected verse for testing
      console.log('=== EXPECTED VERSE VERIFICATION ===');
      console.log('Surah:', surah, 'Ayah:', ayah, 'Chunk:', chunkIndex + 1);
      console.log('Full Arabic verse:', verse.ayah_ar);
      console.log('Expected chunk (TestScreen):', extractionResult.arabicSegment);
      console.log('Expected chunk hash (TestScreen):', extractionResult.expectedHash);
      console.log('Expected chunk (HomeScreen):', homeScreenChunk);
      console.log('Expected chunk hash (HomeScreen):', homeScreenHash);
      console.log('Hash match:', hashMatches);
      if (!hashMatches) {
        console.error('❌ ERROR: Hash mismatch! Chunks may be different!');
        console.error('TestScreen chunk:', JSON.stringify(extractionResult.arabicSegment));
        console.error('HomeScreen chunk:', JSON.stringify(homeScreenChunk));
        Alert.alert(
          'Chunk Mismatch',
          'Expected chunk does not match HomeScreen. Cannot proceed with scoring.'
        );
        return;
      } else {
        console.log('✅ Hash verification passed - chunks match!');
      }
      // Use the chunkWords from extraction result instead of state (which may not have updated yet)
      console.log('Core expected words:', extractionResult.chunkWords);
      console.log('===================================');
    }
  };

  const saveProgress = async (surah: number, ayah: number, chunkIndex: number = 0) => {
    try {
      await AsyncStorage.setItem('currentSurah', surah.toString());
      await AsyncStorage.setItem('currentAyah', ayah.toString());
      await AsyncStorage.setItem('currentChunkIndex', chunkIndex.toString());
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const incrementMemorizedVerses = async () => {
    try {
      const currentCount = await AsyncStorage.getItem('memorizedVersesCount');
      const newCount = (currentCount ? parseInt(currentCount) : 0) + 1;
      await AsyncStorage.setItem('memorizedVersesCount', newCount.toString());
      console.log(`Memorized verses count: ${newCount}`);
    } catch (error) {
      console.error('Error incrementing memorized verses:', error);
    }
  };

  // Get Arabic verse and split into chunks
  const getArabicVerseChunks = (surahNo: number, ayahNo: number): string[] => {
    try {
      const verse = getVerseBySurahAndAyah(quranData, surahNo, ayahNo);
      if (verse && verse.ayah_ar) {
        return splitArabicVerseIntoChunks(verse.ayah_ar, 8);
      }
    } catch (error) {
      console.error('Error getting Arabic verse chunks:', error);
    }
    return [];
  };

  const loadCurrentVerse = () => {
    // Use the helper function to load verse chunk
    loadVerseChunk(currentSurah, currentAyah, currentChunkIndex);
  };

  const normalizeArabic = (text: string): string => {
    if (!text) return '';
    
    // Remove all diacritics (tashkeel/harakat), remove punctuation, remove tatweel (ـ)
    // Unify أ/إ/آ → ا, normalize ى → ي, optionally normalize ة → ه, ؤ/ئ → و/ي
    // Remove Quran stop marks مثل ۚ ۗ
    return text
      .replace(/[\u064B-\u065F\u0670]/g, '') // Remove Arabic diacritics (tashkeel/harakat)
      .replace(/[\u0610-\u061A\u0640]/g, '') // Remove additional diacritics and tatweel (ـ)
      .replace(/أ|إ|آ/g, 'ا') // Unify alif variants (أ/إ/آ → ا)
      .replace(/ى/g, 'ي') // Normalize alef maksura (ى → ي)
      .replace(/ة/g, 'ه') // Optional: normalize ta marbuta (ة → ه)
      .replace(/ؤ/g, 'و') // Optional: normalize hamza on waw (ؤ → و)
      .replace(/ئ/g, 'ي') // Optional: normalize hamza on ya (ئ → ي)
      .replace(/[\u06D6-\u06ED]/g, '') // Remove Quran stop marks (ۚ ۗ ۖ ۘ ۙ ۛ ۜ etc.)
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]'"<>?،؛]/g, '') // Remove punctuation
      .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]/g, '') // Keep only Arabic characters and spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };

  // Loose normalization for lenient matching (handles Whisper's imperfect transcriptions)
  const normalizeArabicLoose = (text: string): string => {
    if (!text) return '';
    
    let normalized = text
      .replace(/[\u064B-\u065F\u0670]/g, '') // Remove diacritics (tashkeel/harakat)
      .replace(/[\u0610-\u061A\u0640]/g, '') // Remove additional diacritics and tatweel (ـ)
      .replace(/[\u06D6-\u06ED]/g, '') // Remove Quran stop marks
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]'"<>?،؛]/g, '') // Remove punctuation
      .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]/g, '') // Keep only Arabic characters and spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Normalize alif variants: أ/إ/آ/ٱ → ا
    normalized = normalized.replace(/[أإآٱ]/g, 'ا');
    
    // Normalize other variants
    normalized = normalized.replace(/ى/g, 'ي'); // alef maksura
    normalized = normalized.replace(/\u06CC/g, '\u064A'); // Persian ی (U+06CC) -> Arabic ي (U+064A)
    normalized = normalized.replace(/ة/g, 'ه'); // ta marbuta
    normalized = normalized.replace(/ؤ/g, 'و'); // hamza on waw
    normalized = normalized.replace(/ئ/g, 'ي'); // hamza on ya
    
    // Remove hamza entirely: ء
    normalized = normalized.replace(/ء/g, '');
    
    // Collapse repeated letters (e.g., "مم" → "م")
    normalized = normalized.replace(/(.)\1+/g, '$1');
    
    // Strip common prefixes repeatedly
    const prefixes = ["ال", "و", "ف", "ب", "ك", "ل", "س"];
    let changed = true;
    while (changed) {
      changed = false;
      for (const prefix of prefixes) {
        if (normalized.startsWith(prefix) && normalized.length > prefix.length) {
          normalized = normalized.substring(prefix.length);
          changed = true;
        }
      }
    }
    
    // Strip common suffixes repeatedly
    const suffixes = ["ه", "هم", "كما", "كم", "نا", "ي", "ك", "ون", "ين", "ات", "ة", "ا", "ان"];
    changed = true;
    while (changed) {
      changed = false;
      for (const suffix of suffixes) {
        if (normalized.endsWith(suffix) && normalized.length > suffix.length) {
          normalized = normalized.substring(0, normalized.length - suffix.length);
          changed = true;
        }
      }
    }
    
    return normalized.trim();
  };

  // Get consonant skeleton (remove vowels: ا, و, ي)
  const getConsonantSkeleton = (text: string): string => {
    if (!text) return '';
    const looseNormalized = normalizeArabicLoose(text);
    // Remove vowel-like letters: ا, و, ي
    return looseNormalized.replace(/[اوي]/g, '');
  };

  // Simple Levenshtein distance calculation
  const levenshteinDistance = (str1: string, str2: string): number => {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,     // deletion
            dp[i][j - 1] + 1,     // insertion
            dp[i - 1][j - 1] + 1  // substitution
          );
        }
      }
    }

    return dp[m][n];
  };

  // Calculate simple similarity between two words using Levenshtein distance (0-1)
  // Returns value in [0..1] range, clamped to prevent any value > 1
  const calculateWordSimilarity = (word1: string, word2: string): number => {
    if (word1 === word2) return 1.0;
    
    const len1 = word1.length;
    const len2 = word2.length;
    
    if (len1 === 0 && len2 === 0) return 1.0;
    if (len1 === 0 || len2 === 0) return 0.0;
    
    // Use simple Levenshtein distance
    const distance = levenshteinDistance(word1, word2);
    const maxLen = Math.max(len1, len2);
    
    // Prevent division by zero
    if (maxLen === 0) return 1.0;
    
    // Calculate similarity: 1 - (distance / maxLen)
    // This gives [0..1] where 1 = identical, 0 = completely different
    const similarity = 1 - (distance / maxLen);
    
    // Clamp to [0..1] to ensure no value exceeds 1
    const clamped = Math.max(0, Math.min(1, similarity));
    
    // Debug output for values > 1 (should never happen)
    if (similarity > 1 || similarity < 0) {
      console.warn('[SIMILARITY] Raw value out of range:', {
        word1,
        word2,
        len1,
        len2,
        distance,
        maxLen,
        rawSimilarity: similarity,
        clamped
      });
    }
    
    return clamped;
  };

  // Calculate phrase similarity using Levenshtein ratio (similar to SequenceMatcher ratio)
  // Returns value in [0..1] range
  const calculatePhraseSimilarity = (phrase1: string, phrase2: string): number => {
    if (phrase1 === phrase2) return 1.0;
    
    const len1 = phrase1.length;
    const len2 = phrase2.length;
    
    if (len1 === 0 && len2 === 0) return 1.0;
    if (len1 === 0 || len2 === 0) return 0.0;
    
    // Use Levenshtein distance for phrase-level comparison
    const distance = levenshteinDistance(phrase1, phrase2);
    const maxLen = Math.max(len1, len2);
    
    // Prevent division by zero
    if (maxLen === 0) return 1.0;
    
    // Calculate similarity ratio: 1 - (distance / maxLen)
    // This gives [0..1] where 1 = identical, 0 = completely different
    const similarity = 1 - (distance / maxLen);
    
    // Clamp to [0..1]
    return Math.max(0, Math.min(1, similarity));
  };

  // Select 2-3 anchor words from core words (prefer distinctive ones, length>=4, avoid stop-words)
  const selectAnchorWords = (coreWords: string[]): string[] => {
    if (coreWords.length === 0) return [];
    
    // Stop words to avoid
    const stopWords = new Set(['لا', 'من', 'في', 'هم', 'هو', 'هي', 'أن', 'إن', 'ما', 'ال', 'و', 'ف', 'ب', 'ل', 'ك']);
    
    // Prefer distinctive words (longer, more unique patterns)
    // Common distinctive patterns in Quranic Arabic
    const distinctivePatterns = [
      'يرجعون', 'يبصرون', 'يسمعون', 'يعلمون', 'يعملون', 'يخشون', 'يعبدون',
      'المغضوب', 'الضالين', 'الصراط', 'المستقيم', 'المؤمنين', 'الكافرين',
      'الرحمن', 'الرحيم', 'الملك', 'القدوس', 'العظيم', 'الحكيم'
    ];
    
    // Filter and score words
    const scoredWords = coreWords
      .map(word => {
        const normalized = normalizeArabic(word);
        
        // Skip stop words
        if (stopWords.has(normalized)) {
          return null;
        }
        
        // Only consider words with length >= 4 after normalization
        if (normalized.length < 4) {
          return null;
        }
        
        let score = normalized.length; // Longer words are more distinctive
        
        // Bonus for matching distinctive patterns
        if (distinctivePatterns.some(pattern => normalized.includes(pattern) || pattern.includes(normalized))) {
          score += 10;
        }
        
        return { word, normalized, score };
      })
      .filter((item): item is { word: string; normalized: string; score: number } => item !== null);
    
    // Sort by score (descending) and take top 2-3
    scoredWords.sort((a, b) => b.score - a.score);
    const anchorCount = Math.min(3, Math.max(2, scoredWords.length)); // 2-3 anchors
    const anchors = scoredWords.slice(0, anchorCount).map(item => item.word);
    
    // If we don't have enough after filtering, include remaining core words (even if short)
    if (anchors.length < 2 && coreWords.length > 0) {
      const remaining = coreWords.filter(w => !anchors.includes(w));
      anchors.push(...remaining.slice(0, 2 - anchors.length));
    }
    
    return anchors;
  };

  // Compare words and return scores for each word (0-1) - order-independent
  const compareWords = (transcribed: string, expected: string): Array<{word: string, score: number}> => {
    const normalizedTranscribed = normalizeArabic(transcribed);
    const normalizedExpected = normalizeArabic(expected);
    
    // Split into words (Arabic text splits on spaces)
    const transcribedWords = normalizedTranscribed.split(/\s+/).filter(w => w.length > 0);
    const expectedWords = normalizedExpected.split(/\s+/).filter(w => w.length > 0);
    
    const result: Array<{word: string, score: number}> = [];
    const matchedIndices = new Set<number>();
    
    // For each expected word, find best match anywhere in transcribed text (order-independent)
    expectedWords.forEach((expectedWord) => {
      let bestScore = 0;
      let bestIndex = -1;
      
      // Search entire transcribed text for best match (order doesn't matter)
      transcribedWords.forEach((transcribedWord, transcribedIndex) => {
        // Skip if this transcribed word was already matched to another expected word
        if (matchedIndices.has(transcribedIndex)) return;
        
        const score = calculateWordSimilarity(transcribedWord, expectedWord);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = transcribedIndex;
        }
      });
      
      // Mark this transcribed word as matched if we found a good match
      if (bestIndex >= 0 && bestScore > 0.5) {
        matchedIndices.add(bestIndex);
      }
      
      result.push({
        word: expectedWord,
        score: bestScore
      });
    });
    
    return result;
  };

  // Keyword coverage scoring system (lenient "generally correct" detection)
  const calculateSimilarityWithDetails = (
    text1: string, 
    text2: string, 
    coreExpectedWords: string[] = []
  ): { score: number; phraseScore: number; anchorHit: boolean; status: 'PASS' | 'GOOD' | 'EXCELLENT' | 'FAIL' } => {
    // text1 = transcribed (Whisper output)
    // text2 = expected (Quran verse - may include context words)
    const normalizedWhisper = normalizeArabic(text1);
    const normalizedExpected = normalizeArabic(text2);
    
    if (normalizedWhisper.length === 0) {
      return { score: 0, phraseScore: 0, anchorHit: false, status: 'FAIL' };
    }
    if (normalizedExpected.length === 0) {
      return { score: 100, phraseScore: 1.0, anchorHit: true, status: 'EXCELLENT' }; // No expected words = perfect
    }
    
    // Stopwords to filter out
    const stopwords = new Set([
      "و", "ف", "ثم", "من", "في", "على", "الى", "إلى", "لا", "ما", "قد", 
      "إن", "ان", "أن", "لن", "لم", "لما", "به", "ب", "ك", "ل", 
      "الذي", "التى", "الذين", "اللاتي", "هذا", "هذه"
    ]);
    
    // Easy anchor words that Whisper handles well
    const easyAnchors = new Set(["ظلمات", "رعد", "برق", "موت", "سماء", "صيب"]);
    
    // Build expected keywords (smarter selection)
    const expectedTokens = normalizedExpected.split(/\s+/).filter(w => w.length > 0);
    
    // First, collect easy anchors if present
    const foundEasyAnchors: string[] = [];
    expectedTokens.forEach(token => {
      const looseNormalized = normalizeArabicLoose(token);
      if (easyAnchors.has(looseNormalized) || easyAnchors.has(token)) {
        foundEasyAnchors.push(token);
      }
    });
    
    // Build candidate keywords
    const candidateKeywords = expectedTokens
      .filter(token => {
        if (stopwords.has(token)) return false;
        const looseNormalized = normalizeArabicLoose(token);
        if (looseNormalized.length < 4) return false;
        
        // Prefer tokens NOT containing hamza and NOT too many uncommon letters
        const hasHamza = token.includes('ء') || token.includes('أ') || token.includes('إ') || token.includes('آ');
        // Count uncommon letters (you can refine this)
        const uncommonLetterCount = (token.match(/[ظضذثص]/g) || []).length;
        
        // Prefer tokens without hamza and with fewer uncommon letters
        return !hasHamza || uncommonLetterCount < 2;
      })
      .map(token => ({
        original: token,
        loose: normalizeArabicLoose(token),
        length: normalizeArabicLoose(token).length,
        isEasyAnchor: foundEasyAnchors.includes(token)
      }));
    
    // Sort by: easy anchors first, then by length (longest first), then by rarity
    candidateKeywords.sort((a, b) => {
      if (a.isEasyAnchor && !b.isEasyAnchor) return -1;
      if (!a.isEasyAnchor && b.isEasyAnchor) return 1;
      return b.length - a.length;
    });
    
    // Select keywords: include up to 3 easy anchors, then fill up to 8 total
    const selectedKeywords: string[] = [];
    
    // Add easy anchors (up to 3)
    const easyAnchorsToAdd = foundEasyAnchors.slice(0, 3);
    easyAnchorsToAdd.forEach(anchor => {
      if (!selectedKeywords.includes(anchor)) {
        selectedKeywords.push(anchor);
      }
    });
    
    // Add other candidates up to 8 total
    for (const candidate of candidateKeywords) {
      if (selectedKeywords.length >= 8) break;
      if (!selectedKeywords.includes(candidate.original)) {
        selectedKeywords.push(candidate.original);
      }
    }
    
    const finalExpectedKeywords = selectedKeywords;
    
    // Tokenize whisper output
    const whisperTokens = normalizedWhisper.split(/\s+/).filter(w => w.length > 0);
    
    if (finalExpectedKeywords.length === 0) {
      // No keywords to match - consider it a pass if there's any whisper output
      const status = normalizedWhisper.length > 0 ? 'PASS' : 'FAIL';
      return { score: normalizedWhisper.length > 0 ? 100 : 0, phraseScore: normalizedWhisper.length > 0 ? 1.0 : 0, anchorHit: normalizedWhisper.length > 0, status };
    }
    
    // For each expected keyword, find best match using loose normalization + skeleton matching
    const matchedKeywords: Array<{ 
      keyword: string; 
      matched: string; 
      looseSimilarity: number; 
      skeletonSimilarity: number; 
      matchRule: 'loose' | 'skeleton' | 'substring' 
    }> = [];
    const usedWhisperIndices = new Set<number>();
    
    finalExpectedKeywords.forEach((expectedKeyword) => {
      const expectedLoose = normalizeArabicLoose(expectedKeyword);
      const expectedSkeleton = getConsonantSkeleton(expectedKeyword);
      
      let bestLooseSimilarity = 0;
      let bestSkeletonSimilarity = 0;
      let bestWhisperIndex = -1;
      let bestWhisperWord = '';
      let matchRule: 'loose' | 'skeleton' | 'substring' = 'loose';
      
      // Check against all whisper tokens
      whisperTokens.forEach((whisperWord, whisperIndex) => {
        if (usedWhisperIndices.has(whisperIndex)) return;
        
        const whisperLoose = normalizeArabicLoose(whisperWord);
        const whisperSkeleton = getConsonantSkeleton(whisperWord);
        
        // Compute loose similarity
        const looseSim = calculateWordSimilarity(expectedLoose, whisperLoose);
        
        // Compute skeleton similarity
        const skeletonSim = expectedSkeleton.length > 0 && whisperSkeleton.length > 0
          ? calculateWordSimilarity(expectedSkeleton, whisperSkeleton)
          : 0;
        
        // Check substring match
        const isSubstringMatch = expectedLoose.includes(whisperLoose) || whisperLoose.includes(expectedLoose);
        
        // Determine if this is a better match
        const isMatch = looseSim >= 0.60 || skeletonSim >= 0.55 || isSubstringMatch;
        
        if (isMatch) {
          let currentBest = Math.max(looseSim, skeletonSim);
          if (isSubstringMatch) currentBest = Math.max(currentBest, 0.60);
          
          const existingBest = Math.max(bestLooseSimilarity, bestSkeletonSimilarity);
          
          if (currentBest > existingBest) {
            bestLooseSimilarity = looseSim;
            bestSkeletonSimilarity = skeletonSim;
            bestWhisperIndex = whisperIndex;
            bestWhisperWord = whisperWord;
            
            // Determine which rule matched
            if (isSubstringMatch) {
              matchRule = 'substring';
            } else if (skeletonSim >= 0.55) {
              matchRule = 'skeleton';
            } else {
              matchRule = 'loose';
            }
          }
        }
      });
      
      // Accept match if we found a best match that meets criteria
      // Criteria: looseSimilarity >= 0.60 OR skeletonSimilarity >= 0.55 OR substring match
      const bestWhisperLoose = bestWhisperWord ? normalizeArabicLoose(bestWhisperWord) : '';
      const finalIsSubstringMatch = bestWhisperLoose && (
        expectedLoose.includes(bestWhisperLoose) || 
        bestWhisperLoose.includes(expectedLoose)
      );
      const finalIsMatch = bestLooseSimilarity >= 0.60 || bestSkeletonSimilarity >= 0.55 || finalIsSubstringMatch;
      
      if (finalIsMatch && bestWhisperIndex >= 0) {
        usedWhisperIndices.add(bestWhisperIndex);
        matchedKeywords.push({
          keyword: expectedKeyword,
          matched: bestWhisperWord,
          looseSimilarity: bestLooseSimilarity,
          skeletonSimilarity: bestSkeletonSimilarity,
          matchRule
        });
      }
    });
    
    // Compute coverage
    const matchCount = matchedKeywords.length;
    const keywordCount = finalExpectedKeywords.length;
    const coverage = keywordCount > 0 ? matchCount / keywordCount : 0;
    
    // Determine status (more lenient pass rules)
    let status: 'PASS' | 'GOOD' | 'EXCELLENT' | 'FAIL';
    
    // Minimum matched keywords rule for short lists
    const minMatched = Math.max(2, Math.ceil(keywordCount * 0.25));
    
    if (coverage >= 0.50) {
      status = 'EXCELLENT';
    } else if (coverage >= 0.35) {
      status = 'GOOD';
    } else if (coverage >= 0.25 || matchCount >= minMatched) {
      status = 'PASS';
    } else {
      status = 'FAIL';
    }
    
    const passed = status !== 'FAIL';
    const score = coverage * 100; // Convert coverage to percentage score
    
    // Log comprehensive details
    console.log('[SCORING] ========== KEYWORD COVERAGE SCORING (LENIENT) ==========');
    console.log('[SCORING] Expected keywords:', finalExpectedKeywords.map(k => `${k} (loose: ${normalizeArabicLoose(k)}, skeleton: ${getConsonantSkeleton(k)})`).join(' | '));
    console.log('[SCORING] Whisper tokens:', whisperTokens.map(t => `${t} (loose: ${normalizeArabicLoose(t)}, skeleton: ${getConsonantSkeleton(t)})`).join(' | '));
    console.log('[SCORING] Matched keywords:');
    matchedKeywords.forEach((match, idx) => {
      const expectedLoose = normalizeArabicLoose(match.keyword);
      const expectedSkeleton = getConsonantSkeleton(match.keyword);
      const matchedLoose = normalizeArabicLoose(match.matched);
      const matchedSkeleton = getConsonantSkeleton(match.matched);
      console.log(`  ${idx + 1}. ✓ "${match.keyword}" → "${match.matched}"`);
      console.log(`      Loose: "${expectedLoose}" ≈ "${matchedLoose}" (${(match.looseSimilarity * 100).toFixed(1)}%)`);
      console.log(`      Skeleton: "${expectedSkeleton}" ≈ "${matchedSkeleton}" (${(match.skeletonSimilarity * 100).toFixed(1)}%)`);
      console.log(`      Match rule: ${match.matchRule}`);
    });
    console.log(`[SCORING] Match count: ${matchCount} / ${keywordCount}`);
    console.log(`[SCORING] Coverage: ${(coverage * 100).toFixed(1)}%`);
    console.log(`[SCORING] Minimum matched required: ${minMatched}`);
    console.log(`[SCORING] Status: ${status}`);
    console.log('[SCORING] ========================================================');
    
    // Return score and pass status
    return {
      score: Math.max(0, Math.min(100, score)),
      phraseScore: coverage,
      anchorHit: passed,
      status
    };
  };

  // Calculate overall similarity using word-hit system
  const calculateSimilarity = (text1: string, text2: string, coreExpectedWords: string[] = []): number => {
    const result = calculateSimilarityWithDetails(text1, text2, coreExpectedWords);
    return result.score;
  };

  // Single transcription - exactly one Whisper request per recording
  // Enhanced with initial_prompt for better Quran recitation accuracy
  const transcribeAudio = async (
    audioUri: string, 
    expectedChunk?: string,
    fileSizeKB?: number,
    durationSeconds?: number,
    sampleRate?: number
  ): Promise<string> => {
    try {
      // Check server health first
      const health = await whisperServerService.checkHealth();
      
      if (!health.healthy) {
        throw new Error(
          'Whisper server is not available. Please check:\n' +
          `1. Server is running at ${whisperServerService.getServerUrl()}\n` +
          '2. Your device has internet connection\n' +
          '3. Server URL is correct in app configuration'
        );
      }

      if (!health.modelLoaded) {
        throw new Error(
          'Whisper model is not loaded on the server. Please check server logs.'
        );
      }

      // Prepare initial prompt if expected chunk is provided
      let initialPrompt: string | undefined;
      if (expectedChunk) {
        // Normalize expected chunk for prompt
        const { normalizeArabicForCompare } = require('../recitation/arabicCompare');
        const normalizedExpected = normalizeArabicForCompare(expectedChunk);
        initialPrompt = `تلاوة قرآنية بالرسم العثماني (حفص). النص المتوقع: ${normalizedExpected}`;
        console.log('[TRANSCRIBE] Using initial prompt for better accuracy');
        console.log('[TRANSCRIBE] Normalized expected chunk:', normalizedExpected);
      }

      // Use Whisper server to transcribe with retry logic
      // Pass file size, duration, and sampleRate for logging and headers
      const transcription = await whisperServerService.transcribe(
        audioUri, 
        {
        language: 'ar',
        task: 'transcribe',
          initialPrompt,
        },
        fileSizeKB,
        durationSeconds,
        sampleRate
      );
      
      console.log('[TRANSCRIBE] Transcription result:', transcription);
      return transcription;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[TRANSCRIBE] Transcription error:', error);
      throw new Error(`Transcription failed: ${errorMessage}`);
    }
  };

  const startRecording = async () => {
    try {
      console.log('Requesting microphone permission...');
      const permission = await Audio.requestPermissionsAsync();
      console.log('Permission result:', permission);
      
      if (!permission.granted) {
        Alert.alert(
          'Permission Required', 
          'Microphone permission is required to record audio. Please enable it in your device settings.'
        );
        return;
      }

      console.log('Setting audio mode...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      console.log('Creating recording...');
      // Configure for M4A (AAC-LC) format: compressed, faster upload/processing
      // Record directly to M4A/AAC-LC mono - NO WAV conversion on client side
      // Settings: mono, 16kHz, AAC-LC, 64kbps (optimal for speech)
      // Server receives M4A and handles format conversion internally for processing
      const { recording } = await Audio.Recording.createAsync(
        {
          android: {
            extension: '.m4a',
            // Use MPEG_4 format with AAC encoder for compressed audio
            // AAC encoder defaults to AAC-LC profile for speech at low bitrates
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 16000, // 16kHz sample rate (required by Whisper)
            numberOfChannels: 1, // Mono channel (required by Whisper)
            bitRate: 64000, // 64 kbps AAC-LC - optimal bitrate for speech
          },
          ios: {
            extension: '.m4a',
            // iOS uses MPEG4AAC for compressed audio
            // MPEG4AAC defaults to AAC-LC profile for speech
            outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 16000, // 16kHz sample rate (required by Whisper)
            numberOfChannels: 1, // Mono channel (required by Whisper)
            bitRate: 64000, // 64 kbps AAC-LC - optimal bitrate for speech
          },
          web: {
            mimeType: 'audio/mp4', // M4A format (MP4 container with AAC-LC)
            bitsPerSecond: 64000, // 64 kbps AAC-LC
          },
        }
      );

      console.log('Recording started successfully');
      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to start recording:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      Alert.alert(
        'Recording Error', 
        `Failed to start recording: ${errorMessage}\n\nPlease check:\n1. Microphone permission is granted\n2. No other app is using the microphone\n3. Try restarting the app`
      );
    }
  };

  const stopRecording = async () => {
    if (!recording) {
      console.warn('No recording to stop');
      return;
    }

    try {
      console.log('Stopping recording...');
      setIsRecording(false);
      setIsProcessing(true);
      
      // Get recording status BEFORE stopping to get durationMillis
      let recordingDurationMillis = 0;
      try {
        const status = await recording.getStatusAsync();
        if (status.isRecording === false && status.durationMillis) {
          recordingDurationMillis = status.durationMillis;
          console.log(`[RECORDING] Duration from getStatusAsync: ${recordingDurationMillis}ms`);
        }
      } catch (error) {
        console.warn('Could not get recording status:', error);
      }
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      console.log('Recording URI:', uri);
      
      if (!uri) {
        throw new Error('No recording URI - recording may have failed');
      }

      // Check if file exists and get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('Recording file info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('Recording file does not exist');
      }

      // Get file size in KB
      const fileSizeKB = fileInfo.size ? Math.round(fileInfo.size / 1024) : 0;

      // Get recording duration in seconds - try multiple methods
      let durationSeconds = 0;
      let durationMillis = recordingDurationMillis;

      // Method 1: Use recording status durationMillis (most accurate)
      if (durationMillis > 0) {
        durationSeconds = durationMillis / 1000;
        console.log(`[RECORDING] Using duration from getStatusAsync: ${durationSeconds.toFixed(2)}s`);
      } else {
        // Method 2: Fallback to Sound metadata
        try {
          const { Sound } = Audio;
          const sound = new Sound(uri, undefined, (error) => {
            if (error) {
              console.warn('Could not load sound for duration:', error);
            }
          });
          await sound.loadAsync();
          const soundStatus = await sound.getStatusAsync();
          if (soundStatus.isLoaded && soundStatus.durationMillis) {
            durationMillis = soundStatus.durationMillis;
            durationSeconds = durationMillis / 1000;
            console.log(`[RECORDING] Using duration from Sound metadata: ${durationSeconds.toFixed(2)}s`);
          }
          await sound.unloadAsync();
        } catch (error) {
          console.warn('Could not get audio duration from Sound:', error);
        }
      }

      // Validate duration - reject if recording is too long (> 16 seconds)
      const MAX_DURATION_MS = 16000; // 16 seconds max
      if (durationMillis > MAX_DURATION_MS) {
        const errorMsg = `Recording too long: ${durationSeconds.toFixed(2)}s (max ${MAX_DURATION_MS / 1000}s)`;
        console.error(`[RECORDING] ${errorMsg}`);
        Alert.alert(
          'Recording Too Long',
          errorMsg + '\n\nPlease record a shorter audio clip.'
        );
        setIsProcessing(false);
        setIsRecordingFinished(true);
        return;
      }

      // Validate minimum duration (at least 0.5 seconds)
      const MIN_DURATION_MS = 500;
      if (durationMillis > 0 && durationMillis < MIN_DURATION_MS) {
        const errorMsg = `Recording too short: ${durationSeconds.toFixed(2)}s (min ${MIN_DURATION_MS / 1000}s)`;
        console.error(`[RECORDING] ${errorMsg}`);
        Alert.alert(
          'Recording Too Short',
          errorMsg + '\n\nPlease record a longer audio clip.'
        );
        setIsProcessing(false);
        setIsRecordingFinished(true);
        return;
      }

      // Log real duration and file info
      console.log('Starting transcription...');
      console.log('Audio file URI:', uri);
      console.log('Expected verse text:', verseText);
      console.log(`[RECORDING] File size: ${fileSizeKB} KB`);
      console.log(`[RECORDING] Duration: ${durationSeconds.toFixed(2)}s (${durationMillis}ms)`);
      console.log(`[RECORDING] Format: M4A/AAC-LC (mono, 16kHz, 64kbps)`);
      
      // Confirm settings before upload
      if (fileSizeKB === 0) {
        throw new Error('Recording file is empty');
      }
      if (durationSeconds === 0) {
        console.warn('[RECORDING] Duration is 0 - proceeding anyway, but duration may be inaccurate');
      }
      
      // Single transcription - exactly one Whisper request
      // Pass expected chunk for initial_prompt to improve accuracy
      // Pass file size, duration, and sampleRate for logging and headers
      const transcription = await transcribeAudio(
        uri, 
        verseText, 
        fileSizeKB, 
        durationSeconds,
        16000 // sampleRate: 16kHz
      );
      console.log('Transcription received from Whisper:', transcription);
      
      if (!transcription || transcription.trim().length === 0) {
        console.warn('Empty transcription - Whisper may not be working');
        Alert.alert(
          'Transcription Failed',
          'Could not transcribe audio. This may be because:\n\n' +
          '1. Whisper model is not loaded\n' +
          '2. Audio quality is too poor\n' +
          '3. Development build is required (not Expo Go)\n\n' +
          'Please check the console logs for more details.'
        );
        setTestResult('fail');
        setTestStatus('FAIL');
        setTestStatus('FAIL');
        setTranscribedText('');
        setIsRecordingFinished(true);
        return;
      }

      setTranscribedText(transcription);

      // Check if extraction failed (empty verseText or no core words)
      if (!verseText || verseText.trim().length === 0 || coreExpectedWords.length === 0) {
        console.error('[SCORE] Cannot score: extraction failed or no core words');
        Alert.alert(
          'Scoring Error',
          'Could not extract Arabic segment for this chunk. Please try a different chunk or verse.'
        );
        setTestResult('fail');
        setTestStatus('FAIL');
        setTranscribedText(transcription);
        setIsRecordingFinished(true);
        return;
      }
      
      // Hash verification: ensure expected chunk matches HomeScreen
      const currentExpectedHash = calculateExpectedHash(verseText);
      if (expectedChunkHash && currentExpectedHash !== expectedChunkHash) {
        console.error('[SCORE] Hash mismatch! Expected chunk may have changed.');
        console.error('Stored hash:', expectedChunkHash);
        console.error('Current hash:', currentExpectedHash);
        Alert.alert(
          'Verification Error',
          'Expected chunk verification failed. Cannot proceed with scoring.'
        );
        setTestResult('fail');
        setTestStatus('FAIL');
        setIsRecordingFinished(true);
        return;
      }
      
      // Use new robust comparison system
      const compareResult = compareRecitation(verseText, transcription, expectedChunkHash);
      
      // Get percentage from debug info (uses the new matched count mapping)
      const percent = compareResult.debug.percent !== undefined 
        ? compareResult.debug.percent 
        : Math.round(compareResult.score * 100);
      const passed = compareResult.pass;
      
      // Map score to status labels with color coding
      // >=0.90 green, 0.60-0.90 yellow, <0.60 red
      // But PASS/FAIL uses rule from compareRecitation, not color alone
      let status: 'PASS' | 'GOOD' | 'EXCELLENT' | 'FAIL';
      if (compareResult.score >= 0.90) {
        status = 'EXCELLENT'; // Green
      } else if (compareResult.score >= 0.60) {
        status = passed ? 'PASS' : 'GOOD'; // Yellow if pass, otherwise good
      } else {
        status = 'FAIL'; // Red
      }
      
      // Override: if comparison says pass but score is low, still show PASS
      if (passed && status === 'FAIL') {
        status = 'PASS';
      }
      
      // Update word comparison for highlighting
      const wordDiff = compareWords(transcription, verseText);
      setWordComparison(wordDiff);
      setSimilarityScore(percent);
      
      // Detailed logging
      console.log('=== RECITATION COMPARISON ===');
      console.log('Expected chunk (display):', verseText);
      console.log('Expected chunk hash:', compareResult.debug.expectedHash);
      console.log('Expected tokens:', compareResult.expectedTokens);
      console.log('Transcript (display):', transcription);
      console.log('Transcript hash:', compareResult.debug.transcriptHash);
      console.log('Transcript tokens:', compareResult.transcriptTokens);
      console.log('Matched pairs:', compareResult.matched.length);
      compareResult.matched.forEach(match => {
        console.log(`  "${match.expectedWord}" <-> "${match.transcriptWord}" (${match.method}, sim=${match.sim.toFixed(3)})`);
      });
      console.log(`Matched: ${compareResult.debug.matchedCount}/${compareResult.debug.expectedCount} words`);
      console.log(`Weighted score: ${compareResult.debug.matchedWeight}/${compareResult.debug.totalWeight} = ${compareResult.score.toFixed(3)}`);
      console.log(`Score percent: ${percent}% (from matched count mapping)`);
      console.log(`Status: ${status}`);
      console.log(`Pass: ${passed}`);
      console.log(`Pass reason: ${compareResult.debug.passReason}`);
      if (compareResult.debug.failReason) {
        console.log(`Fail reason: ${compareResult.debug.failReason}`);
      }
      console.log('================================');
      
      // Map status to UI states
      let testResultValue: 'pass' | 'partial' | 'fail';
      if (status === 'EXCELLENT' || status === 'GOOD' || status === 'PASS') {
        testResultValue = 'pass';
        console.log(`✅ ${status} (matched ${compareResult.debug.matchedCount}/${compareResult.debug.expectedCount} words = ${percent}%)`);
      } else {
        testResultValue = 'fail';
        console.log(`❌ ${status} (matched ${compareResult.debug.matchedCount}/${compareResult.debug.expectedCount} words = ${percent}%)`);
      }

      // Immediately stop processing and clear intervals
      setIsProcessing(false);
      
      // Clear any running intervals immediately to prevent delays
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
        messageIntervalRef.current = null;
      }
      
      // Update final state
      setTestResult(testResultValue);
      setTestStatus(status);
      setTranscribedText(transcription);
      setIsRecordingFinished(true);
      
      // Automatically open results modal immediately (no delay)
      setShowResultsModal(true);
      setShowResultsButton(false);
      
      // Move to next chunk only on pass (PASS/GOOD/EXCELLENT)
      if (testResultValue === 'pass') {
        console.log('Test passed! Moving to next chunk or verse...');
        // Increment memorized verses count (only when completing all chunks of a verse)
        const chunks = getArabicVerseChunks(currentSurah, currentAyah);
        const totalChunks = chunks.length;
        
        // If this is the last chunk, increment memorized count
        if (currentChunkIndex >= totalChunks - 1) {
          await incrementMemorizedVerses();
        }
        
        // Wait a bit before moving to next chunk/verse
        setTimeout(async () => {
          await moveToNextChunkOrVerse();
          resetTestState();
        }, 2000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error processing recording:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      
      if (errorMessage.includes('Model file not found') || 
          errorMessage.includes('Whisper') || 
          errorMessage.includes('not available')) {
        Alert.alert(
          'Whisper Not Available',
          'Whisper transcription requires a development build.\n\n' +
          'To fix this:\n' +
          '1. Run: eas build --profile development --platform android\n' +
          '2. Install the APK on your device\n' +
          '3. Open the app from the installed APK (not Expo Go)\n\n' +
          'The model file must be bundled in the app.'
        );
        setTestResult('fail');
        setTestStatus('FAIL');
        setTranscribedText('');
      } else {
        Alert.alert(
          'Processing Error', 
          `Failed to process recording: ${errorMessage}\n\nPlease try recording again.`
        );
        setTestResult('fail');
        setTestStatus('FAIL');
      }
    } finally {
      setIsProcessing(false);
      setRecording(null);
    }
  };

  const moveToNextChunkOrVerse = async () => {
    // Get Arabic verse chunks and check if there are more chunks
    const chunks = getArabicVerseChunks(currentSurah, currentAyah);
    const totalChunks = chunks.length;
    
    console.log(`[MOVE NEXT] Current chunk: ${currentChunkIndex + 1} of ${totalChunks}`);
    
    // If there are more chunks in the current verse, move to next chunk
    if (currentChunkIndex < totalChunks - 1) {
      const nextChunkIndex = currentChunkIndex + 1;
      console.log(`[MOVE NEXT] Moving to next chunk: ${nextChunkIndex + 1} of ${totalChunks}`);
      setCurrentChunkIndex(nextChunkIndex);
      await saveProgress(currentSurah, currentAyah, nextChunkIndex);
      return;
    }
    
    // All chunks completed, move to next verse
    console.log('[MOVE NEXT] All chunks completed, moving to next verse...');
    await moveToNextVerse();
  };

  const moveToNextVerse = async () => {
    // Find current verse index in the array
    const currentIndex = quranData.findIndex(
      (v: Verse) => v.surah_no === currentSurah && v.ayah_no_surah === currentAyah
    );
    
    console.log(`[MOVE NEXT] Current: ${currentSurah}:${currentAyah}, Index: ${currentIndex}`);
    
    if (currentIndex === -1) {
      console.log('[MOVE NEXT] Verse not found, trying first verse of surah');
      // If not found, try to find first verse of current surah
      const firstVerse = quranData.find((v: Verse) => v.surah_no === currentSurah);
      if (firstVerse) {
        console.log(`[MOVE NEXT] Moving to first verse: ${currentSurah}:${firstVerse.ayah_no_surah}`);
        setCurrentAyah(firstVerse.ayah_no_surah);
        setCurrentChunkIndex(0);
        await saveProgress(currentSurah, firstVerse.ayah_no_surah, 0);
      }
      return;
    }
    
    // Check if there's a next verse in the same surah
    const nextVerse = quranData[currentIndex + 1];
    console.log(`[MOVE NEXT] Next verse in array:`, nextVerse ? `${nextVerse.surah_no}:${nextVerse.ayah_no_surah}` : 'none');
    
    if (nextVerse && nextVerse.surah_no === currentSurah) {
      // Move to next ayah in same surah
      console.log(`[MOVE NEXT] Moving to next ayah in same surah: ${currentSurah}:${nextVerse.ayah_no_surah}`);
      setCurrentAyah(nextVerse.ayah_no_surah);
      setCurrentChunkIndex(0);
      await saveProgress(currentSurah, nextVerse.ayah_no_surah, 0);
    } else {
      // Move to next surah
      if (currentSurah < 114) {
        const nextSurah = currentSurah + 1;
        const firstVerseOfNextSurah = quranData.find((v: Verse) => v.surah_no === nextSurah);
        if (firstVerseOfNextSurah) {
          console.log(`[MOVE NEXT] Moving to next surah: ${nextSurah}:${firstVerseOfNextSurah.ayah_no_surah}`);
        setCurrentSurah(nextSurah);
          setCurrentAyah(firstVerseOfNextSurah.ayah_no_surah);
          setCurrentChunkIndex(0);
          await saveProgress(nextSurah, firstVerseOfNextSurah.ayah_no_surah, 0);
      } else {
          console.log(`[MOVE NEXT] No first verse found for surah ${nextSurah}`);
        }
      } else {
        console.log('[MOVE NEXT] All verses completed!');
        Alert.alert('Congratulations!', 'You have completed all verses!');
      }
    }
  };

  const resetTestState = () => {
    setTestResult(null);
    setTestStatus(null);
    setTranscribedText('');
    setWordComparison([]);
    setSimilarityScore(null);
    setIsRecordingFinished(false);
    setShowResultsModal(false);
    setShowResultsButton(false); // Hide results button until new audio is uploaded
    setCurrentLoadingMessage('');
    progressAnim.setValue(0);
    setProgressPercentage(0);
  };

  // Circular Progress Bar Component - Liquid Fill Effect
  const CircularProgressBar = ({ progress }: { progress: Animated.Value }) => {
    const size = 80; // Smaller size
    const strokeWidth = 6;

    // Calculate rotation - starts from top (-90deg) and fills clockwise
    // At 0%: rotation is -90deg (mask should cover all green)
    // At 100%: rotation is 270deg (mask should reveal all green)
    const animatedRotation = progress.interpolate({
      inputRange: [0, 1],
      outputRange: ['-90deg', '270deg'], // Start from top, fill clockwise
    });

    return (
      <View style={styles.progressBarContainer}>
        {/* Solid white circle background - like a ball */}
        <View 
          style={[
            styles.progressBarBackground, 
            { 
              width: size, 
              height: size, 
              borderRadius: size / 2,
              backgroundColor: '#FFFFFF', // Solid white circle
            }
          ]} 
        />
        {/* Green fill - liquid fill effect using conic gradient simulation */}
        {/* Use multiple segments to create smooth fill from one side */}
        <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
          {/* Full green circle - always present underneath */}
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: '#4CAF50', // Green fill
            }}
          />
          {/* Rotating mask - positioned to cover unfilled portion */}
          {/* Use a half-circle mask that rotates around the center */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: size * 2,
                height: size * 2,
                backgroundColor: '#FFFFFF', // White to mask green
                borderRadius: size,
                // Position mask centered on the circle, offset to create half-circle effect
                // At -90deg: covers right half (all green hidden)
                // As rotation increases: reveals green progressively
                left: size,
                top: -size / 2,
                transform: [{ rotate: animatedRotation }],
              },
            ]}
          />
        </View>
        {/* Percentage and Review text in center - white text */}
        <View style={styles.progressBarCenter}>
          <Text style={styles.progressBarPercentage}>{progressPercentage}%</Text>
          <Text style={styles.progressBarLabel}>Review</Text>
        </View>
      </View>
    );
  };

  const handleCloseModal = () => {
    resetTestState();
    if (recording) {
      recording.stopAndUnloadAsync();
      setRecording(null);
    }
    navigation.goBack();
  };

  const handleStartRecording = async () => {
    setIsRecordingFinished(false);
    await startRecording();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Test Modal - Always visible based on design */}
      <Modal
        visible={true}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Test Your Recitation</Text>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Motivational Quote Display */}
            <View style={styles.verseContainer}>
              <View style={styles.quoteContainer}>
                <Text style={styles.quoteText}>
                  "The most beloved of deeds to Allah are those that are done consistently, even if they are small."
                </Text>
                <Text style={styles.quoteSource}>
                  — Sahih Bukhari & Sahih Muslim
                </Text>
              </View>
            </View>

            {/* Instruction */}
            <Text style={styles.instruction}>
              Tap the button and recite the lines you just memorised
            </Text>

            {/* Recording Button */}
            <View style={styles.buttonContainer}>
              {isProcessing ? (
                <View style={styles.processingContainer}>
                  {/* Circular Progress Bar */}
                  <CircularProgressBar progress={progressAnim} />
                  <Text style={styles.processingText}>
                    {currentLoadingMessage || 'Processing...'}
                  </Text>
                </View>
              ) : isRecording ? (
                <TouchableOpacity
                  style={styles.stopButton}
                  onPress={stopRecording}
                >
                  <Text style={styles.stopButtonText}>Stop & Test</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.recordButton}
                  onPress={handleStartRecording}
                >
                  <Text style={styles.recordButtonIcon}>🎙️</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* View Results Button */}
            {showResultsButton && testResult && !showResultsModal && (
              <TouchableOpacity
                style={styles.viewResultsButton}
                onPress={() => {
                  setShowResultsModal(true);
                  setShowResultsButton(false); // Hide button when modal opens
                }}
              >
                <Text style={styles.viewResultsButtonText}>View Results</Text>
              </TouchableOpacity>
            )}

            {/* Recording Indicator */}
            {isRecording && (
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>Recording...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Results Modal */}
      <Modal
        visible={showResultsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowResultsModal(false)}
      >
        <View style={styles.resultsModalOverlay}>
          <View style={styles.resultsModalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsTitle}>Your Results</Text>
                <TouchableOpacity
                  onPress={() => setShowResultsModal(false)}
                  style={styles.resultsCloseButton}
                >
                  <Text style={styles.resultsCloseButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Score Display */}
              {similarityScore !== null && (
                <View style={styles.scoreDisplayContainer}>
                  <Text style={styles.scoreLabel}>Score</Text>
                  <Text style={[
                    styles.scoreValue,
                    testResult === 'pass' && styles.scoreValuePass,
                    testResult === 'partial' && styles.scoreValuePartial,
                    testResult === 'fail' && styles.scoreValueFail,
                  ]}>
                    {similarityScore.toFixed(1)}%
                  </Text>
                  {testStatus && (
                    <Text style={[
                      testStatus === 'EXCELLENT' && styles.resultStatusPass,
                      testStatus === 'GOOD' && styles.resultStatusPass,
                      testStatus === 'PASS' && styles.resultStatusPass,
                      testStatus === 'FAIL' && styles.resultStatusFail,
                    ]}>
                      {testStatus === 'EXCELLENT' && '✅ EXCELLENT! Great recitation!'}
                      {testStatus === 'GOOD' && '✅ GOOD! Well done!'}
                      {testStatus === 'PASS' && '✅ PASS! Keep practicing!'}
                      {testStatus === 'FAIL' && '❌ FAIL - Keep trying! You\'ll get it!'}
                    </Text>
                  )}
                </View>
              )}

              {/* What Whisper Heard */}
              {transcribedText && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>What Whisper Heard</Text>
                  <View style={styles.transcriptionBox}>
                    <Text style={styles.transcriptionBoxText}>{transcribedText}</Text>
                  </View>
                </View>
              )}

              {/* Expected Verse with Word Highlighting */}
              {wordComparison.length > 0 && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Expected Verse</Text>
                  <View style={styles.verseHighlightContainer}>
                    <Text style={styles.verseHighlightText}>
                      {wordComparison.map((item, index) => {
                        let wordStyle;
                        if (item.score >= 0.9) {
                          wordStyle = styles.highlightCorrect;
                        } else if (item.score >= 0.5) {
                          wordStyle = styles.highlightPartial;
                        } else {
                          wordStyle = styles.highlightIncorrect;
                        }
                        
                        return (
                          <Text key={index} style={wordStyle}>
                            {item.word}{index < wordComparison.length - 1 ? ' ' : ''}
                          </Text>
                        );
                      })}
                    </Text>
                  </View>
                  
                  {/* Legend */}
                  <View style={styles.resultsLegendContainer}>
                    <View style={styles.resultsLegendItem}>
                      <View style={[styles.resultsLegendColor, styles.resultsLegendGreen]} />
                      <Text style={styles.resultsLegendText}>Correct (≥90%)</Text>
                    </View>
                    <View style={styles.resultsLegendItem}>
                      <View style={[styles.resultsLegendColor, styles.resultsLegendYellow]} />
                      <Text style={styles.resultsLegendText}>Partial (50-90%)</Text>
                    </View>
                    <View style={styles.resultsLegendItem}>
                      <View style={[styles.resultsLegendColor, styles.resultsLegendRed]} />
                      <Text style={styles.resultsLegendText}>Incorrect ({'<'}50%)</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Tips Section */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Tips for Improvement</Text>
                {testResult === 'pass' ? (
                  <View style={styles.tipsContainer}>
                    <Text style={styles.tipText}>✨ Great job! You're doing excellent!</Text>
                    <Text style={styles.tipText}>💡 Continue practicing to maintain consistency</Text>
                    <Text style={styles.tipText}>📚 Try reciting with proper tajweed rules</Text>
                  </View>
                ) : testResult === 'partial' ? (
                  <View style={styles.tipsContainer}>
                    <Text style={styles.tipText}>🎯 You're close! Focus on pronunciation clarity</Text>
                    <Text style={styles.tipText}>🗣️ Practice speaking slower and more clearly</Text>
                    <Text style={styles.tipText}>👂 Listen to the verse again and compare</Text>
                    <Text style={styles.tipText}>📖 Review the highlighted words that need work</Text>
                  </View>
                ) : (
                  <View style={styles.tipsContainer}>
                    <Text style={styles.tipText}>🎯 Don't give up! Practice makes perfect</Text>
                    <Text style={styles.tipText}>🗣️ Speak clearly and at a moderate pace</Text>
                    <Text style={styles.tipText}>🔊 Ensure you're in a quiet environment</Text>
                    <Text style={styles.tipText}>📖 Review the verse and try again</Text>
                    <Text style={styles.tipText}>💪 Focus on the red highlighted words</Text>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.resultsActionsContainer}>
                {testResult === 'pass' ? (
                  <TouchableOpacity
                    style={styles.resultsActionButton}
                    onPress={async () => {
                      setShowResultsModal(false);
                      await moveToNextChunkOrVerse();
                      resetTestState();
                    }}
                  >
                    <Text style={styles.resultsActionButtonText}>Continue to Next</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.resultsActionButton, styles.resultsActionButtonSecondary]}
                      onPress={() => {
                        setShowResultsModal(false);
                        resetTestState();
                      }}
                    >
                      <Text style={[styles.resultsActionButtonText, styles.resultsActionButtonTextSecondary]}>
                        Try Again
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
  },
  verseContainer: {
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  quoteContainer: {
    width: '100%',
    alignItems: 'center',
  },
  quoteText: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 28,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  quoteSource: {
    fontSize: 14,
    color: '#4A90E2',
    textAlign: 'center',
    fontWeight: '600',
  },
  correctWord: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  partialWord: {
    color: '#FFA500',
    backgroundColor: 'rgba(255, 165, 0, 0.2)',
    fontWeight: '600',
  },
  incorrectWord: {
    color: '#E74C3C',
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    fontWeight: '600',
  },
  verseReference: {
    fontSize: 16,
    color: '#999999',
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 25,
    paddingBottom: 40,
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  instruction: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 40,
  },
  buttonContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  recordButtonActive: {
    backgroundColor: '#E74C3C',
  },
  recordButtonIcon: {
    fontSize: 50,
    color: '#FFFFFF',
  },
  stopButton: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    minWidth: 150,
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  processingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    color: '#FFFFFF',
    marginTop: 20,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  progressBarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 80,
    height: 80,
  },
  progressBarBackground: {
    backgroundColor: '#FFFFFF', // Solid white circle
  },
  progressBarCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  progressBarPercentage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  progressBarLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  resultContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  resultTextSuccess: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 5,
  },
  resultTextPartial: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFA500',
    marginBottom: 5,
  },
  resultTextFail: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E74C3C',
    marginBottom: 5,
  },
  scoreText: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 10,
    fontWeight: '600',
  },
  resultSubtext: {
    fontSize: 16,
    color: '#999999',
  },
  resultSubtextPartial: {
    fontSize: 16,
    color: '#FFA500',
    fontStyle: 'italic',
  },
  transcriptionContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  transcriptionLabel: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 5,
  },
  transcriptionText: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 5,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 3,
    marginRight: 6,
  },
  legendGreen: {
    backgroundColor: '#4CAF50',
  },
  legendYellow: {
    backgroundColor: '#FFA500',
  },
  legendRed: {
    backgroundColor: '#E74C3C',
  },
  legendText: {
    fontSize: 12,
    color: '#999999',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E74C3C',
    marginRight: 8,
  },
  recordingText: {
    color: '#E74C3C',
    fontSize: 16,
    fontWeight: '600',
  },
  viewResultsButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 20,
    alignSelf: 'center',
  },
  viewResultsButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  // Results Modal Styles
  resultsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  resultsModalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 25,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  resultsTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  resultsCloseButton: {
    width: 35,
    height: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 17.5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  resultsCloseButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  scoreDisplayContainer: {
    alignItems: 'center',
    marginBottom: 30,
    paddingVertical: 25,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scoreValue: {
    fontSize: 56,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  scoreValuePass: {
    color: '#4CAF50',
  },
  scoreValuePartial: {
    color: '#FFA500',
  },
  scoreValueFail: {
    color: '#E74C3C',
  },
  resultStatusPass: {
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: '600',
  },
  resultStatusPartial: {
    fontSize: 18,
    color: '#FFA500',
    fontWeight: '600',
  },
  resultStatusFail: {
    fontSize: 18,
    color: '#E74C3C',
  },
  sectionContainer: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 15,
  },
  transcriptionBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  transcriptionBoxText: {
    fontSize: 16,
    color: '#E0E0E0',
    lineHeight: 24,
    textAlign: 'center',
  },
  verseHighlightContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  verseHighlightText: {
    fontSize: 24,
    lineHeight: 40,
    textAlign: 'center',
    fontFamily: 'IndoPak',
  },
  highlightCorrect: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  highlightPartial: {
    color: '#FFA500',
    backgroundColor: 'rgba(255, 165, 0, 0.2)',
    fontWeight: '600',
  },
  highlightIncorrect: {
    color: '#E74C3C',
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    fontWeight: '600',
  },
  resultsLegendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    flexWrap: 'wrap',
  },
  resultsLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 5,
  },
  resultsLegendColor: {
    width: 18,
    height: 18,
    borderRadius: 4,
    marginRight: 8,
  },
  resultsLegendGreen: {
    backgroundColor: '#4CAF50',
  },
  resultsLegendYellow: {
    backgroundColor: '#FFA500',
  },
  resultsLegendRed: {
    backgroundColor: '#E74C3C',
  },
  resultsLegendText: {
    fontSize: 13,
    color: '#CCCCCC',
  },
  tipsContainer: {
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    padding: 20,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
  },
  tipText: {
    fontSize: 15,
    color: '#E0E0E0',
    lineHeight: 24,
    marginBottom: 10,
  },
  resultsActionsContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  resultsActionButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
  },
  resultsActionButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  resultsActionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  resultsActionButtonTextSecondary: {
    color: '#4A90E2',
  },
});

