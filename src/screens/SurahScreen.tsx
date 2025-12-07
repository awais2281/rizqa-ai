import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

interface SurahScreenProps {
  route: any;
  navigation: any;
}

export default function SurahScreen({ route, navigation }: SurahScreenProps) {
  const { chapter } = route.params;
  const chapterKey = chapter.toString();
  const verses: Verse[] = quranData[chapterKey] || [];
  const surahInfo = surahNames[chapter] || { transliteration: `Surah ${chapter}`, translation: '' };
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{surahInfo.transliteration}</Text>
          <Text style={styles.headerSubtitle}>{surahInfo.translation}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Verses List */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {verses.map((verse, index) => (
          <View key={index} style={styles.verseItem}>
            <View style={styles.verseNumberContainer}>
              <Text style={styles.verseNumber}>{verse.verse}</Text>
            </View>
            <Text style={styles.verseText}>{verse.text}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#4A90E2',
    fontWeight: '600',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#999999',
  },
  placeholder: {
    width: 70,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  verseItem: {
    flexDirection: 'row',
    marginBottom: 25,
    alignItems: 'flex-start',
  },
  verseNumberContainer: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    marginTop: 2,
  },
  verseNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  verseText: {
    flex: 1,
    fontSize: 24,
    color: '#FFFFFF',
    lineHeight: 40,
    textAlign: 'right',
  },
});

