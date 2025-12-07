import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const quranData = require('../../qurandata/quran (1).json');

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

interface Verse {
  chapter: number;
  verse: number;
  text: string;
}

interface HomeScreenProps {
  navigation: any;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
  const [completedSurahs, setCompletedSurahs] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [allVerses, setAllVerses] = useState<Array<{ chapter: number; verse: Verse }>>([]);

  useEffect(() => {
    // Load all verses in order from the new JSON structure
    const verses: Array<{ chapter: number; verse: Verse }> = [];
    
    // Iterate through all chapters (1-114)
    for (let chapter = 1; chapter <= 114; chapter++) {
      const chapterKey = chapter.toString();
      if (quranData[chapterKey] && Array.isArray(quranData[chapterKey])) {
        quranData[chapterKey].forEach((verse: Verse) => {
          verses.push({ chapter, verse });
        });
      }
    }
    
    setAllVerses(verses);
    loadProgress(verses);
  }, []);

  // Reload progress when screen comes into focus (e.g., returning from TestScreen)
  useFocusEffect(
    useCallback(() => {
      if (allVerses.length > 0) {
        loadProgress(allVerses);
      }
    }, [allVerses])
  );

  const loadProgress = async (verses: Array<{ chapter: number; verse: Verse }>) => {
    try {
      const savedSurah = await AsyncStorage.getItem('currentSurah');
      const savedAyah = await AsyncStorage.getItem('currentAyah');
      
      if (savedSurah && savedAyah) {
        const surah = parseInt(savedSurah);
        const ayah = parseInt(savedAyah);
        // Find the index of the verse
        const index = verses.findIndex(
          (v) => v.chapter === surah && v.verse.verse === ayah
        );
        if (index !== -1) {
          setCurrentVerseIndex(index);
        }
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setLoading(false);
    }
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
        <Text style={styles.greeting}>Assalamu Alaikum</Text>
        <Text style={styles.subtitle}>Today's Verse</Text>
      </View>

      {/* Today's Verse Card */}
      {currentVerseData && currentSurahInfo ? (
        <View style={styles.verseCard}>
          {/* Arabic Text Only */}
          <Text style={styles.arabicText}>
            {currentVerseData.verse.text}
          </Text>

          {/* Bottom Row */}
          <View style={styles.cardFooter}>
            <Text style={styles.verseReference}>
              Surah {currentSurahInfo.transliteration}, {currentVerseData.verse.verse}
            </Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionButtonIcon}>♡</Text>
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
              <Text style={styles.checkmark}>✓</Text>
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
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
          <Text style={[styles.navIcon, styles.navIconActive]}>⌂</Text>
          <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>🔥</Text>
          <Text style={styles.navLabel}>Streak</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Test')}>
          <Text style={styles.navIcon}>🎤</Text>
          <Text style={styles.navLabel}>Test</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>⚙</Text>
          <Text style={styles.navLabel}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  listContent: {
    paddingBottom: 100, // Space for bottom nav
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
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
    lineHeight: 50,
    fontFamily: 'System',
    flex: 1,
    marginBottom: 20,
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
    borderBottomColor: '#333333',
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
    fontSize: 12,
    color: '#999999',
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
    backgroundColor: '#000000',
    paddingVertical: 10,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#333333',
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
    color: '#FFFFFF',
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
});
