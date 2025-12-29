/**
 * Lenient Quran Recitation Confirmation System
 * Anchor-based verification for chunk recitation
 */

export type ConfirmationStatus = 'PASS' | 'TRY_AGAIN' | 'FAIL';

export interface MatchedAnchor {
  anchor: string;
  whisperToken: string;
  whisperIndex: number; // Position in whisperTokens array
  type: 'exact' | 'levenshtein' | 'skeleton';
  score: number;
}

export interface ConfirmationResult {
  status: ConfirmationStatus;
  anchorHitRate: number;
  orderScore: number;
  matchedAnchors: MatchedAnchor[];
  missingAnchors: string[];
  debug?: {
    expectedChunk: string;
    whisperText: string;
    anchors: string[];
    hardAnchors: string[];
    matchedAnchorsDetails: MatchedAnchor[];
    missingAnchorsDetails: string[];
  };
}

// Arabic stopwords (tunable)
const ARABIC_STOPWORDS = new Set([
  'و', 'ف', 'ثم', 'ما', 'لا', 'من', 'في', 'على', 'الى', 'إلى',
  'عن', 'أن', 'ان', 'إن', 'انه', 'هذا', 'هذه', 'ذلك', 'تلك'
]);

// Diacritics/tashkeel/harakat
const DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

// Quran stop signs and punctuation
const QURAN_SIGNS_REGEX = /[\u06D6-\u06ED\u06F0-\u06F9\u06FD-\u06FE\u0600-\u0605\u0610-\u061A\u06E5-\u06E6\u06FA-\u06FC]/g;

/**
 * Normalize Arabic text
 */
export function normalizeArabic(text: string): string {
  if (!text) return '';
  
  return text
    // Remove tashkeel/harakat
    .replace(DIACRITICS_REGEX, '')
    // Remove tatweel
    .replace(/\u0640/g, '')
    // Remove Quran stop signs
    .replace(QURAN_SIGNS_REGEX, '')
    // Remove punctuation
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]'"<>?،؛]/g, '')
    // Normalize letters
    .replace(/[أإآٱ]/g, 'ا')  // أ إ آ ٱ -> ا
    .replace(/ؤ/g, 'و')        // ؤ -> و
    .replace(/ئ/g, 'ي')       // ئ -> ي
    .replace(/ى/g, 'ي')       // ى -> ي
    .replace(/\u06CC/g, '\u064A') // Normalize: Persian ی (U+06CC) -> Arabic ي (U+064A)
    .replace(/ة/g, 'ه')      // ة -> ه (configurable)
    // Remove non-Arabic letters except spaces
    .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenize Arabic text
 */
export function tokenizeArabic(text: string): string[] {
  const normalized = normalizeArabic(text);
  return normalized.split(/\s+/).filter(token => token.length > 0);
}

/**
 * Build anchor words from expected chunk
 */
function buildAnchors(
  expectedTokens: string[],
  hardAnchors: string[] = []
): string[] {
  // Remove stopwords and keep tokens length >= 3
  let anchors = expectedTokens
    .filter(token => !ARABIC_STOPWORDS.has(token) && token.length >= 3);
  
  // Deduplicate while preserving order
  const seen = new Set<string>();
  anchors = anchors.filter(token => {
    if (seen.has(token)) return false;
    seen.add(token);
    return true;
  });
  
  // If anchors > 12, keep the first 12
  if (anchors.length > 12) {
    anchors = anchors.slice(0, 12);
  }
  
  // If anchors < 5, fall back to using all tokens length >= 2
  if (anchors.length < 5) {
    anchors = expectedTokens
      .filter(token => token.length >= 2);
    
    // Deduplicate again
    const seen2 = new Set<string>();
    anchors = anchors.filter(token => {
      if (seen2.has(token)) return false;
      seen2.add(token);
      return true;
    });
  }
  
  // Add hard anchors at the beginning (if not already present)
  const hardAnchorsSet = new Set(hardAnchors);
  const existingAnchorsSet = new Set(anchors);
  const newHardAnchors = hardAnchors.filter(a => !existingAnchorsSet.has(a));
  anchors = [...newHardAnchors, ...anchors];
  
  return anchors;
}

/**
 * Get skeleton by removing vowel-like letters (ا, و, ي)
 */
function getSkeleton(token: string): string {
  return token.replace(/[اوي]/g, '');
}

/**
 * Calculate normalized Levenshtein similarity
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
 * Find best match for an anchor among whisper tokens
 */
