/**
 * Quran data loader utility
 * Handles loading and converting from the new metadata format
 */

interface MetadataVerse {
  id: number;
  surah_number?: number; // For quran-metadata-ayah.json format
  ayah_number?: number;  // For quran-metadata-ayah.json format
  surah?: number;         // For indopak-nastaleeq.json format
  ayah?: number;          // For indopak-nastaleeq.json format
  verse_key: string;
  words_count?: number;
  text: string;
}

export interface Verse {
  surah_no: number;
  ayah_no_surah: number;
  ayah_ar: string;
  ayah_en?: string; // Optional, may not be in new data
}

/**
 * Convert metadata format to array format
 */
export function loadQuranData(metadataData: { [key: string]: MetadataVerse }, oldData?: Verse[]): Verse[] {
  // Convert object to array and map to expected format
  const verses: Verse[] = Object.values(metadataData).map((verse: MetadataVerse) => {
    // Clean up Arabic text - remove trailing verse numbers and extra spaces
    let cleanedText = verse.text.trim();
    
    // Remove HTML-like tajweed rule tags (e.g., <rule class=ham_wasl>?</rule>)
    // Handle both single-line and multi-line tags
    cleanedText = cleanedText.replace(/<rule[^>]*>[\s\S]*?<\/rule>/gi, '');
    
    // Remove trailing Arabic/English numbers (like "١", "٢", "1", "2", etc.)
    cleanedText = cleanedText.replace(/[\s\u0660-\u0669\u06F0-\u06F90-9]+$/, '').trim();
    
    // Handle both formats: surah_number/ayah_number (quran-metadata-ayah.json) 
    // and surah/ayah (indopak-nastaleeq.json, qpc-hafs-tajweed.json, qpc-v2-ayah-by-ayah-glyphs.json, qpc-hafs.json)
    const surahNo = verse.surah_number ?? verse.surah ?? 0;
    const ayahNo = verse.ayah_number ?? verse.ayah ?? 0;
    
    const converted: Verse = {
      surah_no: surahNo,
      ayah_no_surah: ayahNo,
      ayah_ar: cleanedText,
    };
    
    // If old data is provided, try to find matching English translation
    if (oldData) {
      const matchingVerse = oldData.find(
        (v) => v.surah_no === surahNo && v.ayah_no_surah === ayahNo
      );
      if (matchingVerse) {
        converted.ayah_en = matchingVerse.ayah_en;
      }
    }
    
    return converted;
  });
  
  // Sort by surah number, then ayah number
  verses.sort((a, b) => {
    if (a.surah_no !== b.surah_no) {
      return a.surah_no - b.surah_no;
    }
    return a.ayah_no_surah - b.ayah_no_surah;
  });
  
  return verses;
}

/**
 * Get verse by surah and ayah
 */
export function getVerseBySurahAndAyah(
  verses: Verse[],
  surah: number,
  ayah: number
): Verse | undefined {
  return verses.find((v) => v.surah_no === surah && v.ayah_no_surah === ayah);
}

