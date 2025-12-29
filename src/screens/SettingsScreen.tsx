import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

interface SettingsScreenProps {
  navigation: any;
}

interface LikedVerse {
  surah_no: number;
  ayah_no_surah: number;
  ayah_ar: string;
  ayah_en: string;
  surah_name: string;
  surah_translation: string;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const [showContactEmail, setShowContactEmail] = React.useState(false);
  const [likedVerses, setLikedVerses] = React.useState<LikedVerse[]>([]);
  const [showLikedVerses, setShowLikedVerses] = React.useState(false);

  React.useEffect(() => {
    loadLikedVerses();
  }, []);

  const loadLikedVerses = async () => {
    try {
      const stored = await AsyncStorage.getItem('likedVersesData');
      if (stored) {
        const versesData = JSON.parse(stored);
        const versesArray = Object.values(versesData) as LikedVerse[];
        // Sort by surah number, then ayah number
        versesArray.sort((a, b) => {
          if (a.surah_no !== b.surah_no) {
            return a.surah_no - b.surah_no;
          }
          return a.ayah_no_surah - b.ayah_no_surah;
        });
        setLikedVerses(versesArray);
      }
    } catch (error) {
      console.error('Error loading liked verses:', error);
    }
  };

  const handleLogOut = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              // Set transition flag to show overlay
              await AsyncStorage.setItem('isTransitioning', 'true');
              // Set flag to start at Onboarding4
              await AsyncStorage.setItem('startAtOnboarding4', 'true');
              // Clear onboarding flag so onboarding screens are available
              await AsyncStorage.removeItem('onboardingCompleted');
              // Sign out - this will trigger app re-render
              await supabase.auth.signOut();
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handlePrivacyPolicy = () => {
    navigation.navigate('PrivacyPolicy');
  };

  const handleTermsOfUse = () => {
    navigation.navigate('TermsOfService');
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This will permanently delete all your data including your progress, streaks, and memorized verses. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              // Set transition flag to show overlay
              await AsyncStorage.setItem('isTransitioning', 'true');
              // Set flag to start at Onboarding4 before clearing
              await AsyncStorage.setItem('startAtOnboarding4', 'true');
              // Clear all AsyncStorage data (this will clear the flag we just set)
              // So we need to set it again after clearing
              await AsyncStorage.clear();
              await AsyncStorage.setItem('startAtOnboarding4', 'true');
              await AsyncStorage.setItem('isTransitioning', 'true');
              
              // Sign out from Supabase
              await supabase.auth.signOut();
              Alert.alert('Account Deleted', 'Your account and all data have been deleted.');
            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleContactUs = () => {
    setShowContactEmail(!showContactEmail);
  };

  const handleLikedVerses = () => {
    setShowLikedVerses(!showLikedVerses);
  };

  const handleDiscord = async () => {
    try {
      const url = 'https://discord.gg/ZeqzmfNf5';
      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening Discord link:', error);
      Alert.alert('Error', 'Failed to open Discord link. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Liked Verses Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Content</Text>
          <View style={styles.sectionContainer}>
            <TouchableOpacity style={styles.row} onPress={handleLikedVerses}>
              <Text style={styles.rowLabel}>Liked Verses ({likedVerses.length})</Text>
              <Ionicons 
                name={showLikedVerses ? "chevron-down" : "chevron-forward"} 
                size={20} 
                color="#999999" 
              />
            </TouchableOpacity>
            {showLikedVerses && (
              <View style={styles.likedVersesContainer}>
                {likedVerses.length === 0 ? (
                  <Text style={styles.noLikedVersesText}>No liked verses yet</Text>
                ) : (
                  <ScrollView 
                    style={styles.likedVersesScrollView}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={false}
                  >
                    {likedVerses.map((verse, index) => (
                      <View 
                        key={index} 
                        style={[
                          styles.likedVerseItem,
                          index === likedVerses.length - 1 && styles.likedVerseItemLast
                        ]}
                      >
                        <View style={styles.likedVerseHeader}>
                          <Text style={styles.likedVerseReference}>
                            {verse.surah_name} {verse.ayah_no_surah}
                          </Text>
                        </View>
                        <Text style={styles.likedVerseArabic}>{verse.ayah_ar}</Text>
                        {verse.ayah_en && (
                          <Text style={styles.likedVerseEnglish}>{verse.ayah_en}</Text>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionContainer}>
            <TouchableOpacity style={styles.row} onPress={handleContactUs}>
              <Text style={styles.rowLabel}>Contact Us</Text>
              <Ionicons 
                name={showContactEmail ? "chevron-down" : "chevron-forward"} 
                size={20} 
                color="#999999" 
              />
            </TouchableOpacity>
            {showContactEmail && (
              <View style={styles.contactEmailContainer}>
                <Text style={styles.contactEmailText}>rizqahelpteam@gmail.com</Text>
              </View>
            )}
            <TouchableOpacity style={styles.row} onPress={handlePrivacyPolicy}>
              <Text style={styles.rowLabel}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={20} color="#999999" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.row} onPress={handleTermsOfUse}>
              <Text style={styles.rowLabel}>Terms of Use</Text>
              <Ionicons name="chevron-forward" size={20} color="#999999" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.row} onPress={handleLogOut}>
              <Text style={[styles.rowLabel, styles.logOutText]}>Log Out</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={handleDeleteAccount}>
              <Text style={[styles.rowLabel, styles.deleteAccountText]}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Discord Button - Bottom of page */}
        <View style={styles.discordSection}>
          <TouchableOpacity style={styles.discordButton} onPress={handleDiscord}>
            <Ionicons name="logo-discord" size={24} color="#FFFFFF" style={styles.discordIcon} />
            <Text style={styles.discordButtonText}>Join our Discord</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
          <Ionicons name="home-outline" size={24} color="#FFFFFF" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Streak')}>
          <Ionicons name="flame" size={24} color="#FFFFFF" />
          <Text style={styles.navLabel}>Streak</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Test')}>
          <Ionicons name="book" size={24} color="#FFFFFF" />
          <Text style={styles.navLabel}>Test</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="settings" size={24} color="#4A90E2" />
          <Text style={[styles.navLabel, styles.navLabelActive]}>Settings</Text>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 12,
    fontWeight: '600',
  },
  sectionContainer: {
    backgroundColor: '#2A2A3E',
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  logOutText: {
    color: '#E74C3C',
  },
  deleteAccountText: {
    color: '#E74C3C',
    fontWeight: '600',
  },
  discordSection: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 100, // Extra padding to account for bottom nav
    marginBottom: 20,
  },
  discordButton: {
    backgroundColor: '#5865F2',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#5865F2',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  discordIcon: {
    marginRight: 10,
  },
  discordButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  contactEmailContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderTopWidth: 1,
    borderTopColor: '#1A1A2E',
  },
  contactEmailText: {
    fontSize: 16,
    color: '#4A90E2',
    textAlign: 'center',
  },
  likedVersesContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderTopWidth: 1,
    borderTopColor: '#1A1A2E',
    maxHeight: 400,
  },
  likedVersesScrollView: {
    maxHeight: 400,
  },
  noLikedVersesText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  likedVerseItem: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  likedVerseItemLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
  },
  likedVerseHeader: {
    marginBottom: 8,
  },
  likedVerseReference: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '600',
  },
  likedVerseArabic: {
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'right',
    lineHeight: 32,
    marginBottom: 8,
    fontFamily: 'IndoPak',
  },
  likedVerseEnglish: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
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
    marginBottom: 4,
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
