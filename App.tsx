import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './src/lib/supabase';
import RegisterScreen from './src/screens/RegisterScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import SurahScreen from './src/screens/SurahScreen';
import TestScreen from './src/screens/TestScreen';
import StreakScreen from './src/screens/StreakScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from './src/screens/TermsOfServiceScreen';
import OnboardingScreen1 from './src/screens/OnboardingScreen1';
import OnboardingScreen2 from './src/screens/OnboardingScreen2';
import OnboardingScreen3 from './src/screens/OnboardingScreen3';
import OnboardingScreen4 from './src/screens/OnboardingScreen4';
import OnboardingLoginScreen from './src/screens/OnboardingLoginScreen';
import { Session } from '@supabase/supabase-js';

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [startAtOnboarding4, setStartAtOnboarding4] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Load custom Arabic font
  const [fontsLoaded] = useFonts({
    'IndoPak': require('./assets/fonts/indopak-font.ttf'),
  });

  useEffect(() => {
    // Track app entry for streak (only if user is logged in)
    const markTodayAsActive = async () => {
      try {
        const today = new Date();
        const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        // Check if this is the first time using the app
        const firstUse = await AsyncStorage.getItem('firstAppUseDate');
        if (!firstUse) {
          await AsyncStorage.setItem('firstAppUseDate', dateKey);
        }
        
        const stored = await AsyncStorage.getItem('streakDays');
        const days = stored ? JSON.parse(stored) : [];
        
        if (!days.includes(dateKey)) {
          days.push(dateKey);
          await AsyncStorage.setItem('streakDays', JSON.stringify(days));
        }
      } catch (error) {
        console.error('Error marking today as active:', error);
      }
    };

    // Check onboarding status and session
    const initializeApp = async () => {
      try {
        const onboardingStatus = await AsyncStorage.getItem('onboardingCompleted');
        const isOnboardingCompleted = onboardingStatus === 'true';
        setOnboardingCompleted(isOnboardingCompleted);

        // Check if we should start at Onboarding4
        const shouldStartAtOnboarding4 = await AsyncStorage.getItem('startAtOnboarding4');
        if (shouldStartAtOnboarding4 === 'true') {
          setStartAtOnboarding4(true);
          // Clear the flag after reading it
          await AsyncStorage.removeItem('startAtOnboarding4');
        }
        
        // Check if we're transitioning
        const transitioning = await AsyncStorage.getItem('isTransitioning');
        if (transitioning === 'true') {
          setIsTransitioning(true);
        }

        const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      // Mark today as active when app starts (only if logged in)
      if (session) {
        markTodayAsActive();
      }
      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeApp();

    // Listen for auth changes
    let previousSession: Session | null = null;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // If we had a session and now we don't, we're signing out - show transition overlay
      if (previousSession !== null && session === null) {
        setIsTransitioning(true);
      }
      previousSession = session;
      
      setSession(session);
      
      // Mark today as active when user logs in
      if (session) {
        markTodayAsActive();
        // Mark onboarding as completed when user successfully logs in
        await AsyncStorage.setItem('onboardingCompleted', 'true');
        setOnboardingCompleted(true);
        setStartAtOnboarding4(false); // Clear flag when logging in
        setIsTransitioning(false);
      } else {
        // When user signs out, check if we should start at Onboarding4
        const shouldStartAtOnboarding4 = await AsyncStorage.getItem('startAtOnboarding4');
        if (shouldStartAtOnboarding4 === 'true') {
          setStartAtOnboarding4(true);
          await AsyncStorage.removeItem('startAtOnboarding4');
        }
        // Re-check onboarding status
        const onboardingStatus = await AsyncStorage.getItem('onboardingCompleted');
        setOnboardingCompleted(onboardingStatus === 'true');
        
        // Check if we're transitioning and show overlay
        const transitioning = await AsyncStorage.getItem('isTransitioning');
        if (transitioning === 'true') {
          setIsTransitioning(true);
          // Clear the flag and hide overlay after navigation completes
          await AsyncStorage.removeItem('isTransitioning');
          setTimeout(() => {
            setIsTransitioning(false);
          }, 400);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Hide splash screen after app is ready and minimum duration
  useEffect(() => {
    if (!loading && fontsLoaded && onboardingCompleted !== null) {
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 2000); // Minimum 2 seconds splash screen
      return () => clearTimeout(timer);
    }
  }, [loading, fontsLoaded, onboardingCompleted]);

  // Show splash screen
  if (showSplash) {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.splashContent}>
          <Image
            source={require('./design/Logo design for Rizqa app.png')}
            style={styles.splashLogo}
            resizeMode="contain"
          />
        </View>
      </View>
    );
  }

  if (!fontsLoaded || loading || onboardingCompleted === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0F1419' }}>
      {/* Transition overlay to prevent white flash */}
      {isTransitioning && (
        <View style={styles.transitionOverlay} pointerEvents="none" />
      )}
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: '#4A90E2',
            background: '#0F1419',
            card: '#0F1419',
            text: '#FFFFFF',
            border: '#333333',
            notification: '#4A90E2',
          },
        }}
      >
        <Stack.Navigator
          initialRouteName={
            !session && !onboardingCompleted && startAtOnboarding4 
              ? 'Onboarding4' 
              : undefined
          }
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            presentation: 'card',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            fullScreenGestureEnabled: true,
            contentStyle: { backgroundColor: '#0F1419' },
            cardStyle: { backgroundColor: '#0F1419' },
            animationDuration: 200,
          }}
        >
        {session ? (
          // User is logged in, show Home screen
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen
              name="Surah"
              component={SurahScreen}
              options={{
                animation: 'fade',
                presentation: 'card',
                gestureEnabled: true,
                gestureDirection: 'horizontal',
                fullScreenGestureEnabled: true,
                contentStyle: { backgroundColor: '#0F1419' },
                cardStyle: { backgroundColor: '#0F1419' },
                animationDuration: 200,
              }}
            />
            <Stack.Screen
              name="Test"
              component={TestScreen}
              options={{
                animation: 'fade',
                presentation: 'card',
                gestureEnabled: true,
                gestureDirection: 'horizontal',
                fullScreenGestureEnabled: true,
                contentStyle: { backgroundColor: '#0F1419' },
                cardStyle: { backgroundColor: '#0F1419' },
                animationDuration: 200,
              }}
            />
            <Stack.Screen
              name="Streak"
              component={StreakScreen}
              options={{
                animation: 'fade',
                presentation: 'card',
                gestureEnabled: true,
                gestureDirection: 'horizontal',
                fullScreenGestureEnabled: true,
                contentStyle: { backgroundColor: '#0F1419' },
                cardStyle: { backgroundColor: '#0F1419' },
                animationDuration: 200,
              }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                animation: 'fade',
                presentation: 'card',
                gestureEnabled: true,
                gestureDirection: 'horizontal',
                fullScreenGestureEnabled: true,
                contentStyle: { backgroundColor: '#0F1419' },
                cardStyle: { backgroundColor: '#0F1419' },
                animationDuration: 200,
              }}
            />
            <Stack.Screen
              name="PrivacyPolicy"
              component={PrivacyPolicyScreen}
              options={{
                animation: 'fade',
                presentation: 'card',
                gestureEnabled: true,
                gestureDirection: 'horizontal',
                fullScreenGestureEnabled: true,
                contentStyle: { backgroundColor: '#0F1419' },
                cardStyle: { backgroundColor: '#0F1419' },
                animationDuration: 200,
              }}
            />
            <Stack.Screen
              name="TermsOfService"
              component={TermsOfServiceScreen}
              options={{
                animation: 'fade',
                presentation: 'card',
                gestureEnabled: true,
                gestureDirection: 'horizontal',
                fullScreenGestureEnabled: true,
                contentStyle: { backgroundColor: '#0F1419' },
                cardStyle: { backgroundColor: '#0F1419' },
                animationDuration: 200,
              }}
            />
          </>
        ) : onboardingCompleted ? (
          // Onboarding completed but not logged in, show Register/Login screens
          <>
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
          </>
        ) : (
          // First time user or not logged in, show onboarding screens
          <>
            <Stack.Screen 
              name="Onboarding1" 
              component={OnboardingScreen1}
              options={{ animation: 'fade' }}
            />
            <Stack.Screen 
              name="Onboarding2" 
              component={OnboardingScreen2}
              options={{ animation: 'fade' }}
            />
            <Stack.Screen 
              name="Onboarding3" 
              component={OnboardingScreen3}
              options={{ animation: 'fade' }}
            />
            <Stack.Screen 
              name="Onboarding4" 
              component={OnboardingScreen4}
              options={{ animation: 'fade' }}
            />
            <Stack.Screen 
              name="OnboardingLogin" 
              component={OnboardingLoginScreen}
              options={{ animation: 'fade' }}
            />
          </>
        )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#0a1628', // Dark blue background matching app icon
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  splashContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  splashLogo: {
    width: 300,
    height: 300,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F1419',
  },
  transitionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F1419',
    zIndex: 9998,
  },
});

