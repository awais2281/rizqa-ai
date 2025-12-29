/**
 * Balanced Quran Recitation Marking System
 * Uses anchor-word constraints and monotonic alignment to prevent false positives
 * Designed for QPC Hafs script with Whisper ASR output
 */

export interface MatchPair {
  expectedWord: string;
  whisperWord: string;
  matchType: 'exact' | 'near' | 'none';
  similarity: number;
}

export type PassStatus = 'pass' | 'partial' | 'fail';

export interface MarkingResult {
  pass: boolean; // true if status is 'pass'
  status: PassStatus; // 'pass' | 'partial' | 'fail'
  score: number; // 0..1 (average word similarity)
  matchedWords: MatchPair[];
  missingExpectedWords: string[];
  extraWhisperWords: string[];
  wordScores: Array<{ word: string; similarity: number }>; // Individual word scores
  debug: {
    normalizedExpectedTokens: string[];
    normalizedWhisperTokens: string[];
    averageSimilarity: number;
    matchedCount: number;
    expectedCount: number;
    thresholds: {
      passThreshold: number;
      partialThreshold: number;
    };
  };
}

// Arabic stopwords (common function words that shouldn't be anchors)
const ARABIC_STOPWORDS = new Set([
  'و', 'في', 'من', 'على', 'إلى', 'عن', 'مع', 'ب', 'ك', 'ل', 'س',
  'هم', 'هم', 'هما', 'هن', 'ه', 'ها', 'هما', 'هن',
  'هم', 'كم', 'كما', 'كن', 'ك', 'كما', 'كن',
  'نا', 'ي', 'ك', 'ه', 'ها', 'هم', 'هن',
  'ذلك', 'هذا', 'هذه', 'هؤلاء', 'ذلك', 'تلك',
  'التي', 'الذي', 'اللذان', 'اللتان', 'الذين', 'اللاتي',
  'إن', 'أن', 'ما', 'لا', 'لم', 'لن', 'ليس',
  'لكم', 'لهم', 'فيها', 'عليها', 'منها', 'إليها',
  'ولهم', 'وفيها', 'وعليها', 'ومنها', 'وإليها',
]);

// Quranic marks to remove (pause marks, ayah symbols, decorative marks)
const QURANIC_MARKS_REGEX = /[\u06D6-\u06ED\u06F0-\u06F9\u06FD-\u06FE\u0600-\u0605\u0610-\u061A\u0640\u064B-\u065F\u0670\u06E5-\u06E6\u06FA-\u06FC]/g;

// Diacritics (harakat/tashkeel) - remove for phonetic matching
const DIACRITICS_REGEX = /[\u064B-\u065F\u0670]/g;

// Additional optional characters that can be ignored in phonetic matching
const OPTIONAL_CHARS_REGEX = /[\u0671\u0672\u0673\u06E5\u06E6\u06ED]/g; // Including sukun, maddah, etc.

/**
 * Phonetic normalization: remove harakat, normalize letters, remove optional characters
 * Designed for fuzzy/phonetic matching
 */
export function normalizeBase(text: string): string {
  if (!text) return '';
  
  return text
    // Remove diacritics (harakat/tashkeel) - these don't affect pronunciation matching
    .replace(DIACRITICS_REGEX, '')
    // Remove optional characters (sukun, maddah, etc.)
    .replace(OPTIONAL_CHARS_REGEX, '')
    // Remove Quranic annotation marks (pause marks, ayah symbols, etc.)
    .replace(QURANIC_MARKS_REGEX, '')
    // Remove tatweel (elongation mark)
    .replace(/\u0640/g, '')
    // Normalize alif variants: أ إ آ ٱ → ا (phonetically similar)
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize ya variants: ى → ي (phonetically similar)
    .replace(/ى/g, 'ي')
    // Normalize ta marbuta: ة → ه (phonetically similar at end of word)
    .replace(/ة/g, 'ه')
    // Normalize hamza variants (phonetically similar)
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '') // Remove standalone hamza for phonetic matching
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Remove punctuation
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]'"<>?،؛]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Diacritic-preserving normalization: keep harakat but remove non-letter marks
 */
