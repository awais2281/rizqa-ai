/**
 * Controlled lenient scoring for Arabic recitation
 * Scores Whisper transcription against expected Arabic chunk
 */

/**
 * Normalize Arabic text for matching
 */
export function normalizeArabic(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove diacritics (tashkeel)
    .replace(/[\u0610-\u061A\u0640]/g, '') // Remove additional diacritics and tatweel
    .replace(/[\u06D6-\u06ED]/g, '') // Remove Quranic annotation marks
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]'"<>?،؛]/g, '') // Remove punctuation
    .replace(/[أإآٱ]/g, 'ا') // Normalize: أإآٱ -> ا
    .replace(/ة/g, 'ه') // Normalize: ة -> ه
    .replace(/ى/g, 'ي') // Normalize: ى -> ي
    .replace(/\u06CC/g, '\u064A') // Normalize: Persian ی (U+06CC) -> Arabic ي (U+064A)
    .replace(/ؤ/g, 'و') // Normalize: ؤ -> و
    .replace(/ئ/g, 'ي') // Normalize: ئ -> ي
    .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenize Arabic text by whitespace
 */
export function tokenizeArabic(text: string): string[] {
  if (!text) return [];
  return text.split(/\s+/).filter(token => token.length > 0);
}

/**
 * Get skeleton by removing vowel-like letters (ا, و, ي)
 */
function getSkeleton(text: string): string {
  if (!text) return '';
  return text.replace(/[اوي]/g, '');
}

/**
 * Calculate edit distance similarity
 */
function editSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  
  const lenA = a.length;
  const lenB = b.length;
  const matrix: number[][] = [];
  
  for (let i = 0; i <= lenA; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lenB; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[lenA][lenB];
  const maxLen = Math.max(lenA, lenB);
  return maxLen === 0 ? 1 : 1 - (distance / maxLen);
}

/**
 * Check if expected word matches whisper word
 */
function wordsMatch(
  expectedWord: string,
  whisperWord: string
): { matches: boolean; similarity: number; method: 'exact' | 'skeleton' | 'fuzzy' } | null {
  const normalizedExpected = normalizeArabic(expectedWord);
  const normalizedWhisper = normalizeArabic(whisperWord);
  
  // Rule 1: Exact match
  if (normalizedExpected === normalizedWhisper) {
    return { matches: true, similarity: 1.0, method: 'exact' };
  }
  
  // Rule 2: Skeleton match (remove vowels, similarity >= 0.75)
  const expectedSkeleton = getSkeleton(normalizedExpected);
  const whisperSkeleton = getSkeleton(normalizedWhisper);
  
  if (expectedSkeleton.length >= 3 && whisperSkeleton.length >= 3) {
    const skeletonSim = editSimilarity(expectedSkeleton, whisperSkeleton);
    if (skeletonSim >= 0.75) {
      return { matches: true, similarity: skeletonSim, method: 'skeleton' };
    }
  }
  
  // Rule 3: Fuzzy edit similarity (>= 0.80)
  const fuzzySim = editSimilarity(normalizedExpected, normalizedWhisper);
  if (fuzzySim >= 0.80) {
    return { matches: true, similarity: fuzzySim, method: 'fuzzy' };
  }
  
  return null;
}

/**
 * Match expected words to whisper words (greedy best-match, one-to-one)
 */
