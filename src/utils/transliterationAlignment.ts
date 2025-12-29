/**
 * Arabic chunk extraction from transliteration chunk
 * Handles merged tokens (1 translit token -> multiple Arabic words)
 */

/**
 * Normalize Arabic text for skeleton matching
 */
function normalizeArabicForSkeleton(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove diacritics
    .replace(/[\u0610-\u061A\u0640]/g, '') // Remove additional diacritics and tatweel
    .replace(/[\u06D6-\u06ED]/g, '') // Remove Quran stop marks
    .replace(/[أإآٱ]/g, 'ا') // Normalize alif variants
    .replace(/ة/g, 'ه') // Normalize ta marbuta
    .replace(/ى/g, 'ي') // Normalize ya maqsura
    .replace(/ؤ/g, 'و') // Normalize hamza on waw
    .replace(/ئ/g, 'ي') // Normalize hamza on ya
    .replace(/ء/g, '') // Remove standalone hamza
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]'"<>?،؛]/g, '') // Remove punctuation
    .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert Arabic word to rough Latin transliteration skeleton
 */
function arabicToLatinSkeleton(arabicWord: string): string {
  const normalized = normalizeArabicForSkeleton(arabicWord);
  
  // Map Arabic letters to Latin equivalents (consonant-focused)
  const arabicToLatin: { [key: string]: string } = {
    'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
    'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's',
    'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
    'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y'
  };
  
  let translit = '';
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (arabicToLatin[char]) {
      translit += arabicToLatin[char];
    }
  }
  
  // Normalize: lowercase, remove vowels, collapse repeated letters
  translit = translit.toLowerCase()
    .replace(/[aeiou]/g, '') // Remove vowels
    .replace(/(.)\1+/g, '$1'); // Collapse repeated letters (AA -> A)
  
  return translit;
}

/**
 * Normalize transliteration token to skeleton
 */
function translitToSkeleton(token: string): string {
  let normalized = token.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, '');
  
  // Normalize repeated letters (aa -> a, then remove vowels)
  normalized = normalized.replace(/(.)\1+/gi, '$1')
    .replace(/[aeiou]/g, ''); // Remove vowels
  
  return normalized;
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
 * Align transliteration tokens to Arabic words using dynamic programming
 * Returns mapping: translitTokenIndex -> arabicWordIndices[]
 * Handles 1-to-many and many-to-1 mappings
 */
function alignTranslitToArabic(
  verseTranslitTokens: string[],
  verseArabicWords: string[]
): Map<number, number[]> {
  const alignment = new Map<number, number[]>();
  
  if (verseTranslitTokens.length === 0 || verseArabicWords.length === 0) {
    return alignment;
  }
  
  // Build skeletons
  const translitSkeletons = verseTranslitTokens.map(t => translitToSkeleton(t));
  const arabicSkeletons = verseArabicWords.map(w => arabicToLatinSkeleton(w));
  
  // Use dynamic programming alignment (simplified Needleman-Wunsch style)
  // Allow 1 translit token to map to multiple Arabic words, and vice versa
  let translitIdx = 0;
  let arabicIdx = 0;
  
  while (translitIdx < verseTranslitTokens.length && arabicIdx < verseArabicWords.length) {
    const translitSkel = translitSkeletons[translitIdx];
    const currentMatches: number[] = [];
    
    // Try to match current translit token to one or more Arabic words
    let bestSim = 0;
    let bestEndIdx = arabicIdx;
    
    // Check current Arabic word
    const sim1 = editSimilarity(translitSkel, arabicSkeletons[arabicIdx]);
    if (sim1 > bestSim) {
      bestSim = sim1;
      bestEndIdx = arabicIdx;
    }
    
    // Check if translit token matches multiple Arabic words (look ahead up to 2 words)
    for (let lookAhead = 1; lookAhead <= 2 && arabicIdx + lookAhead < verseArabicWords.length; lookAhead++) {
      const combinedSkel = arabicSkeletons.slice(arabicIdx, arabicIdx + lookAhead + 1).join('');
      const sim = editSimilarity(translitSkel, combinedSkel);
      if (sim > bestSim && sim >= 0.5) {
        bestSim = sim;
        bestEndIdx = arabicIdx + lookAhead;
      }
    }
    
    // If we found a good match (similarity >= 0.5), record it
    if (bestSim >= 0.5) {
      for (let i = arabicIdx; i <= bestEndIdx; i++) {
        currentMatches.push(i);
      }
      alignment.set(translitIdx, currentMatches);
      arabicIdx = bestEndIdx + 1;
    } else {
      // No good match - skip this translit token (it might be punctuation or noise)
      alignment.set(translitIdx, []); // Empty mapping
    }
    
    translitIdx++;
  }
  
  // Handle remaining translit tokens
  while (translitIdx < verseTranslitTokens.length) {
    alignment.set(translitIdx, []);
    translitIdx++;
  }
  
  return alignment;
}

