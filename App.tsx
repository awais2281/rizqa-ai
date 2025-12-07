import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from './src/lib/supabase';
import RegisterScreen from './src/screens/RegisterScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import SurahScreen from './src/screens/SurahScreen';
import TestScreen from './src/screens/TestScreen';
import { Session } from '@supabase/supabase-js';

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: '#4A90E2',
            background: '#000000',
            card: '#000000',
            text: '#FFFFFF',
            border: '#333333',
            notification: '#4A90E2',
          },
        }}
      >
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'simple_push',
            presentation: 'card',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            fullScreenGestureEnabled: true,
            contentStyle: { backgroundColor: '#000000' },
            animationDuration: 250,
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
                contentStyle: { backgroundColor: '#000000' },
                cardStyle: { backgroundColor: '#000000' },
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
                contentStyle: { backgroundColor: '#000000' },
                cardStyle: { backgroundColor: '#000000' },
                animationDuration: 200,
              }}
            />
          </>
        ) : (
          // User is not logged in, show Register screen first
          <>
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
          </>
        )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
});