function matchWords(
  expectedWords: string[],
  whisperWords: string[]
): Array<{ expectedWord: string; whisperWord: string; method: 'exact' | 'skeleton' | 'fuzzy'; similarity: number }> {
  const matches: Array<{ expectedWord: string; whisperWord: string; method: 'exact' | 'skeleton' | 'fuzzy'; similarity: number }> = [];
  const usedWhisperIndices = new Set<number>();
  
  // Build all possible matches
  type MatchCandidate = {
    expectedIdx: number;
    whisperIdx: number;
    similarity: number;
    method: 'exact' | 'skeleton' | 'fuzzy';
  };
  
  const allCandidates: MatchCandidate[] = [];
  
  expectedWords.forEach((expectedWord, expectedIdx) => {
    whisperWords.forEach((whisperWord, whisperIdx) => {
      const matchResult = wordsMatch(expectedWord, whisperWord);
      if (matchResult && matchResult.matches) {
        allCandidates.push({
          expectedIdx,
          whisperIdx,
          similarity: matchResult.similarity,
          method: matchResult.method
        });
      }
    });
  });
  
  // Sort by method priority (exact > skeleton > fuzzy) and similarity
  const methodPriority = { exact: 3, skeleton: 2, fuzzy: 1 };
  allCandidates.sort((a, b) => {
    if (methodPriority[b.method] !== methodPriority[a.method]) {
      return methodPriority[b.method] - methodPriority[a.method];
    }
    return b.similarity - a.similarity;
  });
  
  // Greedy assignment: one-to-one matching
  const usedExpectedIndices = new Set<number>();
  
  for (const candidate of allCandidates) {
    if (!usedExpectedIndices.has(candidate.expectedIdx) && !usedWhisperIndices.has(candidate.whisperIdx)) {
      matches.push({
        expectedWord: expectedWords[candidate.expectedIdx],
        whisperWord: whisperWords[candidate.whisperIdx],
        method: candidate.method,
        similarity: candidate.similarity
      });
      usedExpectedIndices.add(candidate.expectedIdx);
      usedWhisperIndices.add(candidate.whisperIdx);
    }
  }
  
  return matches;
}

/**
 * Map matched count to percent score
 */
function matchedCountToPercent(matchedCount: number, expectedCount: number): number {
  if (expectedCount === 0) return 0;
  if (matchedCount === 0) return 0;
  if (matchedCount === 1) return 10;
  if (matchedCount === 2) return 35;
  if (matchedCount === 3) return 50;
  if (matchedCount === 4) return 60;
  if (matchedCount === 5) return 60;
  if (matchedCount === 6) return 70;
  if (matchedCount === 7) return 80;
  if (matchedCount >= expectedCount) return 100;
  
  // For other counts, use ratio and snap to nearest band
  const ratio = matchedCount / expectedCount;
  const bands = [0, 10, 35, 50, 60, 70, 80, 100];
  const ratioBands = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0];
  
  // Find nearest band
  let nearestBand = 0;
  let minDist = Math.abs(ratio - 0);
  
  for (let i = 0; i < ratioBands.length; i++) {
    const dist = Math.abs(ratio - ratioBands[i]);
    if (dist < minDist) {
      minDist = dist;
      nearestBand = bands[Math.min(i, bands.length - 1)];
    }
  }
  
  return Math.max(0, Math.min(100, nearestBand));
}

/**
 * Score Whisper transcription against expected Arabic chunk
 */
export function scoreWhisperAgainstChunk(
  expectedArabicChunkWords: string[],
  whisperArabicText: string
): {
  matchedCount: number;
  expectedCount: number;
  percent: number;
  pass: boolean;
  matchedPairs: Array<{ expectedWord: string; whisperWord: string; method: 'exact' | 'skeleton' | 'fuzzy'; similarity: number }>;
} {
  if (expectedArabicChunkWords.length === 0) {
    return {
      matchedCount: 0,
      expectedCount: 0,
      percent: 0,
      pass: false,
      matchedPairs: []
    };
  }
  
  if (!whisperArabicText || whisperArabicText.trim().length === 0) {
    return {
      matchedCount: 0,
      expectedCount: expectedArabicChunkWords.length,
      percent: 0,
      pass: false,
      matchedPairs: []
    };
  }
  
  // Normalize and tokenize
  const normalizedExpectedWords = expectedArabicChunkWords.map(w => normalizeArabic(w));
  const normalizedWhisper = normalizeArabic(whisperArabicText);
  const whisperWords = tokenizeArabic(normalizedWhisper);
  
  // Match words
  const matchedPairs = matchWords(normalizedExpectedWords, whisperWords);
  
  const matchedCount = matchedPairs.length;
  const expectedCount = expectedArabicChunkWords.length;
  const percent = matchedCountToPercent(matchedCount, expectedCount);
  
  // Pass if percent >= 60
  const pass = percent >= 60;
  
  return {
    matchedCount,
    expectedCount,
    percent,
    pass,
    matchedPairs
  };
}
