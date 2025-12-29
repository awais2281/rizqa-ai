/**
 * Lenient Quran Chunk Verification System
 * Designed for QPC Hafs text with Whisper ASR output
 */

export interface AlignedPair {
  expected: string;
  transcript: string;
  score: number;
  i: number; // index in expected tokens
  j: number; // index in transcript tokens
}

export interface VerificationResult {
  pass: boolean;
  coverage: number; // totalMatchedScore / expectedCount
  matchedCount: number; // pairs with score >= 0.72
  avgSim: number; // average score over matchedPairs
  orderSpan: number; // (maxJ - minJ + 1) over matchedPairs
  alignedPairs: AlignedPair[]; // all aligned pairs for debugging
}

interface Token {
  surface: string;
  skeleton: string;
}

// Diacritics (harakat/tashkeel)
const DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u0640]/g;

// Quranic symbols and pause marks
const QURANIC_SYMBOLS_REGEX = /[\u06D6-\u06ED\u06F0-\u06F9\u06FD-\u06FE\u0600-\u0605\u0610-\u061A\u06E5-\u06E6\u06FA-\u06FC\u06DD-\u06DF]/g;

// Arabic-Indic digits
const ARABIC_DIGITS_REGEX = /[\u0660-\u0669\u06F0-\u06F9]/g;

/**
 * Robust Arabic normalization (QPC-safe)
 */
export function normalizeArabicQpc(text: string): string {
  if (!text) return '';
  
  return text
    // Remove all harakat/diacritics and combining marks
    .replace(DIACRITICS_REGEX, '')
    // Remove tatweel
    .replace(/\u0640/g, '')
    // Remove Quranic symbols and pause marks
    .replace(QURANIC_SYMBOLS_REGEX, '')
    // Remove ayah numbers and Arabic-Indic digits
    .replace(ARABIC_DIGITS_REGEX, '')
    // Remove punctuation
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]'"<>?،؛]/g, '')
    // Normalize letters
    .replace(/[أإآٱ]/g, 'ا')  // أ إ آ ٱ -> ا
    .replace(/ؤ/g, 'و')        // ؤ -> و
    .replace(/ئ/g, 'ي')       // ئ -> ي
    .replace(/ى/g, 'ي')       // ى -> ي
    .replace(/\u06CC/g, '\u064A') // Normalize: Persian ی (U+06CC) -> Arabic ي (U+064A)
    .replace(/ة/g, 'ه')       // ة -> ه
    // Remove non-Arabic letters except whitespace
    .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]/g, '')
    // Collapse whitespace and trim
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenize normalized text
 */
