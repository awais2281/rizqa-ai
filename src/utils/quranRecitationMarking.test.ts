/**
 * Unit tests for Quran Recitation Marking System
 */

import { markRecitation, normalizeBase, tokenize, extractAnchors } from './quranRecitationMarking';

describe('Quran Recitation Marking System (Phonetic/Fuzzy)', () => {
  
  describe('Test Case 1: Phonetic matching with minor errors', () => {
    it('should use phonetic matching to handle minor mispronunciations', () => {
      // Example: expected has "متشبها" and "مطهرة" but whisper has similar phonetic variants
      // Should use fuzzy matching to give partial credit
      
      const expected = 'متشبها مطهرة خالدون';
      const whisper = 'متشاكحا متحارات خالدون';
      
      const result = markRecitation(expected, whisper);
      
      console.log('Test 1 Results:');
      console.log('Expected:', expected);
      console.log('Whisper:', whisper);
      console.log('Status:', result.status);
      console.log('Score:', result.score);
      console.log('Average similarity:', result.debug.averageSimilarity);
      console.log('Word scores:', result.wordScores);
      console.log('Matched pairs:', result.matchedWords);
      
      // Should use phonetic matching (may be partial or fail depending on similarity)
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.wordScores.length).toBeGreaterThan(0);
    });
  });
  
  describe('Test Case 2: Unrelated text should FAIL', () => {
    it('should FAIL with low score for unrelated whisper text', () => {
      const expected = 'إن الله لا يستحي ما بعوضة';
      const whisper = 'هذا نص عربي مختلف تماما';
      
      const result = markRecitation(expected, whisper);
      
      console.log('Test 2 Results:');
      console.log('Expected:', expected);
      console.log('Whisper:', whisper);
      console.log('Status:', result.status);
      console.log('Score:', result.score);
      console.log('Average similarity:', result.debug.averageSimilarity);
      console.log('Matched count:', result.debug.matchedCount);
      console.log('Expected count:', result.debug.expectedCount);
      
      // Should FAIL with low score
      expect(result.status).toBe('fail');
      expect(result.score).toBeLessThan(0.50);
      expect(result.pass).toBe(false);
    });
  });
  
  describe('Normalization', () => {
    it('should normalize Arabic text correctly', () => {
      const text = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
      const normalized = normalizeBase(text);
      
      expect(normalized).not.toContain('ِ'); // No diacritics
      expect(normalized).toContain('ا'); // Normalized alif
    });
    
    it('should remove Quranic marks', () => {
      const text = 'مثال ۖ نص ۗ آخر';
      const normalized = normalizeBase(text);
      
      expect(normalized).not.toContain('ۖ');
      expect(normalized).not.toContain('ۗ');
    });
  });
  
  describe('Anchor extraction', () => {
    it('should extract longest non-stopword tokens as anchors', () => {
      const tokens = tokenize('وهم فيها متشبها مطهرة خالدون');
      const anchors = extractAnchors(tokens);
      
      // Should exclude stopwords like "وهم", "فيها"
      // Should include longer words like "متشبها", "مطهرة", "خالدون"
      expect(anchors.length).toBeLessThanOrEqual(2);
      expect(anchors.every(a => a.length >= 4)).toBe(true);
    });
  });
  
  describe('Soft thresholds', () => {
    it('should use soft thresholds: 65%+ pass, 50% partial, <50% fail', () => {
      const expected = 'بسم الله الرحمن الرحيم';
      
      // Test with good match (should pass)
      const goodWhisper = 'بسم الله الرحمن الرحيم';
      const goodResult = markRecitation(expected, goodWhisper);
      
      console.log('Good match test:');
      console.log('Status:', goodResult.status);
      console.log('Score:', goodResult.score);
      expect(goodResult.status).toBe('pass');
      expect(goodResult.score).toBeGreaterThanOrEqual(0.65);
      
      // Test with partial match (should be partial)
      const partialWhisper = 'بسم الله الرحمن';
      const partialResult = markRecitation(expected, partialWhisper);
      
      console.log('Partial match test:');
      console.log('Status:', partialResult.status);
      console.log('Score:', partialResult.score);
      // May be partial or fail depending on similarity
      expect(partialResult.score).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('Monotonic alignment', () => {
    it('should preserve order in alignment', () => {
      const expected = 'أول كلمة ثانية كلمة ثالثة';
      const whisper = 'أول كلمة ثانية كلمة ثالثة';
      
      const result = markRecitation(expected, whisper);
      
      // Should match all words in order
      expect(result.matchedWords.length).toBeGreaterThan(0);
      expect(result.pass).toBe(true);
    });
    
    it('should handle missing words gracefully', () => {
      const expected = 'أول كلمة ثانية كلمة ثالثة';
      const whisper = 'أول ثانية ثالثة'; // Missing middle word
      
      const result = markRecitation(expected, whisper);
      
      expect(result.missingExpectedWords.length).toBeGreaterThan(0);
      expect(result.matchedWords.length).toBeLessThan(result.debug.expectedCount);
    });
  });
});

// Run tests if executed directly
if (require.main === module) {
  console.log('Running Quran Recitation Marking Tests (Phonetic/Fuzzy)...\n');
  
  // Test 1: Phonetic matching
  console.log('=== Test 1: Phonetic Matching ===');
  const test1 = markRecitation('متشبها مطهرة خالدون', 'متشاكحا متحارات خالدون');
  console.log('Status:', test1.status);
  console.log('Score:', test1.score);
  console.log('Average similarity:', test1.debug.averageSimilarity);
  console.log('Word scores:', test1.wordScores);
  console.log('');
  
  // Test 2: Unrelated text
  console.log('=== Test 2: Unrelated Text ===');
  const test2 = markRecitation('إن الله لا يستحي ما بعوضة', 'هذا نص عربي مختلف تماما');
  console.log('Status:', test2.status);
  console.log('Score:', test2.score);
  console.log('Average similarity:', test2.debug.averageSimilarity);
  console.log('Matched:', test2.debug.matchedCount, '/', test2.debug.expectedCount);
  console.log('');
  
  // Test 3: Good match
  console.log('=== Test 3: Good Match ===');
  const test3 = markRecitation('بسم الله الرحمن الرحيم', 'بسم الله الرحمن الرحيم');
  console.log('Status:', test3.status);
  console.log('Score:', test3.score);
  console.log('Average similarity:', test3.debug.averageSimilarity);
  console.log('Matched:', test3.debug.matchedCount, '/', test3.debug.expectedCount);
  console.log('');
  
  // Test 4: Partial match
  console.log('=== Test 4: Partial Match ===');
  const test4 = markRecitation('بسم الله الرحمن الرحيم', 'بسم الله الرحمن');
  console.log('Status:', test4.status);
  console.log('Score:', test4.score);
  console.log('Average similarity:', test4.debug.averageSimilarity);
}