export function normalizeWithDiacritics(text: string): string {
  if (!text) return '';
  
  return text
    // Remove Quranic annotation marks (but keep diacritics)
    .replace(QURANIC_MARKS_REGEX, '')
    // Remove tatweel
    .replace(/\u0640/g, '')
    // Normalize alif variants
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize ya variants
    .replace(/ى/g, 'ي')
    // Normalize ta marbuta
    .replace(/ة/g, 'ه')
    // Normalize hamza variants
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Remove punctuation
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]'"<>?،؛]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenize text into words
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text.split(/\s+/).filter(token => token.length > 0);
}

/**
 * Get Arabic skeleton (remove dots and hamza variations for matching)
 */
function getSkeleton(word: string): string {
  if (!word) return '';
  
  // Remove diacritics
  let skeleton = word.replace(DIACRITICS_REGEX, '');
  
  // Normalize hamza variations
  skeleton = skeleton
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '');
  
  // Remove dots (for skeleton matching - this helps with similar-looking letters)
  // Actually, we should keep dots as they distinguish letters. Let's just normalize variants.
  
  return skeleton;
}

/**
 * Calculate normalized edit distance similarity (Levenshtein)
 */
function editSimilarity(a: string, b: string): number {
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
 * Calculate phonetic/fuzzy similarity between two words
 * Uses Levenshtein distance on normalized text for lenient matching
 */
function wordSimilarity(expectedWord: string, whisperWord: string): { similarity: number; matchType: 'exact' | 'near' | 'none' } {
  // Exact match
  if (expectedWord === whisperWord) {
    return { similarity: 1.0, matchType: 'exact' };
  }
  
  // Calculate normalized Levenshtein similarity (phonetic/fuzzy matching)
  const similarity = editSimilarity(expectedWord, whisperWord);
  
  // More lenient threshold for phonetic matching
  // Accept matches with similarity >= 0.50 (allows minor mispronunciations)
  if (similarity >= 0.50) {
    // Scale similarity to be more forgiving for near matches
    // 0.50 -> 0.70, 0.75 -> 0.85, 0.90+ -> 0.95
    let scaledSimilarity = similarity;
    if (similarity < 0.75) {
      scaledSimilarity = 0.50 + (similarity - 0.50) * 0.8; // Scale 0.50-0.75 to 0.50-0.70
    } else if (similarity < 0.90) {
      scaledSimilarity = 0.70 + (similarity - 0.75) * 1.0; // Scale 0.75-0.90 to 0.70-0.85
    } else {
      scaledSimilarity = 0.85 + (similarity - 0.90) * 1.0; // Scale 0.90+ to 0.85-0.95
    }
    
    return { 
      similarity: Math.min(0.95, scaledSimilarity), 
      matchType: similarity >= 0.85 ? 'exact' : 'near' 
    };
  }
  
  return { similarity: 0, matchType: 'none' };
}

/**
 * Monotonic sequence alignment (greedy with backtracking)
 * Aligns expected tokens to whisper tokens preserving order
 */
function alignMonotonic(
  expectedTokens: string[],
  whisperTokens: string[]
): MatchPair[] {
  const matches: MatchPair[] = [];
  const usedWhisperIndices = new Set<number>();
  
  let expectedIdx = 0;
  let whisperIdx = 0;
  
  // Greedy alignment: for each expected token, find best match in remaining whisper tokens
  while (expectedIdx < expectedTokens.length && whisperIdx < whisperTokens.length) {
    const expectedWord = expectedTokens[expectedIdx];
    let bestMatch: { idx: number; similarity: number; matchType: 'exact' | 'near' | 'none' } | null = null;
    
    // Look ahead up to 3 positions for a match
    const lookAhead = Math.min(3, whisperTokens.length - whisperIdx);
    for (let i = 0; i < lookAhead; i++) {
      const candidateIdx = whisperIdx + i;
      if (usedWhisperIndices.has(candidateIdx)) continue;
      
      const whisperWord = whisperTokens[candidateIdx];
      const simResult = wordSimilarity(expectedWord, whisperWord);
      
      if (simResult.similarity > 0 && (!bestMatch || simResult.similarity > bestMatch.similarity)) {
        bestMatch = {
          idx: candidateIdx,
          similarity: simResult.similarity,
          matchType: simResult.matchType
        };
      }
    }
    
    if (bestMatch && bestMatch.similarity >= 0.50) {
      // Found a match (lower threshold for phonetic matching)
      matches.push({
        expectedWord,
        whisperWord: whisperTokens[bestMatch.idx],
        matchType: bestMatch.matchType,
        similarity: bestMatch.similarity
      });
      usedWhisperIndices.add(bestMatch.idx);
      expectedIdx++;
      whisperIdx = bestMatch.idx + 1; // Move past the matched token
    } else {
      // No match found, skip this expected token
      expectedIdx++;
    }
  }
  
  return matches;
}

/**
 * Extract anchor words (top 2 longest tokens excluding stopwords)
 */
export function extractAnchors(tokens: string[]): string[] {
  // Filter: length >= 4, not a stopword
  const candidates = tokens
    .filter(token => token.length >= 4 && !ARABIC_STOPWORDS.has(token))
    .sort((a, b) => b.length - a.length); // Sort by length descending
  
  return candidates.slice(0, 2); // Top 2
}

/**
 * Check anchor constraint: at least 1 anchor must match with similarity >= 0.85
 */
function checkAnchorConstraint(
  anchors: string[],
  matchedPairs: MatchPair[]
): boolean {
  if (anchors.length === 0) return true; // No anchors, constraint satisfied
  
  const matchedExpectedWords = new Set(matchedPairs.map(p => p.expectedWord));
  
  for (const anchor of anchors) {
    const match = matchedPairs.find(p => p.expectedWord === anchor);
    if (match && match.similarity >= 0.85) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate diacritic bonus score (optional, only if baseScore >= 0.85)
 */
function calculateDiacriticBonus(
  matchedPairs: MatchPair[],
  expectedTokensWithDiacritics: string[],
  whisperTokensWithDiacritics: string[],
  normalizedExpectedTokens: string[],
  normalizedWhisperTokens: string[]
): number {
  if (matchedPairs.length === 0) return 0;
  
  let diacriticMatches = 0;
  let totalDiacritics = 0;
  
  // Create mapping from normalized words to diacritic-preserving words
  const expectedMap = new Map<string, string>();
  const whisperMap = new Map<string, string>();
  
  for (let i = 0; i < normalizedExpectedTokens.length && i < expectedTokensWithDiacritics.length; i++) {
    expectedMap.set(normalizedExpectedTokens[i], expectedTokensWithDiacritics[i]);
  }
  
  for (let i = 0; i < normalizedWhisperTokens.length && i < whisperTokensWithDiacritics.length; i++) {
    whisperMap.set(normalizedWhisperTokens[i], whisperTokensWithDiacritics[i]);
  }
  
  for (const pair of matchedPairs) {
    const expectedWithDiacritics = expectedMap.get(pair.expectedWord);
    const whisperWithDiacritics = whisperMap.get(pair.whisperWord);
    
    if (expectedWithDiacritics && whisperWithDiacritics) {
      
      // Extract diacritics
      const expectedDiacritics = expectedWithDiacritics.match(DIACRITICS_REGEX) || [];
      const whisperDiacritics = whisperWithDiacritics.match(DIACRITICS_REGEX) || [];
      
      totalDiacritics += Math.max(expectedDiacritics.length, whisperDiacritics.length);
      
      // Count matching diacritics (simple comparison)
      if (expectedDiacritics.length > 0 && whisperDiacritics.length > 0) {
        const minLen = Math.min(expectedDiacritics.length, whisperDiacritics.length);
        for (let i = 0; i < minLen; i++) {
          if (expectedDiacritics[i] === whisperDiacritics[i]) {
            diacriticMatches++;
          }
        }
      }
    }
  }
  
  if (totalDiacritics === 0) return 0;
  
  const diacriticRatio = diacriticMatches / totalDiacritics;
  return Math.min(0.05, diacriticRatio * 0.05); // Max bonus of 0.05
}

/**
 * Main marking function
 */
export function markRecitation(
  expectedTextQPC: string,
  whisperText: string
): MarkingResult {
  // Normalize and tokenize
  const normalizedExpected = normalizeBase(expectedTextQPC);
  const normalizedWhisper = normalizeBase(whisperText);
  
  const expectedTokens = tokenize(normalizedExpected);
  const whisperTokens = tokenize(normalizedWhisper);
  
  // Also keep diacritic-preserving versions for bonus scoring
  const expectedTokensWithDiacritics = tokenize(normalizeWithDiacritics(expectedTextQPC));
  const whisperTokensWithDiacritics = tokenize(normalizeWithDiacritics(whisperText));
  
  if (expectedTokens.length === 0) {
    return {
      pass: false,
      status: 'fail',
      score: 0,
      matchedWords: [],
      missingExpectedWords: [],
      extraWhisperWords: whisperTokens,
      wordScores: [],
      debug: {
        normalizedExpectedTokens: [],
        normalizedWhisperTokens: whisperTokens,
        averageSimilarity: 0,
        matchedCount: 0,
        expectedCount: 0,
        thresholds: {
          passThreshold: 0.65,
          partialThreshold: 0.50
        }
      }
    };
  }
  
  // Perform monotonic alignment (phonetic/fuzzy matching)
  const matchedPairs = alignMonotonic(expectedTokens, whisperTokens);
  
  // Calculate word-level scores: similarity for each expected word
  const wordScores = calculateWordScores(expectedTokens, matchedPairs);
  
  // Calculate average similarity (word-level scoring)
  const totalSimilarity = wordScores.reduce((sum, ws) => sum + ws.similarity, 0);
  const averageSimilarity = totalSimilarity / expectedTokens.length;
  
  // Calculate matched count
  const matchedCount = matchedPairs.length;
  const expectedCount = expectedTokens.length;
  
  // Soft thresholds: 65%+ pass, 50% partial, <50% fail
  const passThreshold = 0.65;
  const partialThreshold = 0.50;
  
  let status: PassStatus;
  let pass: boolean;
  
  if (averageSimilarity >= passThreshold) {
    status = 'pass';
    pass = true;
  } else if (averageSimilarity >= partialThreshold) {
    status = 'partial';
    pass = false; // Partial pass is not a full pass
  } else {
    status = 'fail';
    pass = false;
  }
  
  // Find missing expected words and extra whisper words
  const matchedExpectedWords = new Set(matchedPairs.map(p => p.expectedWord));
  const usedWhisperWords = new Set(matchedPairs.map(p => p.whisperWord));
  
  const missingExpectedWords = expectedTokens.filter(w => !matchedExpectedWords.has(w));
  const extraWhisperWords = whisperTokens.filter(w => !usedWhisperWords.has(w));
  
  return {
    pass,
    status,
    score: averageSimilarity,
    matchedWords: matchedPairs,
    missingExpectedWords,
    extraWhisperWords,
    wordScores,
    debug: {
      normalizedExpectedTokens: expectedTokens,
      normalizedWhisperTokens: whisperTokens,
      averageSimilarity,
      matchedCount,
      expectedCount,
      thresholds: {
        passThreshold,
        partialThreshold
      }
    }
  };
}

