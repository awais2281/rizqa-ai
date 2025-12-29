/**
 * Robust Arabic Recitation Comparison System
 * Production-grade verification for Quran chunk recitation
 */

// Simple hash function for React Native (since crypto is not available)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to positive hex string (8 chars)
  return Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8);
}

export interface MatchResult {
  expectedWord: string;
  transcriptWord: string;
  method: 'exact' | 'skeleton' | 'fuzzy' | 'partial';
  sim: number;
}

export interface CompareResult {
  pass: boolean;
  score: number; // 0..1
  matched: MatchResult[];
  expectedTokens: string[];
  transcriptTokens: string[];
  debug: {
    expectedHash?: string;
    transcriptHash?: string;
    matchedCount: number;
    expectedCount: number;
    matchedWeight: number;
    totalWeight: number;
    percent: number; // Percentage based on matched count mapping (0-100)
    passReason: string;
    failReason?: string;
  };
}

// Arabic stopwords (common connectors) - weight = 0.5
const ARABIC_STOPWORDS = new Set([
  'و', 'ف', 'ثم', 'ما', 'لا', 'من', 'الى', 'على', 'في', 'عن', 
  'ان', 'إن', 'إلا', 'وما', 'لكن', 'لكي', 'لأن', 'حتى', 'إذ', 'إذا'
]);

// Diacritics/harakat/tashkeel ranges
const DIACRITICS_REGEX = /[\u064B-\u065F\u0670]/g;
const QURAN_MARKS_REGEX = /[\u06D6-\u06ED]/g;

/**
 * Quran-safe Arabic normalization
 * Critical: Must handle all Quranic marks and variants correctly
 */
export function normalizeArabicForCompare(s: string): string {
  if (!s) return '';
  
  return s
    // Remove ALL harakat/tashkeel: 064B-065F, 0670, 06D6-06ED
    .replace(DIACRITICS_REGEX, '')
    .replace(QURAN_MARKS_REGEX, '')
    // Remove tatweel (0640)
    .replace(/\u0640/g, '')
    // Remove Quran stop/ornament marks (۞ ۩ ۛ ۚ ۗ ۙ ۘ ۜ ۝ etc)
    .replace(/[\u06D6-\u06ED\u06F0-\u06F9\u06FD-\u06FE\u0600-\u0605\u0610-\u061A\u06E5-\u06E6\u06FA-\u06FC]/g, '')
    // Normalize alif variants: (أ إ آ ٱ) -> ا
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize hamza-on-waw/ya: (ؤ -> و, ئ -> ي)
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    // Normalize ta marbuta: (ة -> ه)
    .replace(/ة/g, 'ه')
    // Normalize alif maqsura: (ى -> ي)
    .replace(/ى/g, 'ي')
    // Normalize Persian yeh to Arabic yeh: (ی U+06CC -> ي U+064A)
    .replace(/\u06CC/g, '\u064A')
    // Remove punctuation
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]'"<>?،؛]/g, '')
    // Remove non-Arabic letters except spaces
    .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenization that never returns empty unexpectedly
 */
export function tokenizeArabic(s: string): string[] {
  if (!s) return [];
  
  const normalized = normalizeArabicForCompare(s);
  const tokens = normalized.split(/\s+/).filter(token => token.length > 0);
  
  // Safety check: if original had Arabic letters but tokens are empty, log bug
  const hasArabicLetters = /[\u0600-\u06FF]/.test(s);
  if (hasArabicLetters && tokens.length === 0) {
    console.error('[TOKENIZE BUG] Original had Arabic but tokens empty:');
    console.error('  Original:', JSON.stringify(s));
    console.error('  Normalized:', JSON.stringify(normalized));
    console.error('  This should not happen - check normalization!');
  }
  
  return tokens;
}

/**
 * Get skeleton by removing vowel-like letters (ا و ي ه)
 */
function getSkeleton(token: string): string {
  if (!token) return '';
  return token.replace(/[اويءه]/g, '');
}

/**
 * Calculate normalized Levenshtein similarity (0..1)
 */
function levenshteinSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  
  const lenA = a.length;
  const lenB = b.length;
  const maxLen = Math.max(lenA, lenB);
  
  if (maxLen === 0) return 1;
  
  // Create distance matrix
  const matrix: number[][] = [];
  for (let i = 0; i <= lenA; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lenB; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  const distance = matrix[lenA][lenB];
  return 1 - (distance / maxLen);
}

/**
 * Calculate word similarity - LENIENT for Whisper noise
 */
