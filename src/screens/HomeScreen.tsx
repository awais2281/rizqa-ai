import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { splitArabicVerseIntoChunks, getChunkString } from '../utils/arabicChunking';
import { calculateExpectedHash } from '../recitation/arabicCompare';

const quranMetadata = require('../../qurandata/indopaknew-data.json');
import { loadQuranData, getVerseBySurahAndAyah, Verse } from '../utils/quranDataLoader';
import { getVerseTranslation } from '../utils/translationLoader';

// Optional: English translations (if available)
// Load without old data since it's optional and may not exist
const quranData = loadQuranData(quranMetadata, undefined);

// Surah names mapping
const surahNames: { [key: number]: { transliteration: string; translation: string } } = {
  1: { transliteration: 'Al-Fatihah', translation: 'The Opener' },
  2: { transliteration: 'Al-Baqarah', translation: 'The Cow' },
  3: { transliteration: "Ali 'Imran", translation: 'Family of Imran' },
  4: { transliteration: 'An-Nisa', translation: 'The Women' },
  5: { transliteration: "Al-Ma'idah", translation: 'The Table Spread' },
  6: { transliteration: "Al-An'am", translation: 'The Cattle' },
  7: { transliteration: "Al-A'raf", translation: 'The Heights' },
  8: { transliteration: 'Al-Anfal', translation: 'The Spoils of War' },
  9: { transliteration: 'At-Tawbah', translation: 'The Repentance' },
  10: { transliteration: 'Yunus', translation: 'Jonah' },
  11: { transliteration: 'Hud', translation: 'Hud' },
  12: { transliteration: 'Yusuf', translation: 'Joseph' },
  13: { transliteration: "Ar-Ra'd", translation: 'The Thunder' },
  14: { transliteration: 'Ibrahim', translation: 'Abraham' },
  15: { transliteration: 'Al-Hijr', translation: 'The Rocky Tract' },
  16: { transliteration: 'An-Nahl', translation: 'The Bee' },
  17: { transliteration: 'Al-Isra', translation: 'The Night Journey' },
  18: { transliteration: 'Al-Kahf', translation: 'The Cave' },
  19: { transliteration: 'Maryam', translation: 'Mary' },
  20: { transliteration: 'Ta-Ha', translation: 'Ta-Ha' },
  21: { transliteration: 'Al-Anbiya', translation: 'The Prophets' },
  22: { transliteration: 'Al-Hajj', translation: 'The Pilgrimage' },
  23: { transliteration: "Al-Mu'minun", translation: 'The Believers' },
  24: { transliteration: 'An-Nur', translation: 'The Light' },
  25: { transliteration: 'Al-Furqan', translation: 'The Criterion' },
  26: { transliteration: "Ash-Shu'ara", translation: 'The Poets' },
  27: { transliteration: 'An-Naml', translation: 'The Ant' },
  28: { transliteration: 'Al-Qasas', translation: 'The Stories' },
  29: { transliteration: 'Al-Ankabut', translation: 'The Spider' },
  30: { transliteration: 'Ar-Rum', translation: 'The Romans' },
  31: { transliteration: 'Luqman', translation: 'Luqman' },
  32: { transliteration: 'As-Sajdah', translation: 'The Prostration' },
  33: { transliteration: 'Al-Ahzab', translation: 'The Clans' },
  34: { transliteration: 'Saba', translation: 'Sheba' },
  35: { transliteration: 'Fatir', translation: 'The Originator' },
  36: { transliteration: 'Ya-Sin', translation: 'Ya-Sin' },
  37: { transliteration: 'As-Saffat', translation: 'Those Ranged in Rows' },
  38: { transliteration: 'Sad', translation: 'Sad' },
  39: { transliteration: 'Az-Zumar', translation: 'The Troops' },
  40: { transliteration: 'Ghafir', translation: 'The Forgiver' },
  41: { transliteration: 'Fussilat', translation: 'Explained in Detail' },
  42: { transliteration: 'Ash-Shura', translation: 'The Consultation' },
  43: { transliteration: 'Az-Zukhruf', translation: 'The Gold' },
  44: { transliteration: 'Ad-Dukhan', translation: 'The Smoke' },
  45: { transliteration: 'Al-Jathiyah', translation: 'The Crouching' },
  46: { transliteration: 'Al-Ahqaf', translation: 'The Wind-Curved Sandhills' },
  47: { transliteration: 'Muhammad', translation: 'Muhammad' },
  48: { transliteration: 'Al-Fath', translation: 'The Victory' },
  49: { transliteration: 'Al-Hujurat', translation: 'The Rooms' },
  50: { transliteration: 'Qaf', translation: 'Qaf' },
  51: { transliteration: 'Adh-Dhariyat', translation: 'The Winnowing Winds' },
  52: { transliteration: 'At-Tur', translation: 'The Mount' },
  53: { transliteration: 'An-Najm', translation: 'The Star' },
  54: { transliteration: 'Al-Qamar', translation: 'The Moon' },
  55: { transliteration: 'Ar-Rahman', translation: 'The Beneficent' },
  56: { transliteration: 'Al-Waqi\'ah', translation: 'The Inevitable' },
  57: { transliteration: 'Al-Hadid', translation: 'The Iron' },
  58: { transliteration: 'Al-Mujadila', translation: 'The Pleading Woman' },
  59: { transliteration: 'Al-Hashr', translation: 'The Exile' },
  60: { transliteration: 'Al-Mumtahanah', translation: 'She That Is To Be Examined' },
  61: { transliteration: 'As-Saff', translation: 'The Ranks' },
  62: { transliteration: 'Al-Jumu\'ah', translation: 'Friday' },
  63: { transliteration: 'Al-Munafiqun', translation: 'The Hypocrites' },
  64: { transliteration: 'At-Taghabun', translation: 'The Mutual Disillusion' },
  65: { transliteration: 'At-Talaq', translation: 'The Divorce' },
  66: { transliteration: 'At-Tahrim', translation: 'The Prohibition' },
  67: { transliteration: 'Al-Mulk', translation: 'The Sovereignty' },
  68: { transliteration: 'Al-Qalam', translation: 'The Pen' },
  69: { transliteration: 'Al-Haqqah', translation: 'The Reality' },
  70: { transliteration: 'Al-Ma\'arij', translation: 'The Ascending Stairways' },
  71: { transliteration: 'Nuh', translation: 'Noah' },
  72: { transliteration: 'Al-Jinn', translation: 'The Jinn' },
  73: { transliteration: 'Al-Muzzammil', translation: 'The Enshrouded One' },
  74: { transliteration: 'Al-Muddaththir', translation: 'The Cloaked One' },
  75: { transliteration: 'Al-Qiyamah', translation: 'The Resurrection' },
  76: { transliteration: 'Al-Insan', translation: 'The Man' },
  77: { transliteration: 'Al-Mursalat', translation: 'The Emissaries' },
  78: { transliteration: 'An-Naba', translation: 'The Tidings' },
  79: { transliteration: 'An-Nazi\'at', translation: 'Those Who Drag Forth' },
  80: { transliteration: '\'Abasa', translation: 'He Frowned' },
  81: { transliteration: 'At-Takwir', translation: 'The Overthrowing' },
  82: { transliteration: 'Al-Infitar', translation: 'The Cleaving' },
  83: { transliteration: 'Al-Mutaffifin', translation: 'The Defrauding' },
  84: { transliteration: 'Al-Inshiqaq', translation: 'The Sundering' },
  85: { transliteration: 'Al-Buruj', translation: 'The Mansions of the Stars' },
  86: { transliteration: 'At-Tariq', translation: 'The Nightcomer' },
  87: { transliteration: 'Al-A\'la', translation: 'The Most High' },
  88: { transliteration: 'Al-Ghashiyah', translation: 'The Overwhelming' },
  89: { transliteration: 'Al-Fajr', translation: 'The Dawn' },
  90: { transliteration: 'Al-Balad', translation: 'The City' },
  91: { transliteration: 'Ash-Shams', translation: 'The Sun' },
  92: { transliteration: 'Al-Layl', translation: 'The Night' },
  93: { transliteration: 'Ad-Duhaa', translation: 'The Morning Hours' },
  94: { transliteration: 'Ash-Sharh', translation: 'The Relief' },
  95: { transliteration: 'At-Tin', translation: 'The Fig' },
  96: { transliteration: 'Al-\'Alaq', translation: 'The Clot' },
  97: { transliteration: 'Al-Qadr', translation: 'The Power' },
  98: { transliteration: 'Al-Bayyinah', translation: 'The Clear Proof' },
  99: { transliteration: 'Az-Zalzalah', translation: 'The Earthquake' },
  100: { transliteration: 'Al-\'Adiyat', translation: 'The Courser' },
  101: { transliteration: 'Al-Qari\'ah', translation: 'The Calamity' },
  102: { transliteration: 'At-Takathur', translation: 'The Rivalry in world increase' },
  103: { transliteration: 'Al-\'Asr', translation: 'The Declining Day' },
  104: { transliteration: 'Al-Humazah', translation: 'The Traducer' },
  105: { transliteration: 'Al-Fil', translation: 'The Elephant' },
  106: { transliteration: 'Quraysh', translation: 'Quraysh' },
  107: { transliteration: 'Al-Ma\'un', translation: 'The Small kindnesses' },
  108: { transliteration: 'Al-Kawthar', translation: 'The Abundance' },
  109: { transliteration: 'Al-Kafirun', translation: 'The Disbelievers' },
  110: { transliteration: 'An-Nasr', translation: 'The Divine Support' },
  111: { transliteration: 'Al-Masad', translation: 'The Palm Fiber' },
  112: { transliteration: 'Al-Ikhlas', translation: 'The Sincerity' },
  113: { transliteration: 'Al-Falaq', translation: 'The Daybreak' },
  114: { transliteration: 'An-Nas', translation: 'Mankind' },
};

