/**
 * Arabic verse chunking utility
 * Splits Arabic verse into chunks for recitation practice
 * Uses balanced chunking to avoid very small or very large chunks
 */

/**
 * Split Arabic verse into balanced chunks
 * Tries to keep chunks up to 8 words max, avoiding chunks smaller than 6 words
 */
export function splitArabicVerseIntoChunks(
  arabicVerse: string,
  maxWordsPerChunk: number = 8
): string[] {
  if (!arabicVerse) return [];
  
  // Split by whitespace and filter empty strings
  const words = arabicVerse.trim().split(/\s+/).filter(w => w.length > 0);
  
  if (words.length === 0) return [];
  
  // If verse is short (<= maxWordsPerChunk words), return as single chunk
  if (words.length <= maxWordsPerChunk) {
    return [words.join(' ')];
  }
  
  // Calculate optimal number of chunks to balance sizes
  // Target: up to maxWordsPerChunk words per chunk (prefer 6-8)
  const targetWordsPerChunk = Math.min(7, maxWordsPerChunk);
  let numChunks = Math.ceil(words.length / targetWordsPerChunk);
  
  // Adjust to avoid very small chunks
  // If last chunk would be < 6 words, reduce number of chunks
  while (numChunks > 1 && words.length / numChunks < 6) {
    numChunks--;
  }
  
  // Calculate words per chunk (distribute evenly)
  const baseWordsPerChunk = Math.floor(words.length / numChunks);
  const remainder = words.length % numChunks;
  
  const chunks: string[] = [];
  let currentIndex = 0;
  
  // Distribute words across chunks
  for (let i = 0; i < numChunks; i++) {
    // Add one extra word to first 'remainder' chunks to balance
    const chunkSize = baseWordsPerChunk + (i < remainder ? 1 : 0);
    const chunkWords = words.slice(currentIndex, currentIndex + chunkSize);
    chunks.push(chunkWords.join(' '));
    currentIndex += chunkSize;
  }
  
  // Post-process: 
  // 1. Split chunks that exceed maxWordsPerChunk
  // 2. Merge very small chunks (< 6 words) with previous chunk
  const finalChunks: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkWords = chunks[i].split(/\s+/);
    const chunkWordCount = chunkWords.length;
    
    // Split chunks that exceed maxWordsPerChunk
    if (chunkWordCount > maxWordsPerChunk) {
      // Split into multiple chunks of maxWordsPerChunk size
      for (let j = 0; j < chunkWords.length; j += maxWordsPerChunk) {
        const splitChunk = chunkWords.slice(j, j + maxWordsPerChunk).join(' ');
        finalChunks.push(splitChunk);
      }
    } else if (chunkWordCount < 6 && finalChunks.length > 0) {
      // Merge very small chunks with previous chunk
      const prevChunk = finalChunks.pop() || '';
      finalChunks.push(prevChunk + ' ' + chunks[i]);
    } else {
      finalChunks.push(chunks[i]);
    }
  }
  
  return finalChunks;
}

/**
 * Get the exact chunk string that should be displayed to the user
 * This is the SINGLE SOURCE OF TRUTH for chunk extraction
 * Both HomeScreen and TestScreen MUST use this function
 */
export function getChunkString(
  arabicVerse: string,
  chunkIndex: number,
  maxWordsPerChunk: number = 8
): string {
  if (!arabicVerse) return '';
  
  const chunks = splitArabicVerseIntoChunks(arabicVerse, maxWordsPerChunk);
  if (chunks.length === 0) return '';
  
  // Use same index logic as HomeScreen: Math.min(chunkIndex, chunks.length - 1)
  const safeChunkIndex = Math.min(chunkIndex, chunks.length - 1);
  return chunks[safeChunkIndex];
}

/**
 * Extract Arabic chunk words from verse by chunk index
 */
export function extractArabicChunkWords(
  arabicVerse: string,
  chunkIndex: number,
  maxWordsPerChunk: number = 8
): {
  chunkWords: string[];
  chunkStartIndex: number;
  chunkEndIndex: number;
} {
  if (!arabicVerse) {
    return {
      chunkWords: [],
      chunkStartIndex: -1,
      chunkEndIndex: -1
    };
  }
  
  const words = arabicVerse.trim().split(/\s+/).filter(w => w.length > 0);
  const chunks = splitArabicVerseIntoChunks(arabicVerse, maxWordsPerChunk);
  
  if (chunkIndex < 0 || chunkIndex >= chunks.length) {
    return {
      chunkWords: [],
      chunkStartIndex: -1,
      chunkEndIndex: -1
    };
  }
  
  // Calculate start and end indices by summing word counts of previous chunks
  let chunkStartIndex = 0;
  for (let i = 0; i < chunkIndex; i++) {
    const prevChunkWordCount = chunks[i].split(/\s+/).length;
    chunkStartIndex += prevChunkWordCount;
  }
  
  const currentChunkWordCount = chunks[chunkIndex].split(/\s+/).length;
  const chunkEndIndex = chunkStartIndex + currentChunkWordCount - 1;
  const chunkWords = words.slice(chunkStartIndex, chunkEndIndex + 1);
  
  return {
    chunkWords,
    chunkStartIndex,
    chunkEndIndex
  };
}

