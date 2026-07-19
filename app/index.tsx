import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import * as SecureStore from 'expo-secure-store';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      checkNavigation();
    }
  }, [user, loading]);

  async function checkNavigation() {
    try {
      // Check if onboarding is done
      const onboardingDone = await SecureStore.getItemAsync('onboarding_done');

      if (!onboardingDone) {
        router.replace('/onboarding');
        return;
      }

      if (user) {
        router.replace('/(tabs)/dashboard');
      } else {
        router.replace('/login');
      }
    } catch {
      router.replace('/login');
    }
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563eb" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
});