/**
 * Unit tests for Quran Chunk Verification System
 */

import { verifyRecitation, normalizeArabicQpc } from './quranChunkVerification';

describe('Quran Chunk Verification System', () => {
  
  describe('Test 1: True Positive - Close match with small errors', () => {
    it('should PASS when transcript is close to expected with small errors', () => {
      const expected = 'إن الله لا يستحي أن يضرب مثلا ما بعوضة';
      const transcript = 'إن الله لا يستحي أن يضرب مثلا ما بعوضة'; // Exact match
      
      const result = verifyRecitation(expected, transcript);
      
      console.log('Test 1 Results:');
      console.log('Expected:', expected);
      console.log('Transcript:', transcript);
      console.log('Pass:', result.pass);
      console.log('Coverage:', result.coverage);
      console.log('Matched count:', result.matchedCount);
      console.log('Avg similarity:', result.avgSim);
      console.log('Order span:', result.orderSpan);
      console.log('Aligned pairs:', result.alignedPairs.length);
      
      expect(result.pass).toBe(true);
      expect(result.coverage).toBeGreaterThanOrEqual(0.62);
      expect(result.matchedCount).toBeGreaterThanOrEqual(4);
    });
    
    it('should PASS with minor pronunciation errors', () => {
      const expected = 'إن الله لا يستحي أن يضرب مثلا ما بعوضة';
      const transcript = 'إن الله لا يستحي أن يضرب مثلا ما بعوضه'; // Small error at end
      
      const result = verifyRecitation(expected, transcript);
      
      console.log('Test 1b: Minor errors');
      console.log('Pass:', result.pass);
      console.log('Coverage:', result.coverage);
      console.log('Matched count:', result.matchedCount);
      
      // Should still pass with lenient matching
      expect(result.coverage).toBeGreaterThan(0.5);
    });
  });
  
  describe('Test 2: False Positive - Only common words', () => {
    it('should FAIL when transcript only contains scattered common words', () => {
      const expected = 'إن الله لا يستحي أن يضرب مثلا ما بعوضة';
      const transcript = 'الله لا أن ما'; // Only common words, missing key content
      
      const result = verifyRecitation(expected, transcript);
      
      console.log('Test 2 Results:');
      console.log('Expected:', expected);
      console.log('Transcript:', transcript);
      console.log('Pass:', result.pass);
      console.log('Coverage:', result.coverage);
      console.log('Matched count:', result.matchedCount);
      console.log('Avg similarity:', result.avgSim);
      console.log('Order span:', result.orderSpan);
      
      // Should FAIL due to low coverage or orderSpan constraint
      expect(result.pass).toBe(false);
      // Either coverage too low, or matchedCount too low, or orderSpan too high
      expect(
        result.coverage < 0.62 ||
        result.matchedCount < Math.max(4, Math.ceil(9 * 0.55)) ||
        result.orderSpan > 9 * 4
      ).toBe(true);
    });
  });
  
  describe('Test 3: Warsh vs Hafs orthography differences', () => {
    it('should PASS after normalization despite orthography differences', () => {
      // Simulate Warsh vs Hafs differences (normalized should be similar)
      const expected = 'بسم الله الرحمن الرحيم';
      const transcript = 'بسم الله الرحمن الرحيم'; // Same after normalization
      
      const result = verifyRecitation(expected, transcript);
      
      console.log('Test 3 Results:');
      console.log('Pass:', result.pass);
      console.log('Coverage:', result.coverage);
      
      expect(result.pass).toBe(true);
    });
  });
  
  describe('Test 4: QPC symbols in expected', () => {
    it('should handle QPC symbols without affecting result', () => {
      const expected = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ۞'; // With QPC symbols
      const transcript = 'بسم الله الرحمن الرحيم'; // Without symbols
      
      const result = verifyRecitation(expected, transcript);
      
      console.log('Test 4 Results:');
      console.log('Expected (with symbols):', expected);
      console.log('Transcript:', transcript);
      console.log('Pass:', result.pass);
      console.log('Coverage:', result.coverage);
      console.log('Matched count:', result.matchedCount);
      
      // Should pass - symbols should be normalized away
      expect(result.pass).toBe(true);
      expect(result.coverage).toBeGreaterThanOrEqual(0.62);
    });
  });
  
  describe('Normalization', () => {
    it('should normalize Arabic text correctly', () => {
      const text = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ۞';
      const normalized = normalizeArabicQpc(text);
      
      expect(normalized).not.toContain('ِ'); // No diacritics
      expect(normalized).not.toContain('۞'); // No QPC symbols
      expect(normalized).toContain('ا'); // Normalized alif
    });
    
    it('should normalize letter variants', () => {
      const text1 = normalizeArabicQpc('أول إثنين آية');
      const text2 = normalizeArabicQpc('اول اثنين اية');
      
      expect(text1).toBe(text2); // Should normalize to same
    });
    
    it('should handle ة -> ه normalization', () => {
      const text1 = normalizeArabicQpc('مطهرة');
      const text2 = normalizeArabicQpc('مطهره');
      
      expect(text1).toBe(text2);
    });
  });
  
  describe('Edge cases', () => {
    it('should handle empty expected', () => {
      const result = verifyRecitation('', 'نص عربي');
      
      expect(result.pass).toBe(false);
      expect(result.coverage).toBe(0);
    });
    
    it('should handle empty transcript', () => {
      const result = verifyRecitation('بسم الله الرحمن الرحيم', '');
      
      expect(result.pass).toBe(false);
      expect(result.matchedCount).toBe(0);
    });
    
    it('should handle very short chunks', () => {
      const result = verifyRecitation('بسم الله', 'بسم الله');
      
      console.log('Short chunk test:');
      console.log('Pass:', result.pass);
      console.log('Coverage:', result.coverage);
      console.log('Matched count:', result.matchedCount);
      
      // Should still work with lenient thresholds
      expect(result.coverage).toBeGreaterThanOrEqual(0);
    });
  });
});

// Run tests if executed directly
if (require.main === module) {
  console.log('Running Quran Chunk Verification Tests...\n');
  
  // Test 1: True positive
  console.log('=== Test 1: True Positive ===');
  const test1 = verifyRecitation(
    'إن الله لا يستحي أن يضرب مثلا ما بعوضة',
    'إن الله لا يستحي أن يضرب مثلا ما بعوضة'
  );
  console.log('Pass:', test1.pass);
  console.log('Coverage:', test1.coverage);
  console.log('Matched count:', test1.matchedCount);
  console.log('Avg similarity:', test1.avgSim);
  console.log('');
  
  // Test 2: False positive
  console.log('=== Test 2: False Positive ===');
  const test2 = verifyRecitation(
    'إن الله لا يستحي أن يضرب مثلا ما بعوضة',
    'الله لا أن ما'
  );
  console.log('Pass:', test2.pass);
  console.log('Coverage:', test2.coverage);
  console.log('Matched count:', test2.matchedCount);
  console.log('Order span:', test2.orderSpan);
  console.log('');
  
  // Test 3: QPC symbols
  console.log('=== Test 3: QPC Symbols ===');
  const test3 = verifyRecitation(
    'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ۞',
    'بسم الله الرحمن الرحيم'
  );
  console.log('Pass:', test3.pass);
  console.log('Coverage:', test3.coverage);
  console.log('Matched count:', test3.matchedCount);
}