function findBestMatch(
  anchor: string,
  whisperTokens: string[],
  usedIndices: Set<number>
): MatchedAnchor | null {
  let bestMatch: MatchedAnchor | null = null;
  let bestIndex = -1;
  
  for (let i = 0; i < whisperTokens.length; i++) {
    if (usedIndices.has(i)) continue;
    
    const whisperToken = whisperTokens[i];
    
    // a) Exact equality
    if (anchor === whisperToken) {
      usedIndices.add(i);
      return {
        anchor,
        whisperToken,
        whisperIndex: i,
        type: 'exact',
        score: 1.0
      };
    }
    
    // b) Normalized Levenshtein similarity >= 0.78
    const levSim = levenshteinSimilarity(anchor, whisperToken);
    if (levSim >= 0.78) {
      if (!bestMatch || levSim > bestMatch.score) {
        bestMatch = {
          anchor,
          whisperToken,
          whisperIndex: i,
          type: 'levenshtein',
          score: levSim
        };
        bestIndex = i;
      }
    }
    
    // c) Skeleton match (only if similarity >= 0.7)
    const anchorSkeleton = getSkeleton(anchor);
    const whisperSkeleton = getSkeleton(whisperToken);
    
    if (anchorSkeleton.length >= 2 && whisperSkeleton.length >= 2) {
      const skeletonSim = levenshteinSimilarity(anchorSkeleton, whisperSkeleton);
      if (skeletonSim >= 0.7) {
        // Use skeleton score but require it to be better than current best
        if (!bestMatch || skeletonSim > bestMatch.score) {
          bestMatch = {
            anchor,
            whisperToken,
            whisperIndex: i,
            type: 'skeleton',
            score: skeletonSim
          };
          bestIndex = i;
        }
      }
    }
  }
  
  if (bestMatch && bestIndex >= 0) {
    usedIndices.add(bestIndex);
  }
  
  return bestMatch;
}

/**
 * Calculate order score by checking if matched anchors appear in correct order
 * Tracks the actual positions where matches occurred in whisper tokens
 */
function calculateOrderScore(
  anchors: string[],
  matchedAnchors: MatchedAnchor[],
  whisperTokens: string[]
): number {
  if (matchedAnchors.length === 0) return 0;
  if (matchedAnchors.length === 1) return 1.0;
  
  // Create map: anchor -> expected index
  const anchorToExpectedIndex = new Map<string, number>();
  anchors.forEach((anchor, idx) => {
    anchorToExpectedIndex.set(anchor, idx);
  });
  
  // Find positions of matched whisper tokens in the whisper array
  // Build pairs of (expectedIndex, whisperPosition)
  const pairs: Array<{ expectedIdx: number; whisperPos: number }> = [];
  
  for (const match of matchedAnchors) {
    const expectedIdx = anchorToExpectedIndex.get(match.anchor);
    if (expectedIdx !== undefined) {
      // Use the stored whisperIndex from the match
      pairs.push({ expectedIdx, whisperPos: match.whisperIndex });
    }
  }
  
  // Sort by whisper position to see order they appear
  pairs.sort((a, b) => a.whisperPos - b.whisperPos);
  
  // Check if expected indices are in increasing order
  // (meaning anchors appear in correct order in whisper)
  let increasingCount = 0;
  for (let i = 1; i < pairs.length; i++) {
    if (pairs[i].expectedIdx >= pairs[i - 1].expectedIdx) {
      increasingCount++;
    }
  }
  
  // Order score = ratio of correctly ordered pairs
  const maxPairs = pairs.length - 1;
  return maxPairs > 0 ? increasingCount / maxPairs : 1.0;
}

/**
 * Main confirmation function
 */
export function confirmRecitation(
  expectedChunkArabic: string,
  whisperTranscriptArabic: string,
  hardAnchors: string[] = [],
  enableDebug: boolean = false
): ConfirmationResult {
  // Normalize and tokenize
  const expectedTokens = tokenizeArabic(expectedChunkArabic);
  const whisperTokens = tokenizeArabic(whisperTranscriptArabic);
  
  // Build anchors
  const anchors = buildAnchors(expectedTokens, hardAnchors);
  
  // Match anchors to whisper tokens (greedy)
  const matchedAnchors: MatchedAnchor[] = [];
  const usedWhisperIndices = new Set<number>();
  
  for (const anchor of anchors) {
    const match = findBestMatch(anchor, whisperTokens, usedWhisperIndices);
    if (match) {
      matchedAnchors.push(match);
    }
  }
  
  // Calculate scores
  const totalAnchors = anchors.length;
  const matchedCount = matchedAnchors.length;
  const anchorHitRate = totalAnchors > 0 ? matchedCount / totalAnchors : 0;
  
  const orderScore = calculateOrderScore(anchors, matchedAnchors, whisperTokens);
  
  // Check hard anchors
  const hardAnchorsSet = new Set(hardAnchors);
  const matchedAnchorsSet = new Set(matchedAnchors.map(m => m.anchor));
  const allHardAnchorsMatched = hardAnchors.length === 0 || 
    hardAnchors.every(ha => matchedAnchorsSet.has(ha));
  
  // Determine status
  let status: ConfirmationStatus;
  
  if (anchorHitRate >= 0.60 && orderScore >= 0.60 && allHardAnchorsMatched) {
    status = 'PASS';
  } else if (
    (anchorHitRate >= 0.40 && anchorHitRate < 0.60) ||
    (orderScore < 0.60 && allHardAnchorsMatched && anchorHitRate >= 0.40)
  ) {
    status = 'TRY_AGAIN';
  } else {
    status = 'FAIL';
  }
  
  // Find missing anchors
  const matchedAnchorsSet2 = new Set(matchedAnchors.map(m => m.anchor));
  const missingAnchors = anchors.filter(a => !matchedAnchorsSet2.has(a));
  
  const result: ConfirmationResult = {
    status,
    anchorHitRate,
    orderScore,
    matchedAnchors,
    missingAnchors
  };
  
  // Add debug info if enabled
  if (enableDebug) {
    result.debug = {
      expectedChunk: expectedChunkArabic,
      whisperText: whisperTranscriptArabic,
      anchors,
      hardAnchors,
      matchedAnchorsDetails: matchedAnchors,
      missingAnchorsDetails: missingAnchors
    };
  }
  
  return result;
}