// Verse interface is now imported from quranDataLoader

interface HomeScreenProps {
  navigation: any;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [completedSurahs, setCompletedSurahs] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [allVerses, setAllVerses] = useState<Array<{ chapter: number; verse: Verse }>>([]);
  const [memorizedVersesCount, setMemorizedVersesCount] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [weeklyProgress, setWeeklyProgress] = useState<boolean[]>(new Array(7).fill(false));
  const [likedVerses, setLikedVerses] = useState<Set<string>>(new Set());

  // Daily rotating motivational messages
  const dailyMessages = [
    "Nice work showing up today.",
    "A little progress today goes a long way.",
    "You're building something—keep going.",
    "This habit is starting to stick.",
    "Momentum looks good on you.",
    "Future you will thank you for today.",
    "Showing up again? That's how it works.",
  ];

  // Get today's message based on day of year (rotates daily)
  const getDailyMessage = (): string => {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    const messageIndex = dayOfYear % dailyMessages.length;
    return dailyMessages[messageIndex];
  };

  useEffect(() => {
    // Load all verses in order from the converted data
    const verses: Array<{ chapter: number; verse: Verse }> = [];
    
    // quranData is now an array, map it to the expected format
    quranData.forEach((verse: Verse) => {
      verses.push({ chapter: verse.surah_no, verse });
    });
    
    setAllVerses(verses);
    loadProgress(verses);
    loadMemorizedVersesCount();
    updateStreakAndWeeklyProgress();
    loadLikedVerses();
  }, []);

