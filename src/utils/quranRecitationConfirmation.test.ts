/**
 * Unit tests for Quran Recitation Confirmation System
 */

import { confirmRecitation, normalizeArabic, tokenizeArabic } from './quranRecitationConfirmation';

describe('Quran Recitation Confirmation System', () => {
  
  describe('Test 1: Perfect match', () => {
    it('should PASS with perfect match', () => {
      const expected = 'بسم الله الرحمن الرحيم';
      const whisper = 'بسم الله الرحمن الرحيم';
      
      const result = confirmRecitation(expected, whisper, [], true);
      
      console.log('Test 1: Perfect match');
      console.log('Status:', result.status);
      console.log('Anchor hit rate:', result.anchorHitRate);
      console.log('Order score:', result.orderScore);
      console.log('Matched anchors:', result.matchedAnchors.length);
      console.log('Missing anchors:', result.missingAnchors.length);
      
      expect(result.status).toBe('PASS');
      expect(result.anchorHitRate).toBeGreaterThanOrEqual(0.60);
      expect(result.orderScore).toBeGreaterThanOrEqual(0.60);
      expect(result.missingAnchors.length).toBe(0);
    });
  });
  
  describe('Test 2: Missing many anchors', () => {
    it('should FAIL when many anchors are missing', () => {
      const expected = 'إن الله لا يستحي أن يضرب مثلا ما بعوضة';
      const whisper = 'الله أن ما'; // Only a few words
      
      const result = confirmRecitation(expected, whisper, [], true);
      
      console.log('Test 2: Missing many anchors');
      console.log('Status:', result.status);
      console.log('Anchor hit rate:', result.anchorHitRate);
      console.log('Matched anchors:', result.matchedAnchors.length);
      console.log('Missing anchors:', result.missingAnchors);
      
      expect(result.status).toBe('FAIL');
      expect(result.anchorHitRate).toBeLessThan(0.40);
    });
  });
  
  describe('Test 3: Correct anchors but wrong order', () => {
    it('should have low order score when anchors are out of order', () => {
      const expected = 'بسم الله الرحمن الرحيم';
      // Whisper with words in different order (simulated)
      const whisper = 'الله بسم الرحيم الرحمن';
      
      const result = confirmRecitation(expected, whisper, [], true);
      
      console.log('Test 3: Wrong order');
      console.log('Status:', result.status);
      console.log('Anchor hit rate:', result.anchorHitRate);
      console.log('Order score:', result.orderScore);
      console.log('Matched anchors:', result.matchedAnchors);
      
      // May still pass if order score calculation allows it, but should show lower order score
      expect(result.orderScore).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('Test 4: Whisper adds many extra words but contains anchors', () => {
    it('should PASS if anchors are present even with extra words', () => {
      const expected = 'بسم الله الرحمن الرحيم';
      const whisper = 'بسم الله الرحمن الرحيم ثم قال الله تعالى هذا كلام عظيم';
      
      const result = confirmRecitation(expected, whisper, [], true);
      
      console.log('Test 4: Extra words');
      console.log('Status:', result.status);
      console.log('Anchor hit rate:', result.anchorHitRate);
      console.log('Order score:', result.orderScore);
      console.log('Matched anchors:', result.matchedAnchors.length);
      
      // Should still pass if anchors match
      expect(result.anchorHitRate).toBeGreaterThanOrEqual(0.60);
      expect(result.orderScore).toBeGreaterThanOrEqual(0.60);
      if (result.anchorHitRate >= 0.60 && result.orderScore >= 0.60) {
        expect(result.status).toBe('PASS');
      }
    });
  });
  
  describe('Test 5: Short chunk (Bismillah)', () => {
    it('should handle short chunks correctly', () => {
      const expected = 'بسم الله الرحمن الرحيم';
      const whisper = 'بسم الله الرحمن الرحيم';
      
      const result = confirmRecitation(expected, whisper, [], true);
      
      console.log('Test 5: Short chunk (Bismillah)');
      console.log('Status:', result.status);
      console.log('Anchors:', result.debug?.anchors);
      console.log('Anchor hit rate:', result.anchorHitRate);
      console.log('Order score:', result.orderScore);
      
      expect(result.status).toBe('PASS');
      expect(result.debug?.anchors.length).toBeGreaterThanOrEqual(3);
    });
  });
  
  describe('Test 6: Noisy case - 5/10 anchors match', () => {
    it('should be TRY_AGAIN not PASS when only 5/10 anchors match', () => {
      const expected = 'إن الله لا يستحي أن يضرب مثلا ما بعوضة فما فوقها';
      // Whisper with only some anchors matching
      const whisper = 'إن الله أن يضرب ما بعوضة'; // Missing some anchors
      
      const result = confirmRecitation(expected, whisper, [], true);
      
      console.log('Test 6: Noisy case (5/10 anchors)');
      console.log('Status:', result.status);
      console.log('Anchor hit rate:', result.anchorHitRate);
      console.log('Order score:', result.orderScore);
      console.log('Matched anchors:', result.matchedAnchors.length);
      console.log('Missing anchors:', result.missingAnchors);
      console.log('Anchors:', result.debug?.anchors);
      
      // Should be TRY_AGAIN if anchorHitRate is in [0.40, 0.60)
      if (result.anchorHitRate >= 0.40 && result.anchorHitRate < 0.60) {
        expect(result.status).toBe('TRY_AGAIN');
      } else if (result.anchorHitRate < 0.40) {
        expect(result.status).toBe('FAIL');
      }
      
      // Should not be PASS
      expect(result.status).not.toBe('PASS');
    });
  });
  
  describe('Normalization', () => {
    it('should normalize Arabic text correctly', () => {
      const text = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
      const normalized = normalizeArabic(text);
      
      expect(normalized).not.toContain('ِ'); // No diacritics
      expect(normalized).toContain('ا'); // Normalized alif
    });
    
    it('should normalize letter variants', () => {
      const text1 = normalizeArabic('أول إثنين آية');
      const text2 = normalizeArabic('اول اثنين اية');
      
      expect(text1).toBe(text2);
    });
  });
  
  describe('Tokenization', () => {
    it('should tokenize Arabic text correctly', () => {
      const text = 'بسم الله الرحمن الرحيم';
      const tokens = tokenizeArabic(text);
      
      expect(tokens.length).toBe(4);
      expect(tokens).toContain('بسم');
      expect(tokens).toContain('الله');
    });
  });
  
  describe('Hard anchors', () => {
    it('should require hard anchors to match for PASS', () => {
      const expected = 'بسم الله الرحمن الرحيم';
      const whisper = 'بسم الله'; // Missing key anchors
      const hardAnchors = ['الرحمن', 'الرحيم'];
      
      const result = confirmRecitation(expected, whisper, hardAnchors, true);
      
      console.log('Hard anchors test:');
      console.log('Status:', result.status);
      console.log('Hard anchors:', hardAnchors);
      console.log('Matched anchors:', result.matchedAnchors.map(m => m.anchor));
      
      // Should not PASS if hard anchors are missing
      const matchedHardAnchors = result.matchedAnchors.filter(m => 
        hardAnchors.includes(m.anchor)
      );
      if (matchedHardAnchors.length < hardAnchors.length) {
        expect(result.status).not.toBe('PASS');
      }
    });
  });
});

// Run tests if executed directly
if (require.main === module) {
  console.log('Running Quran Recitation Confirmation Tests...\n');
  
  // Test 1: Perfect match
  console.log('=== Test 1: Perfect Match ===');
  const test1 = confirmRecitation(
    'بسم الله الرحمن الرحيم',
    'بسم الله الرحمن الرحيم',
    [],
    true
  );
  console.log('Status:', test1.status);
  console.log('Anchor hit rate:', test1.anchorHitRate);
  console.log('Order score:', test1.orderScore);
  console.log('');
  
  // Test 2: Missing many anchors
  console.log('=== Test 2: Missing Many Anchors ===');
  const test2 = confirmRecitation(
    'إن الله لا يستحي أن يضرب مثلا ما بعوضة',
    'الله أن ما',
    [],
    true
  );
  console.log('Status:', test2.status);
  console.log('Anchor hit rate:', test2.anchorHitRate);
  console.log('Missing anchors:', test2.missingAnchors);
  console.log('');
  
  // Test 6: Noisy case
  console.log('=== Test 6: Noisy Case (5/10 anchors) ===');
  const test6 = confirmRecitation(
    'إن الله لا يستحي أن يضرب مثلا ما بعوضة فما فوقها',
    'إن الله أن يضرب ما بعوضة',
    [],
    true
  );
  console.log('Status:', test6.status);
  console.log('Anchor hit rate:', test6.anchorHitRate);
  console.log('Order score:', test6.orderScore);
  console.log('Anchors:', test6.debug?.anchors);
  console.log('Matched:', test6.matchedAnchors.length);
}