function tokenize(text: string): string[] {
  if (!text) return [];
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Convert token to skeleton (remove weak letters and collapse repeats)
 */
function toSkeleton(token: string): string {
  if (!token) return '';
  
  // Remove weak letters: ا و ي
  let skeleton = token.replace(/[اوي]/g, '');
  
  // Collapse repeated letters: (.)\1+ -> $1
  skeleton = skeleton.replace(/(.)\1+/g, '$1');
  
  // Keep at least 2 chars if possible; if becomes empty, fallback to surface
  if (skeleton.length < 2 && token.length >= 2) {
    // Fallback: use surface but still collapse repeats
    skeleton = token.replace(/(.)\1+/g, '$1');
    // If still too short, return original token
    if (skeleton.length < 1) {
      skeleton = token;
    }
  } else if (skeleton.length === 0) {
    skeleton = token;
  }
  
  return skeleton;
}

/**
 * Build token objects with surface and skeleton
 */
function buildTokens(tokens: string[]): Token[] {
  return tokens.map(token => ({
    surface: token,
    skeleton: toSkeleton(token)
  }));
}

/**
 * Normalized Levenshtein distance returning similarity 0..1
 */
function normalizedLevenshtein(a: string, b: string): number {
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
 * Calculate match score between expected and transcript tokens
 */
function matchScore(expectedToken: Token, transcriptToken: Token): number {
  // Exact surface match
  if (expectedToken.surface === transcriptToken.surface) {
    return 1.0;
  }
  
  // Calculate similarities
  const sim1 = normalizedLevenshtein(expectedToken.surface, transcriptToken.surface);
  const sim2 = normalizedLevenshtein(expectedToken.skeleton, transcriptToken.skeleton);
  
  // score = max(sim1*0.85, sim2)
  return Math.max(sim1 * 0.85, sim2);
}

/**
 * Best alignment using dynamic programming (monotonic)
 */
function bestAlignment(expectedTokens: Token[], transcriptTokens: Token[]): AlignedPair[] {
  const m = expectedTokens.length;
  const n = transcriptTokens.length;
  
  if (m === 0 || n === 0) {
    return [];
  }
  
  // DP table: dp[i][j] = best score aligning expected[0..i-1] with transcript[0..j-1]
  const dp: number[][] = [];
  const path: Array<Array<'match' | 'skip_transcript' | 'skip_expected' | null>> = [];
  
  // Initialize
  for (let i = 0; i <= m; i++) {
    dp[i] = [];
    path[i] = [];
    for (let j = 0; j <= n; j++) {
      dp[i][j] = -Infinity;
      path[i][j] = null;
    }
  }
  
  dp[0][0] = 0;
  
  // Fill DP table
  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      if (i === 0 && j === 0) continue;
      
      // Match: (i-1, j-1) + matchScore(i-1, j-1)
      if (i > 0 && j > 0) {
        const score = matchScore(expectedTokens[i - 1], transcriptTokens[j - 1]);
        const matchValue = dp[i - 1][j - 1] + score;
        if (matchValue > dp[i][j]) {
          dp[i][j] = matchValue;
          path[i][j] = 'match';
        }
      }
      
      // Skip transcript (insertion): (i, j-1) - 0.15
      if (j > 0) {
        const skipTransValue = dp[i][j - 1] - 0.15;
        if (skipTransValue > dp[i][j]) {
          dp[i][j] = skipTransValue;
          path[i][j] = 'skip_transcript';
        }
      }
      
      // Skip expected (deletion): (i-1, j) - 0.35
      if (i > 0) {
        const skipExpValue = dp[i - 1][j] - 0.35;
        if (skipExpValue > dp[i][j]) {
          dp[i][j] = skipExpValue;
          path[i][j] = 'skip_expected';
        }
      }
    }
  }
  
  // Reconstruct aligned pairs
  const alignedPairs: AlignedPair[] = [];
  let i = m;
  let j = n;
  
  while (i > 0 || j > 0) {
    const move = path[i][j];
    
    if (move === 'match' && i > 0 && j > 0) {
      const score = matchScore(expectedTokens[i - 1], transcriptTokens[j - 1]);
      alignedPairs.unshift({
        expected: expectedTokens[i - 1].surface,
        transcript: transcriptTokens[j - 1].surface,
        score,
        i: i - 1,
        j: j - 1
      });
      i--;
      j--;
    } else if (move === 'skip_transcript' && j > 0) {
      j--;
    } else if (move === 'skip_expected' && i > 0) {
      i--;
    } else {
      // Fallback: move back
      if (i > 0) i--;
      else if (j > 0) j--;
      else break;
    }
  }
  
  return alignedPairs;
}

/**
 * Main verification function
 */
export function verifyRecitation(
  expectedChunkArabic: string,
  whisperTranscriptArabic: string
): VerificationResult {
  // Normalize
  const normalizedExpected = normalizeArabicQpc(expectedChunkArabic);
  const normalizedTranscript = normalizeArabicQpc(whisperTranscriptArabic);
  
  // Tokenize
  const expectedTokenStrings = tokenize(normalizedExpected);
  const transcriptTokenStrings = tokenize(normalizedTranscript);
  
  if (expectedTokenStrings.length === 0) {
    return {
      pass: false,
      coverage: 0,
      matchedCount: 0,
      avgSim: 0,
      orderSpan: Infinity,
      alignedPairs: []
    };
  }
  
  // Build token objects
  const expectedTokens = buildTokens(expectedTokenStrings);
  const transcriptTokens = buildTokens(transcriptTokenStrings);
  
  // Get best alignment
  const alignedPairs = bestAlignment(expectedTokens, transcriptTokens);
  
  // Calculate scores
  const expectedCount = expectedTokens.length;
  
  // totalMatchedScore = sum(scores of matched steps where score > 0)
  const totalMatchedScore = alignedPairs
    .filter(p => p.score > 0)
    .reduce((sum, p) => sum + p.score, 0);
  
  // coverage = totalMatchedScore / expectedCount
  const coverage = totalMatchedScore / expectedCount;
  
  // matchedPairs = pairs with score >= 0.72
  const matchedPairs = alignedPairs.filter(p => p.score >= 0.72);
  const matchedCount = matchedPairs.length;
  
  // avgSim = average(score) over matchedPairs
  const avgSim = matchedPairs.length > 0
    ? matchedPairs.reduce((sum, p) => sum + p.score, 0) / matchedPairs.length
    : 0;
  
  // orderSpan = (maxJ - minJ + 1) over matchedPairs
  let orderSpan = Infinity;
  if (matchedPairs.length > 0) {
    const jIndices = matchedPairs.map(p => p.j);
    const minJ = Math.min(...jIndices);
    const maxJ = Math.max(...jIndices);
    orderSpan = maxJ - minJ + 1;
  }
  
  // Decision: PASS if all conditions met
  const pass = coverage >= 0.62 &&
               matchedCount >= Math.max(4, Math.ceil(expectedCount * 0.55)) &&
               avgSim >= 0.78 &&
               orderSpan <= expectedCount * 4;
  
  return {
    pass,
    coverage,
    matchedCount,
    avgSim,
    orderSpan,
    alignedPairs
  };
}