/**
 * Normalize token for matching (remove punctuation, collapse repeated letters)
 */
function normalizeTokenForMatching(token: string): string {
  return token.toLowerCase()
    .replace(/[^\w]/g, '') // Remove punctuation
    .replace(/(.)\1+/gi, '$1'); // Collapse repeated letters (AA -> A)
}

/**
 * Extract Arabic chunk from transliteration chunk
 */
export function extractArabicChunkFromTranslitChunk(
  verseTranslitTokens: string[],
  verseArabicWords: string[],
  chunkTranslitTokens: string[]
): {
  extractedArabicChunkWords: string[];
  chunkStartIndex: number;
  chunkEndIndex: number;
  error?: 'chunk_not_found';
} {
  if (chunkTranslitTokens.length === 0 || verseTranslitTokens.length === 0 || verseArabicWords.length === 0) {
    return {
      extractedArabicChunkWords: [],
      chunkStartIndex: -1,
      chunkEndIndex: -1,
      error: 'chunk_not_found'
    };
  }
  
  // Step 1-3: Find chunk tokens in verse tokens (exact match, case-insensitive)
  let chunkStartIndex = -1;
  let chunkEndIndex = -1;
  
  const normalizedVerseTokens = verseTranslitTokens.map(t => normalizeTokenForMatching(t));
  const normalizedChunkTokens = chunkTranslitTokens.map(t => normalizeTokenForMatching(t));
  
  // Try exact match
  const maxStartIdx = Math.max(0, verseTranslitTokens.length - chunkTranslitTokens.length);
  for (let i = 0; i <= maxStartIdx; i++) {
    let matches = true;
    for (let j = 0; j < normalizedChunkTokens.length; j++) {
      if (i + j >= normalizedVerseTokens.length || 
          normalizedVerseTokens[i + j] !== normalizedChunkTokens[j]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      chunkStartIndex = i;
      chunkEndIndex = i + chunkTranslitTokens.length - 1;
      break;
    }
  }
  
  if (chunkStartIndex < 0 || chunkEndIndex < 0) {
    console.error('[EXTRACT] Chunk tokens not found in verse tokens');
    console.error('[EXTRACT] Chunk tokens:', chunkTranslitTokens.join(' | '));
    return {
      extractedArabicChunkWords: [],
      chunkStartIndex: -1,
      chunkEndIndex: -1,
      error: 'chunk_not_found'
    };
  }
  
  console.log(`[EXTRACT] Found chunk at translit indices ${chunkStartIndex}-${chunkEndIndex}`);
  
  // Step 4: Align transliteration tokens to Arabic words
  const alignment = alignTranslitToArabic(verseTranslitTokens, verseArabicWords);
  
  // Step 5: Get Arabic indices covered by chunk translit tokens
  const arabicIndices = new Set<number>();
  for (let i = chunkStartIndex; i <= chunkEndIndex; i++) {
    const arabicWordIndices = alignment.get(i) || [];
    arabicWordIndices.forEach(idx => arabicIndices.add(idx));
  }
  
  if (arabicIndices.size === 0) {
    console.error('[EXTRACT] No Arabic words mapped for chunk tokens');
    return {
      extractedArabicChunkWords: [],
      chunkStartIndex: -1,
      chunkEndIndex: -1,
      error: 'chunk_not_found'
    };
  }
  
  const minArabicIdx = Math.min(...Array.from(arabicIndices));
  const maxArabicIdx = Math.max(...Array.from(arabicIndices));
  
  // Step 6: Optional buffer (only if resulting chunk > 7 words)
  const coreWordCount = maxArabicIdx - minArabicIdx + 1;
  let finalStart = minArabicIdx;
  let finalEnd = maxArabicIdx;
  
  if (coreWordCount > 7) {
    // Add buffer of 1 word before and after
    finalStart = Math.max(0, minArabicIdx - 1);
    finalEnd = Math.min(verseArabicWords.length - 1, maxArabicIdx + 1);
  }
  // If <= 7 words, no buffer (use core words only)
  
  const extractedArabicChunkWords = verseArabicWords.slice(finalStart, finalEnd + 1);
  
  console.log(`[EXTRACT] Arabic chunk indices: ${finalStart}-${finalEnd} (core: ${minArabicIdx}-${maxArabicIdx})`);
  console.log(`[EXTRACT] Extracted Arabic chunk:`, extractedArabicChunkWords.join(' | '));
  
  return {
    extractedArabicChunkWords,
    chunkStartIndex,
    chunkEndIndex
  };
}