  // Reload progress when screen comes into focus (e.g., returning from TestScreen)
  useFocusEffect(
    useCallback(() => {
      if (allVerses.length > 0) {
        loadProgress(allVerses);
      }
      loadMemorizedVersesCount();
      updateStreakAndWeeklyProgress();
      loadLikedVerses();
    }, [allVerses])
  );

  const loadProgress = async (verses: Array<{ chapter: number; verse: Verse }>) => {
    try {
      const savedSurah = await AsyncStorage.getItem('currentSurah');
      const savedAyah = await AsyncStorage.getItem('currentAyah');
      const savedChunkIndex = await AsyncStorage.getItem('currentChunkIndex');
      
      if (savedSurah && savedAyah) {
        const surah = parseInt(savedSurah);
        const ayah = parseInt(savedAyah);
        // Find the index of the verse
        const index = verses.findIndex(
          (v) => v.chapter === surah && v.verse.ayah_no_surah === ayah
        );
        if (index !== -1) {
          setCurrentVerseIndex(index);
          if (savedChunkIndex) {
            setCurrentChunkIndex(parseInt(savedChunkIndex));
          }
        }
      } else {
        // No saved progress - start from the beginning (Surah 1, Ayah 1)
        console.log('[HomeScreen] No saved progress, starting from beginning');
        setCurrentVerseIndex(0);
        setCurrentChunkIndex(0);
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMemorizedVersesCount = async () => {
    try {
      const count = await AsyncStorage.getItem('memorizedVersesCount');
      setMemorizedVersesCount(count ? parseInt(count) : 0);
    } catch (error) {
      console.error('Error loading memorized verses count:', error);
    }
  };

  const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getVerseKey = (surahNo: number, ayahNo: number): string => {
    return `${surahNo}:${ayahNo}`;
  };

  const loadLikedVerses = async () => {
    try {
      const stored = await AsyncStorage.getItem('likedVerses');
      if (stored) {
        const liked = JSON.parse(stored);
        setLikedVerses(new Set(liked));
      }
    } catch (error) {
      console.error('Error loading liked verses:', error);
    }
  };

  const toggleLikeVerse = async () => {
    if (!currentVerseData) return;
    
    try {
      const verseKey = getVerseKey(
        currentVerseData.verse.surah_no,
        currentVerseData.verse.ayah_no_surah
      );
      
      const newLikedVerses = new Set(likedVerses);
      if (newLikedVerses.has(verseKey)) {
        newLikedVerses.delete(verseKey);
      } else {
        newLikedVerses.add(verseKey);
      }
      
      setLikedVerses(newLikedVerses);
      
      // Save to AsyncStorage
      const likedArray = Array.from(newLikedVerses);
      await AsyncStorage.setItem('likedVerses', JSON.stringify(likedArray));
      
      // Also save the full verse data
      const storedVerses = await AsyncStorage.getItem('likedVersesData');
      const likedVersesData = storedVerses ? JSON.parse(storedVerses) : {};
      
      if (newLikedVerses.has(verseKey)) {
        // Add verse data
        const surahInfo = surahNames[currentVerseData.verse.surah_no] || {
          transliteration: `Surah ${currentVerseData.verse.surah_no}`,
          translation: ''
        };
        likedVersesData[verseKey] = {
          surah_no: currentVerseData.verse.surah_no,
          ayah_no_surah: currentVerseData.verse.ayah_no_surah,
          ayah_ar: currentVerseData.verse.ayah_ar,
          ayah_en: getVerseTranslation(currentVerseData.verse.surah_no, currentVerseData.verse.ayah_no_surah),
          surah_name: surahInfo.transliteration,
          surah_translation: surahInfo.translation,
        };
      } else {
        // Remove verse data
        delete likedVersesData[verseKey];
      }
      
      await AsyncStorage.setItem('likedVersesData', JSON.stringify(likedVersesData));
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const isVerseLiked = (): boolean => {
    if (!currentVerseData) return false;
    const verseKey = getVerseKey(
      currentVerseData.verse.surah_no,
      currentVerseData.verse.ayah_no_surah
    );
    return likedVerses.has(verseKey);
  };

  const updateStreakAndWeeklyProgress = async () => {
    try {
      const today = new Date();
      const todayKey = formatDateKey(today);
      
      // Mark today as active
      const stored = await AsyncStorage.getItem('streakDays');
      let days = stored ? JSON.parse(stored) : [];
      
      if (!days.includes(todayKey)) {
        days.push(todayKey);
        await AsyncStorage.setItem('streakDays', JSON.stringify(days));
      }

      // Check for gaps - if yesterday was missed, reset streak to just today
      const sortedDays = days.sort();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = formatDateKey(yesterday);
      
      // If yesterday is not in the list, there's a gap - reset to just today
      if (!sortedDays.includes(yesterdayKey)) {
        // Reset streak - keep only today
        days = [todayKey];
        await AsyncStorage.setItem('streakDays', JSON.stringify(days));
        sortedDays.length = 0;
        sortedDays.push(todayKey);
      }
      
      // Calculate consecutive days from today backwards
      let streak = 0;
      let checkDate = new Date(today);
      
      // Today is always marked, so start with 1
        streak = 1;
        checkDate.setDate(checkDate.getDate() - 1);
      
      // Count consecutive days backwards
      while (true) {
        const dateKey = formatDateKey(checkDate);
        if (sortedDays.includes(dateKey)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
      
      setStreakCount(streak);
      
      // Update weekly progress
      const weekly: boolean[] = new Array(7).fill(false);
      const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
      
      // Get the start of the week (Sunday)
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      
      // Check each day of the week
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(startOfWeek);
        checkDate.setDate(startOfWeek.getDate() + i);
        const dateKey = formatDateKey(checkDate);
        weekly[i] = sortedDays.includes(dateKey);
      }
      
      setWeeklyProgress(weekly);
    } catch (error) {
      console.error('Error updating streak and weekly progress:', error);
      setStreakCount(0);
      setWeeklyProgress(new Array(7).fill(false));
    }
  };

  const calculateStreak = async () => {
    // Legacy function - redirect to new function
    await updateStreakAndWeeklyProgress();
  };


  // Get transliteration for a verse by surah and ayah number
  const getTransliteration = (surahNo: number, ayahNo: number): string => {
    try {
      const key = `${surahNo}:${ayahNo}`;
      
      if (transliteratedData[key] && transliteratedData[key].t) {
        return transliteratedData[key].t;
      }
    } catch (error) {
      console.error('Error getting transliteration:', error);
    }
    return '';
  };

  // Get current chunk of Arabic verse to display
  // Uses the shared utility function to ensure consistency with TestScreen
  const getCurrentChunk = (): string => {
    const currentVerse = getCurrentVerse();
    if (!currentVerse) return '';
    
    const arabicVerse = currentVerse.verse.ayah_ar;
    if (!arabicVerse) return '';
    
    // Use the shared utility function - SINGLE SOURCE OF TRUTH
    const chunk = getChunkString(arabicVerse, currentChunkIndex, 8);
    
    // Calculate hash for verification
    const chunkHash = calculateExpectedHash(chunk);
    
    console.log(`[HOMESCREEN] Displaying chunk ${currentChunkIndex + 1}:`, chunk);
    console.log(`[HOMESCREEN] Expected chunk hash (sha1):`, chunkHash);
    console.log(`[HOMESCREEN] This IS the exact chunk TestScreen will use for scoring`);
    console.log(`[HOMESCREEN] TestScreen MUST use chunk with hash:`, chunkHash);
    
    return chunk;
  };

  // Get total number of chunks for current verse
  // Uses the same chunking function as TestScreen to ensure consistency
  const getTotalChunks = (): number => {
    const currentVerse = getCurrentVerse();
    if (!currentVerse) return 0;
    
    const arabicVerse = currentVerse.verse.ayah_ar;
    if (!arabicVerse) return 0;
    
    // Use the same balanced chunking function as TestScreen
    const chunks = splitArabicVerseIntoChunks(arabicVerse, 8);
    return chunks.length;
  };

  useEffect(() => {
    // Check if we've completed a surah
    if (currentVerseIndex > 0 && allVerses.length > 0) {
      const currentVerse = allVerses[currentVerseIndex];
      const previousVerse = allVerses[currentVerseIndex - 1];
      
      // If we moved to a new surah, mark the previous one as completed
      if (currentVerse && previousVerse && currentVerse.chapter !== previousVerse.chapter) {
        setCompletedSurahs((prev) => new Set([...prev, previousVerse.chapter]));
      }
    }
  }, [currentVerseIndex, allVerses]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const getCurrentVerse = () => {
    if (allVerses.length === 0 || currentVerseIndex >= allVerses.length) {
      return null;
    }
    return allVerses[currentVerseIndex];
  };

  const getSurahInfo = (chapter: number) => {
    return surahNames[chapter] || { transliteration: `Surah ${chapter}`, translation: '' };
  };

  const surahListData = useMemo(() => {
    return Object.keys(surahNames).map((chapterNum) => {
      const chapter = parseInt(chapterNum);
      return { chapter, surah: surahNames[chapter] };
    });
  }, []);

  const currentVerseData = getCurrentVerse();
  const currentSurahInfo = currentVerseData
    ? getSurahInfo(currentVerseData.chapter)
    : null;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  const renderHeader = () => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.streakContainer}>
            <Text style={styles.streakText}>
              🔥 {streakCount} {streakCount === 1 ? 'day' : 'days'}
            </Text>
          </View>
        </View>
      </View>

      {/* Streak Box */}
      <View style={styles.streakBox}>
        <View style={styles.weeklyProgressContainer}>
          <View style={styles.weekDaysRow}>
            {(() => {
              const dayLabels = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];
              // Reorder day labels to match the reordered progress (checked days first)
              const reorderedLabels = weeklyProgress
                .map((isFilled, originalIndex) => ({ 
                  label: dayLabels[originalIndex], 
                  isFilled, 
                  originalIndex 
                }))
                .sort((a, b) => {
                  // Checked days come first (true before false)
                  if (a.isFilled !== b.isFilled) {
                    return a.isFilled ? -1 : 1;
                  }
                  // If both have same status, maintain original order
                  return a.originalIndex - b.originalIndex;
                });
              
              return reorderedLabels.map(({ label, originalIndex }, displayIndex) => {
                const today = new Date();
                const dayOfWeek = today.getDay();
                const isToday = originalIndex === dayOfWeek;
                
                return (
                  <Text 
                    key={originalIndex} 
                    style={[
                      styles.weekDayLabel,
                      isToday && styles.weekDayLabelToday
                    ]}
                  >
                    {label}
          </Text>
                );
              });
            })()}
        </View>
          <View style={styles.progressBar}>
            {(() => {
              // Reorder: checked days first, then unchecked days
              const reorderedProgress = weeklyProgress
                .map((isFilled, originalIndex) => ({ isFilled, originalIndex }))
                .sort((a, b) => {
                  // Checked days come first (true before false)
                  if (a.isFilled !== b.isFilled) {
                    return a.isFilled ? -1 : 1;
                  }
                  // If both have same status, maintain original order
                  return a.originalIndex - b.originalIndex;
                });
              
              return reorderedProgress.map(({ isFilled, originalIndex }, displayIndex) => {
                const today = new Date();
                const dayOfWeek = today.getDay();
                const isToday = originalIndex === dayOfWeek;
                
                // Check if adjacent days in the reordered array are filled
                const prevFilled = displayIndex > 0 && reorderedProgress[displayIndex - 1].isFilled;
                const nextFilled = displayIndex < 6 && reorderedProgress[displayIndex + 1]?.isFilled;
                
                // Determine border radius and margin based on position in streak
                let borderRadiusStyle = {};
                let marginStyle = {};
                if (isFilled) {
                  if (!prevFilled && !nextFilled) {
                    // Single isolated day - full border radius, margin on both sides
                    borderRadiusStyle = { borderRadius: 16 };
                    marginStyle = { marginHorizontal: 4 };
                  } else if (!prevFilled) {
                    // Start of streak - left rounded, margin on left
                    borderRadiusStyle = { borderTopLeftRadius: 16, borderBottomLeftRadius: 16 };
                    marginStyle = { marginLeft: 4 };
                  } else if (!nextFilled) {
                    // End of streak - right rounded, margin on right
                    borderRadiusStyle = { borderTopRightRadius: 16, borderBottomRightRadius: 16 };
                    marginStyle = { marginRight: 4 };
                  } else {
                    // Middle of streak - no border radius, no margin
                    borderRadiusStyle = { borderRadius: 0 };
                    marginStyle = {};
                  }
                }
                
                return (
                  <View key={originalIndex} style={styles.progressDayContainer}>
                    {isFilled ? (
                      <View style={[
                        styles.progressDayFilled,
                        borderRadiusStyle,
                        marginStyle
                      ]}>
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      </View>
                    ) : (
                      <View style={styles.progressDayEmpty} />
                    )}
                  </View>
                );
              });
            })()}
          </View>
        </View>
        <View style={styles.motivationalBox}>
          <Text style={styles.motivationalText}>{getDailyMessage()}</Text>
        </View>
      </View>

      {/* Today's Verse Card */}
      {currentVerseData && currentSurahInfo ? (
        <View style={styles.verseCard}>
          {/* Arabic Verse - Current Chunk */}
          {(() => {
            const currentChunk = getCurrentChunk();
            const totalChunks = getTotalChunks();
            return currentChunk ? (
              <View style={styles.transliterationContainer}>
                <Text style={styles.transliterationSubtitle}>
                  Arabic Verse {totalChunks > 1 ? `(Part ${currentChunkIndex + 1} of ${totalChunks})` : ''}
                </Text>
                <Text style={styles.arabicText}>{currentChunk}</Text>
              </View>
            ) : null;
          })()}
          
          {/* English Translation */}
          <View style={styles.translationContainer}>
            <Text style={styles.translationSubtitle}>Full Verse Translation</Text>
            <Text style={styles.englishText}>
              {getVerseTranslation(currentVerseData.verse.surah_no, currentVerseData.verse.ayah_no_surah)}
            </Text>
          </View>

          {/* Bottom Row */}
          <View style={styles.cardFooter}>
            <Text style={styles.verseReference}>
              Surah {currentSurahInfo.transliteration}, {currentVerseData.verse.ayah_no_surah}
            </Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={toggleLikeVerse}
              >
                <Text style={[
                  styles.actionButtonIcon,
                  isVerseLiked() && styles.likedIcon
                ]}>
                  {isVerseLiked() ? '❤️' : '♡'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionButtonIcon}>↗</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.verseCard}>
          <Text style={styles.completedText}>Congratulations!</Text>
          <Text style={styles.completedSubtext}>
            You have completed all verses
          </Text>
        </View>
      )}

      {/* Surah List Title */}
      <View style={styles.surahListSection}>
        <Text style={styles.surahListTitle}>Surah List</Text>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={surahListData}
        keyExtractor={(item) => item.chapter.toString()}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.surahListItem}
            onPress={() => navigation.navigate('Surah', { chapter: item.chapter })}
          >
            <View style={styles.surahListItemContent}>
              <Text style={styles.surahNumber}>{item.chapter}</Text>
              <View style={styles.surahTextContainer}>
                <Text style={styles.surahName}>{item.surah.transliteration}</Text>
                <Text style={styles.surahTranslation}>{item.surah.translation}</Text>
              </View>
            </View>
            {completedSurahs.has(item.chapter) && (
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => ({
          length: 60,
          offset: 60 * index,
          index,
        })}
      />

      {/* Bottom Navigation Bar */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
          <Ionicons name="home" size={24} color="#4A90E2" />
          <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Streak')}>
          <Ionicons name="flame" size={24} color="#FFFFFF" />
          <Text style={styles.navLabel}>Streak</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Test')}>
          <Ionicons name="book" size={24} color="#FFFFFF" />
          <Text style={styles.navLabel}>Test</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings" size={24} color="#FFFFFF" />
          <Text style={styles.navLabel}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1419', // Subtle blueish dark background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F1419', // Subtle blueish dark background
  },
  listContent: {
    paddingBottom: 100, // Space for bottom nav
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 10,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#999999',
  },
  streakContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#4A90E2', // Blue background to match streak theme
    borderRadius: 20,
  },
  streakText: {
    fontSize: 14,
    color: '#FFFFFF', // White text on blue background
    fontWeight: '600',
  },
  memorizedCountContainer: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(74, 144, 226, 0.2)',
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  memorizedCountText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '600',
  },
  verseCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 15,
    padding: 25,
    marginHorizontal: 20,
    marginBottom: 30,
    minHeight: 200,
    justifyContent: 'space-between',
  },
  arabicText: {
    fontSize: 32,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 60,
    fontFamily: 'IndoPak',
    flex: 1,
    marginBottom: 15,
  },
  transliterationContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)', // Subtle border matching design
    width: '100%',
    alignItems: 'center',
  },
  transliterationSubtitle: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  transliterationText: {
    fontSize: 16,
    color: '#E0E0E0',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  translationContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)', // Subtle border matching design
    width: '100%',
    alignItems: 'center',
  },
  translationSubtitle: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  englishText: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 24,
    fontStyle: 'italic',
    paddingHorizontal: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  verseReference: {
    fontSize: 12,
    color: '#999999',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  actionButtonIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  likedIcon: {
    color: '#E74C3C',
  },
  completedText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  completedSubtext: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
  },
  surahListSection: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 15,
  },
  surahListTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  surahListItem: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)', // Subtle border matching design
  },
  surahListItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  surahNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90E2',
    marginRight: 15,
    minWidth: 30,
  },
  surahTextContainer: {
    flex: 1,
  },
  surahName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  surahTranslation: {
    fontSize: 13,
    color: '#CCCCCC',
    fontWeight: '400',
    marginTop: 2,
  },
  checkmark: {
    fontSize: 20,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#0F1419', // Subtle blueish dark background
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1A1F2E', // Subtle blueish border
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navIcon: {
    fontSize: 24,
    color: '#000000',
    marginBottom: 4,
  },
  navIconActive: {
    color: '#4A90E2',
  },
  navLabel: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  navLabelActive: {
    color: '#4A90E2',
  },
  streakBox: {
    backgroundColor: '#1A1A1A',
    borderRadius: 15,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  weeklyProgressContainer: {
    width: '100%',
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  weekDayLabel: {
    fontSize: 12,
    color: '#999999',
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  weekDayLabelToday: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  progressBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 6,
    height: 44,
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'visible',
  },
  progressDayContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  progressDayFilled: {
    width: '110%',
    height: 28,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDayEmpty: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  motivationalBox: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    alignItems: 'center',
  },
  motivationalText: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '500',
  },
});
