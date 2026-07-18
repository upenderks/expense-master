import { Stack } from 'expo-router';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { AppSettingsProvider } from '../src/context/AppSettingsContext';
import { LanguageProvider } from '../src/context/LanguageContext';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppSettingsProvider>
          <AuthProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="signup" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="borrower/[id]" />
              <Stack.Screen name="admin" />
              <Stack.Screen name="tracker/customer-report/[id]" />
            </Stack>
          </AuthProvider>
        </AppSettingsProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}