import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const randomVerseData = require('../../qurandata/randomverse.json');

interface DailyText {
  text: string;
  source: string;
}

interface StreakScreenProps {
  navigation: any;
}

// Surah names mapping
const surahNames: { [key: number]: { transliteration: string; translation: string } } = {
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
  56: { transliteration: 'Al-Waqiah', translation: 'The Inevitable' },
  57: { transliteration: 'Al-Hadid', translation: 'The Iron' },
  58: { transliteration: 'Al-Mujadila', translation: 'The Pleading Woman' },
  59: { transliteration: 'Al-Hashr', translation: 'The Exile' },
  60: { transliteration: 'Al-Mumtahanah', translation: 'She That Is to Be Examined' },
  61: { transliteration: 'As-Saff', translation: 'The Ranks' },
  62: { transliteration: 'Al-Jumuah', translation: 'Friday' },
  63: { transliteration: 'Al-Munafiqun', translation: 'The Hypocrites' },
  64: { transliteration: 'At-Taghabun', translation: 'The Mutual Disillusion' },
  65: { transliteration: 'At-Talaq', translation: 'The Divorce' },
  66: { transliteration: 'At-Tahrim', translation: 'The Prohibition' },
  67: { transliteration: 'Al-Mulk', translation: 'The Sovereignty' },
  68: { transliteration: 'Al-Qalam', translation: 'The Pen' },
  69: { transliteration: 'Al-Haqqah', translation: 'The Reality' },
  70: { transliteration: 'Al-Maarij', translation: 'The Ascending Stairways' },
  71: { transliteration: 'Nuh', translation: 'Noah' },
  72: { transliteration: 'Al-Jinn', translation: 'The Jinn' },
  73: { transliteration: 'Al-Muzzammil', translation: 'The Enshrouded One' },
  74: { transliteration: 'Al-Muddaththir', translation: 'The Cloaked One' },
  75: { transliteration: 'Al-Qiyamah', translation: 'The Resurrection' },
  76: { transliteration: 'Al-Insan', translation: 'The Human' },
  77: { transliteration: 'Al-Mursalat', translation: 'The Emissaries' },
  78: { transliteration: 'An-Naba', translation: 'The Tidings' },
  79: { transliteration: 'An-Naziat', translation: 'Those Who Drag Forth' },
  80: { transliteration: 'Abasa', translation: 'He Frowned' },
  81: { transliteration: 'At-Takwir', translation: 'The Overthrowing' },
  82: { transliteration: 'Al-Infitar', translation: 'The Cleaving' },
  83: { transliteration: 'Al-Mutaffifin', translation: 'The Defrauding' },
  84: { transliteration: 'Al-Inshiqaq', translation: 'The Splitting Open' },
  85: { transliteration: 'Al-Buruj', translation: 'The Constellations' },
  86: { transliteration: 'At-Tariq', translation: 'The Nightcomer' },
  87: { transliteration: 'Al-Ala', translation: 'The Most High' },
  88: { transliteration: 'Al-Ghashiyah', translation: 'The Overwhelming' },
  89: { transliteration: 'Al-Fajr', translation: 'The Dawn' },
  90: { transliteration: 'Al-Balad', translation: 'The City' },
  91: { transliteration: 'Ash-Shams', translation: 'The Sun' },
  92: { transliteration: 'Al-Layl', translation: 'The Night' },
  93: { transliteration: 'Ad-Duha', translation: 'The Morning Hours' },
  94: { transliteration: 'Ash-Sharh', translation: 'The Relief' },
  95: { transliteration: 'At-Tin', translation: 'The Fig' },
  96: { transliteration: 'Al-Alaq', translation: 'The Clot' },
  97: { transliteration: 'Al-Qadr', translation: 'The Power' },
  98: { transliteration: 'Al-Bayyinah', translation: 'The Evidence' },
  99: { transliteration: 'Az-Zalzalah', translation: 'The Earthquake' },
  100: { transliteration: 'Al-Adiyat', translation: 'The Courser' },
  101: { transliteration: 'Al-Qariah', translation: 'The Calamity' },
  102: { transliteration: 'At-Takathur', translation: 'The Rivalry' },
  103: { transliteration: 'Al-Asr', translation: 'The Declining Day' },
  104: { transliteration: 'Al-Humazah', translation: 'The Traducer' },
  105: { transliteration: 'Al-Fil', translation: 'The Elephant' },
  106: { transliteration: 'Quraysh', translation: 'Quraysh' },
  107: { transliteration: 'Al-Maun', translation: 'The Small Kindnesses' },
  108: { transliteration: 'Al-Kawthar', translation: 'The Abundance' },
  109: { transliteration: 'Al-Kafirun', translation: 'The Disbelievers' },
  110: { transliteration: 'An-Nasr', translation: 'The Divine Support' },
  111: { transliteration: 'Al-Masad', translation: 'The Palm Fibre' },
  112: { transliteration: 'Al-Ikhlas', translation: 'The Sincerity' },
  113: { transliteration: 'Al-Falaq', translation: 'The Daybreak' },
  114: { transliteration: 'An-Nas', translation: 'The Mankind' },
};