function wordSimilarity(expectedWord: string, transcriptWord: string): { sim: number; method: 'exact' | 'skeleton' | 'fuzzy' | 'partial' } {
  // a) Exact match
  if (expectedWord === transcriptWord) {
    return { sim: 1.0, method: 'exact' };
  }
  
  // b) Skeleton match: remove vowels-like letters (ا و ي ه) then compare
  // This is VERY lenient - handles pronunciation variations
  const expectedSkeleton = getSkeleton(expectedWord);
  const transcriptSkeleton = getSkeleton(transcriptWord);
  
  if (expectedSkeleton.length >= 2 && transcriptSkeleton.length >= 2) {
    const skeletonSim = levenshteinSimilarity(expectedSkeleton, transcriptSkeleton);
    // Lower threshold for skeleton - handles "يهدي" vs "يدلوا" type variations
    if (skeletonSim >= 0.55) {
      return { sim: Math.min(0.85, skeletonSim * 1.1), method: 'skeleton' };
    }
  }
  
  // c) Partial match: one word contains the other (lenient)
  // Handles cases like "يضل" vs "يدلوا" where one is a substring
  const minLen = Math.min(expectedWord.length, transcriptWord.length);
  const maxLen = Math.max(expectedWord.length, transcriptWord.length);
  
  if (minLen >= 3 && maxLen <= minLen * 1.5) {
    // Check if longer contains shorter (with some tolerance)
    const shorter = expectedWord.length <= transcriptWord.length ? expectedWord : transcriptWord;
    const longer = expectedWord.length > transcriptWord.length ? expectedWord : transcriptWord;
    
    if (longer.includes(shorter) || shorter.includes(longer.substring(0, Math.min(shorter.length + 1, longer.length)))) {
      const partialSim = minLen / maxLen;
      if (partialSim >= 0.60) {
        return { sim: Math.min(0.75, partialSim), method: 'partial' };
      }
    }
  }
  
  // d) Normalized Levenshtein similarity - LOWER threshold for leniency
  const fuzzySim = levenshteinSimilarity(expectedWord, transcriptWord);
  // Lowered from 0.72 to 0.60 for more lenient matching
  if (fuzzySim >= 0.60) {
    return { sim: fuzzySim, method: 'fuzzy' };
  }
  
  // e) Very lenient: if both words are short and share some characters
  if (expectedWord.length <= 4 && transcriptWord.length <= 4) {
    const sharedChars = expectedWord.split('').filter(c => transcriptWord.includes(c)).length;
    const totalChars = Math.max(expectedWord.length, transcriptWord.length);
    if (sharedChars >= 2 && sharedChars / totalChars >= 0.5) {
      return { sim: 0.65, method: 'partial' };
    }
  }
  
  return { sim: 0, method: 'fuzzy' };
}

/**
 * Get word weight (stopwords = 0.5, others = 1.0)
 */
function getWordWeight(word: string): number {
  return ARABIC_STOPWORDS.has(word) ? 0.5 : 1.0;
}

/**
 * Map matched count to percentage based on user-defined mapping
 * Mapping for 10 words: 1=10%, 2=25%, 3=30%, 4=45%, 5=55%, 6=60%, 7=70%, 8=85%, 9=95%, 10=100%
 * Scales proportionally for different expected counts
 */
function matchedCountToPercent(matchedCount: number, expectedCount: number): number {
  if (expectedCount === 0) return 0;
  if (matchedCount === 0) return 0;
  if (matchedCount >= expectedCount) return 100;
  
  // Base mapping for 10 words
  const baseMapping: { [key: number]: number } = {
    1: 10,
    2: 25,
    3: 30,
    4: 45,
    5: 55,
    6: 60,
    7: 70,
    8: 85,
    9: 95,
    10: 100
  };
  
  // Calculate ratio (matchedCount / expectedCount)
  const ratio = matchedCount / expectedCount;
  
  // Scale to base 10 for lookup (clamp to 1-10 range)
  const scaledCount = Math.max(1, Math.min(10, Math.round(ratio * 10)));
  
  // Get percentage from base mapping
  if (baseMapping[scaledCount] !== undefined) {
    return baseMapping[scaledCount];
  }
  
  // For values between mappings, interpolate
  // Find the two closest mappings
  let lower = 1;
  let upper = 10;
  let lowerPercent = 10;
  let upperPercent = 100;
  
  for (let i = 1; i <= 10; i++) {
    if (i <= scaledCount && i >= lower) {
      lower = i;
      lowerPercent = baseMapping[i];
    }
    if (i >= scaledCount && i <= upper) {
      upper = i;
      upperPercent = baseMapping[i];
    }
  }
  
  // Linear interpolation
  if (upper === lower) {
    return lowerPercent;
  }
  
  const t = (scaledCount - lower) / (upper - lower);
  return Math.round(lowerPercent + t * (upperPercent - lowerPercent));
}

/**
 * Main comparison function
 */
