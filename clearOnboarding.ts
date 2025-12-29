// Utility script to clear onboarding storage
// Run this in your app temporarily or use it as a development tool

import AsyncStorage from '@react-native-async-storage/async-storage';

export const clearOnboardingStorage = async () => {
  try {
    await AsyncStorage.removeItem('onboardingCompleted');
    console.log('✅ Onboarding storage cleared!');
    return true;
  } catch (error) {
    console.error('❌ Error clearing onboarding storage:', error);
    return false;
  }
};

// To clear all app storage (more thorough):
export const clearAllAppStorage = async () => {
  try {
    await AsyncStorage.clear();
    console.log('✅ All app storage cleared!');
    return true;
  } catch (error) {
    console.error('❌ Error clearing all storage:', error);
    return false;
  }
};