export default function StreakScreen({ navigation }: StreakScreenProps) {
  const insets = useSafeAreaInsets();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeDays, setActiveDays] = useState<Set<string>>(new Set());
  const [firstAppUseDate, setFirstAppUseDate] = useState<string | null>(null);
  const [dailyText, setDailyText] = useState<DailyText | null>(null);

  // Track app entry for today and reload active days when screen is focused
  useFocusEffect(
    useCallback(() => {
      markTodayAsActive();
      loadActiveDays();
    }, [])
  );

  useEffect(() => {
    loadActiveDays();
    loadFirstAppUseDate();
    loadDailyText();
  }, []);

  useEffect(() => {
    loadActiveDays();
  }, [currentDate]);

  const markTodayAsActive = async () => {
    try {
      const today = new Date();
      const dateKey = formatDateKey(today);
      
      // Check if this is the first time using the app
      const firstUse = await AsyncStorage.getItem('firstAppUseDate');
      if (!firstUse) {
        await AsyncStorage.setItem('firstAppUseDate', dateKey);
        setFirstAppUseDate(dateKey);
      }
      
      const stored = await AsyncStorage.getItem('streakDays');
      const days = stored ? JSON.parse(stored) : [];
      
      if (!days.includes(dateKey)) {
        days.push(dateKey);
        await AsyncStorage.setItem('streakDays', JSON.stringify(days));
        setActiveDays(new Set(days));
      }
    } catch (error) {
      console.error('Error marking today as active:', error);
    }
  };

  const loadFirstAppUseDate = async () => {
    try {
      const stored = await AsyncStorage.getItem('firstAppUseDate');
      if (stored) {
        setFirstAppUseDate(stored);
      }
    } catch (error) {
      console.error('Error loading first app use date:', error);
    }
  };

  const loadActiveDays = async () => {
    try {
      const stored = await AsyncStorage.getItem('streakDays');
      const days = stored ? JSON.parse(stored) : [];
      setActiveDays(new Set(days));
    } catch (error) {
      console.error('Error loading active days:', error);
    }
  };

  const loadDailyText = () => {
    // Get a text based on the day of year for consistency
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    
    // Use day of year to select a text (modulo to stay within bounds)
    const textIndex = dayOfYear % randomVerseData.length;
    const text = randomVerseData[textIndex];
    setDailyText(text);
  };

  const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getDayStatus = (day: number): 'active' | 'missed' | 'future' | 'today' | 'beforeFirstUse' => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateKey = formatDateKey(date);
    const today = new Date();
    const todayKey = formatDateKey(today);
    
    if (date > today) {
      return 'future';
    }
    
    // If user hasn't started using the app yet, all days are before first use
    if (!firstAppUseDate) {
      return 'beforeFirstUse';
    }
    
    // Check if this day is before the first app use date
    if (dateKey < firstAppUseDate) {
      return 'beforeFirstUse';
    }
    
    // If it's today and marked as active, show as active (green)
    if (dateKey === todayKey) {
      return activeDays.has(dateKey) ? 'active' : 'today';
    }
    
    // Days after first use: active (green) if entered, missed (red) if not
    return activeDays.has(dateKey) ? 'active' : 'missed';
  };

  const handleDayPress = (day: number) => {
    // Days are clickable but don't change color - just for potential future functionality
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateKey = formatDateKey(date);
    const today = new Date();
    const todayKey = formatDateKey(today);
    
    // Only allow clicking on past or today dates, not future dates
    if (date > today) {
      return;
    }
    
    // No action - days are clickable but don't change
    console.log('Day clicked:', dateKey);
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    const days: (number | null)[] = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    
    return (
      <View style={styles.calendarContainer}>
        {/* Month Header */}
        <View style={styles.monthHeader}>
          <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton}>
            <Text style={styles.navButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.monthText}>{monthName}</Text>
          <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navButton}>
            <Text style={styles.navButtonText}>→</Text>
          </TouchableOpacity>
        </View>
        
        {/* Week Days Header */}
        <View style={styles.weekDaysHeader}>
          {weekDays.map((day, index) => (
            <Text key={index} style={styles.weekDayText}>{day}</Text>
          ))}
        </View>
        
        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {days.map((day, index) => {
            if (day === null) {
              return <View key={index} style={styles.dayCell} />;
            }
            
            const status = getDayStatus(day);
            const isClickable = status !== 'future';
            
            return (
              <TouchableOpacity
                key={index}
                style={styles.dayCell}
                onPress={() => handleDayPress(day)}
                disabled={!isClickable}
                activeOpacity={isClickable ? 0.7 : 1}
              >
                {status === 'active' && (
                  <View style={styles.activeCircle}>
                    <Text style={styles.dayText}>{day}</Text>
                  </View>
                )}
                {status === 'missed' && (
                  <View style={styles.missedCircle}>
                    <Text style={styles.dayText}>{day}</Text>
                  </View>
                )}
                {status === 'today' && (
                  <View style={styles.todayCircle}>
                    <Text style={styles.dayText}>{day}</Text>
                  </View>
                )}
                {status === 'beforeFirstUse' && (
                  <Text style={styles.beforeFirstUseText}>{day}</Text>
                )}
                {status === 'future' && (
                  <Text style={styles.futureDayText}>{day}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Streak</Text>
        </View>

        {/* Daily Text Card */}
        {dailyText && (
          <View style={styles.verseCard}>
            <Text style={styles.verseText}>{dailyText.text}</Text>
            <Text style={styles.verseReference}>{dailyText.source}</Text>
          </View>
        )}

        {/* Calendar */}
        {renderCalendar()}

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendCircle, styles.legendGreen]} />
            <Text style={styles.legendText}>Recited</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendCircle, styles.legendRed]} />
            <Text style={styles.legendText}>Missed</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
          <Ionicons name="home-outline" size={24} color="#FFFFFF" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="flame" size={24} color="#4A90E2" />
          <Text style={[styles.navLabel, styles.navLabelActive]}>Streak</Text>
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
    backgroundColor: '#1A1A2E',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  verseCard: {
    backgroundColor: '#2A2A3E',
    borderRadius: 15,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  verseReference: {
    fontSize: 14,
    color: '#4A90E2',
    marginTop: 12,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  verseText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  calendarContainer: {
    backgroundColor: '#2A2A3E',
    borderRadius: 15,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  navButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  monthText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  weekDaysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  weekDayText: {
    fontSize: 14,
    color: '#CCCCCC',
    fontWeight: '600',
    width: 40,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  activeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  missedCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E74C3C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4A90E2',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  futureDayText: {
    fontSize: 14,
    color: '#666666',
  },
  beforeFirstUseText: {
    fontSize: 14,
    color: '#888888',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingBottom: 100,
    gap: 30,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  legendGreen: {
    backgroundColor: '#4CAF50',
  },
  legendRed: {
    backgroundColor: '#E74C3C',
  },
  legendText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#2A2A3E',
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
    color: '#666666',
  },
  navLabelActive: {
    color: '#4A90E2',
    fontWeight: '600',
  },
});

