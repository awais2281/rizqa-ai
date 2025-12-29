/**
 * Unit tests for Arabic Recitation Comparison
 */

import { compareRecitation, normalizeArabicForCompare, tokenizeArabic, calculateExpectedHash } from './arabicCompare';

describe('Arabic Recitation Comparison', () => {
  
  describe('Normalization', () => {
    it('should normalize Arabic text correctly', () => {
      const text = 'بِهِۦ كَثِيرٗا وَيَهۡدِي';
      const normalized = normalizeArabicForCompare(text);
      
      expect(normalized).not.toContain('ِ'); // No diacritics
      expect(normalized).not.toContain('ۦ'); // No Quran marks
      expect(normalized).toContain('ا'); // Normalized alif
    });
    
    it('should handle Quranic marks', () => {
      const text = 'نص ۞ آخر ۩';
      const normalized = normalizeArabicForCompare(text);
      
      expect(normalized).not.toContain('۞');
      expect(normalized).not.toContain('۩');
    });
    
    it('should normalize letter variants', () => {
      const text1 = normalizeArabicForCompare('أول إثنين آية');
      const text2 = normalizeArabicForCompare('اول اثنين اية');
      
      expect(text1).toBe(text2);
    });
  });
  
  describe('Tokenization', () => {
    it('should tokenize correctly', () => {
      const text = 'بسم الله الرحمن الرحيم';
      const tokens = tokenizeArabic(text);
      
      expect(tokens.length).toBe(4);
      expect(tokens).toContain('بسم');
      expect(tokens).toContain('الله');
    });
    
    it('should not return empty tokens unexpectedly', () => {
      const text = 'بِهِۦ كَثِيرٗا';
      const tokens = tokenizeArabic(text);
      
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.every(t => t.length > 0)).toBe(true);
    });
  });
  
  describe('Comparison - Real examples', () => {
    it('should handle "بِهِۦ كَثِيرٗا" vs "بيه كعشيرا"', () => {
      const expected = 'بِهِۦ كَثِيرٗا وَيَهۡدِي';
      const transcript = 'بيه كعشيرا وما';
      
      const result = compareRecitation(expected, transcript);
      
      console.log('Test: Real Whisper example');
      console.log('Expected:', expected);
      console.log('Transcript:', transcript);
      console.log('Expected tokens:', result.expectedTokens);
      console.log('Transcript tokens:', result.transcriptTokens);
      console.log('Matched:', result.matched);
      console.log('Score:', result.score);
      console.log('Pass:', result.pass);
      console.log('Debug:', result.debug);
      
      expect(result.expectedTokens.length).toBeGreaterThan(0);
      expect(result.transcriptTokens.length).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
    
    it('should handle perfect match', () => {
      const expected = 'بسم الله الرحمن الرحيم';
      const transcript = 'بسم الله الرحمن الرحيم';
      
      const result = compareRecitation(expected, transcript);
      
      expect(result.pass).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0.60);
    });
    
    it('should handle partial match', () => {
      const expected = 'بسم الله الرحمن الرحيم';
      const transcript = 'بسم الله الرحمن';
      
      const result = compareRecitation(expected, transcript);
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.matched.length).toBeGreaterThan(0);
    });
    
    it('should fail on too short transcript', () => {
      const expected = 'بسم الله الرحمن الرحيم';
      const transcript = 'بسم';
      
      const result = compareRecitation(expected, transcript);
      
      expect(result.pass).toBe(false);
      expect(result.debug.failReason).toContain('too_short');
    });
  });
  
  describe('Hash verification', () => {
    it('should calculate consistent hashes', () => {
      const text = 'بسم الله الرحمن الرحيم';
      const hash1 = calculateExpectedHash(text);
      const hash2 = calculateExpectedHash(text);
      
      expect(hash1).toBe(hash2);
    });
    
    it('should produce same hash for normalized variants', () => {
      const text1 = 'بِسْمِ اللَّهِ';
      const text2 = 'بسم الله';
      
      const hash1 = calculateExpectedHash(text1);
      const hash2 = calculateExpectedHash(text2);
      
      expect(hash1).toBe(hash2);
    });
  });
  
  describe('Weighted scoring', () => {
    it('should weight stopwords lower', () => {
      const expected = 'و الله الرحمن';
      const transcript = 'و الله الرحمن';
      
      const result = compareRecitation(expected, transcript);
      
      // 'و' is a stopword (weight 0.5), 'الله' and 'الرحمن' are content words (weight 1.0)
      // Total weight = 0.5 + 1.0 + 1.0 = 2.5
      // If all matched: matchedWeight = 0.5 + 1.0 + 1.0 = 2.5
      // Score = 2.5 / 2.5 = 1.0
      
      expect(result.debug.totalWeight).toBe(2.5);
    });
  });
});

// Run tests if executed directly
if (require.main === module) {
  console.log('Running Arabic Recitation Comparison Tests...\n');
  
  const expected = 'بِهِۦ كَثِيرٗا وَيَهۡدِي';
  const transcript = 'بيه كعشيرا وما';
  
  const result = compareRecitation(expected, transcript);
  
  console.log('Expected:', expected);
  console.log('Transcript:', transcript);
  console.log('Expected tokens:', result.expectedTokens);
  console.log('Transcript tokens:', result.transcriptTokens);
  console.log('Matched:', result.matched);
  console.log('Score:', result.score);
  console.log('Pass:', result.pass);
  console.log('Debug:', result.debug);
}


