import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { AppSettingsProvider } from '../src/context/AppSettingsContext';
import { LanguageProvider } from '../src/context/LanguageContext';

// Keep the native splash screen visible until the root layout is mounted.
SplashScreen.preventAutoHideAsync();

// Configure the splash screen transition.
SplashScreen.setOptions({
  duration: 700,
  fade: true,
});

export default function RootLayout() {
  useEffect(() => {
    // The provider tree and navigation layout are now ready to render.
    SplashScreen.hideAsync().catch((error) => {
      console.warn('Unable to hide the splash screen:', error);
    });
  }, []);

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppSettingsProvider>
          <AuthProvider>
            <StatusBar style="auto" />

            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'fade',
                contentStyle: {
                  backgroundColor: '#4A00E0',
                },
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="signup" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="borrower/[id]" />
              <Stack.Screen name="admin" />
              <Stack.Screen name="tracker/customer-report/[id]" />
              <Stack.Screen name="organizer/service/[id]" />
              <Stack.Screen name="organizer/refill/[id]" />
              <Stack.Screen name="organizer/habit/[id]" />
              <Stack.Screen name="onboarding" />
            </Stack>
          </AuthProvider>
        </AppSettingsProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}