export function compareRecitation(
  expected: string,
  transcript: string,
  expectedHash?: string
): CompareResult {
  // Normalize and tokenize
  const normalizedExpected = normalizeArabicForCompare(expected);
  const normalizedTranscript = normalizeArabicForCompare(transcript);
  
  const expectedTokens = tokenizeArabic(expected);
  const transcriptTokens = tokenizeArabic(transcript);
  
  // Calculate hashes for verification (using simple hash for React Native)
  const expectedHashCalc = expectedHash || simpleHash(normalizedExpected);
  const transcriptHash = simpleHash(normalizedTranscript);
  
  // Safety check: if expectedTokens empty but expected had Arabic, this is a bug
  const hasArabicInExpected = /[\u0600-\u06FF]/.test(expected);
  if (hasArabicInExpected && expectedTokens.length === 0) {
    return {
      pass: false,
      score: 0,
      matched: [],
      expectedTokens: [],
      transcriptTokens,
      debug: {
        expectedHash: expectedHashCalc,
        transcriptHash,
        matchedCount: 0,
        expectedCount: 0,
        matchedWeight: 0,
        totalWeight: 0,
        passReason: 'expected_tokenization_bug',
        failReason: 'Expected text had Arabic letters but tokenization returned empty array'
      }
    };
  }
  
  // Check if transcript is too short
  // Allow 2 tokens if expected also has 2 tokens, otherwise require minimum 3
  const minTokens = expectedTokens.length <= 2 ? expectedTokens.length : 3;
  if (transcriptTokens.length < minTokens) {
    return {
      pass: false,
      score: 0,
      matched: [],
      expectedTokens,
      transcriptTokens,
      debug: {
        expectedHash: expectedHashCalc,
        transcriptHash,
        matchedCount: 0,
        expectedCount: expectedTokens.length,
        matchedWeight: 0,
        totalWeight: expectedTokens.reduce((sum, w) => sum + getWordWeight(w), 0),
        passReason: 'too_short',
        failReason: `Transcript has only ${transcriptTokens.length} tokens (minimum ${minTokens} required)`
      }
    };
  }
  
  // Ordered alignment (greedy left-to-right) - MORE LENIENT
  const matched: MatchResult[] = [];
  const usedTranscriptIndices = new Set<number>();
  
  // Increased look-ahead window for better matching (was 5, now 8)
  const maxLookAhead = 8;
  
  for (let i = 0; i < expectedTokens.length; i++) {
    const expectedWord = expectedTokens[i];
    let bestMatch: { j: number; sim: number; method: 'exact' | 'skeleton' | 'fuzzy' | 'partial' } | null = null;
    
    // Look ahead more positions - allows for more reordering and skipped words
    const startPos = Math.max(0, i - 2); // Allow looking back 2 positions too
    const endPos = Math.min(startPos + maxLookAhead, transcriptTokens.length);
    
    for (let j = startPos; j < endPos; j++) {
      if (usedTranscriptIndices.has(j)) continue;
      
      const transcriptWord = transcriptTokens[j];
      const simResult = wordSimilarity(expectedWord, transcriptWord);
      
      // LOWER threshold: accept matches with similarity >= 0.60 (was 0.72)
      if (simResult.sim >= 0.60) {
        if (!bestMatch || simResult.sim > bestMatch.sim) {
          bestMatch = {
            j,
            sim: simResult.sim,
            method: simResult.method
          };
        }
      }
    }
    
    if (bestMatch) {
      matched.push({
        expectedWord,
        transcriptWord: transcriptTokens[bestMatch.j],
        method: bestMatch.method,
        sim: bestMatch.sim
      });
      usedTranscriptIndices.add(bestMatch.j);
    }
  }
  
  // Calculate percentage based on matched count using user-defined mapping
  const matchedCount = matched.length;
  const expectedCount = expectedTokens.length;
  const percent = matchedCountToPercent(matchedCount, expectedCount);
  const score = percent / 100; // Convert to 0..1 for consistency
  
  // Count non-stoplist matched words
  const nonStoplistMatched = matched.filter(m => !ARABIC_STOPWORDS.has(m.expectedWord)).length;
  
  // Pass/Fail rule: PASS if score >= 0.60 (60%) AND at least 2 non-stoplist words matched
  const pass = (score >= 0.60) && (nonStoplistMatched >= 2);
  
  // Calculate weighted values for debug (for backward compatibility)
  let matchedWeight = 0;
  let totalWeight = 0;
  for (const expectedWord of expectedTokens) {
    const weight = getWordWeight(expectedWord);
    totalWeight += weight;
    const match = matched.find(m => m.expectedWord === expectedWord);
    if (match) {
      matchedWeight += weight * match.sim;
    }
  }
  
  return {
    pass,
    score,
    matched,
    expectedTokens,
    transcriptTokens,
    debug: {
      expectedHash: expectedHashCalc,
      transcriptHash,
      matchedCount: matched.length,
      expectedCount: expectedTokens.length,
      matchedWeight,
      totalWeight,
      percent: percent, // Add percent to debug info
      passReason: pass 
        ? `percent=${percent}% (score=${score.toFixed(3)}) >= 60% AND ${nonStoplistMatched} non-stoplist words matched`
        : score < 0.60 
          ? `percent=${percent}% (score=${score.toFixed(3)}) < 60%`
          : `only ${nonStoplistMatched} non-stoplist words matched (need 2)`,
      failReason: pass ? undefined : (score < 0.60 ? `Score too low (${percent}% < 60%)` : `Not enough content words matched`)
    }
  };
}

/**
 * Calculate hash of normalized expected text (for verification)
 */
export function calculateExpectedHash(expected: string): string {
  const normalized = normalizeArabicForCompare(expected);
  return simpleHash(normalized);
}

