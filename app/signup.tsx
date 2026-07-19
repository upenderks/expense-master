import { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();

  async function handleSignup() {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert(t('error'), t('fill_all_fields'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('error'), t('passwords_not_match'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('error'), t('password_min_length'));
      return;
    }

    setLoading(true);
    try {
      await signup(name, email, password);
      router.replace('/(tabs)/dashboard');
    } catch (error) {
      Alert.alert(t('signup_failed'), (error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.logo}>📓</Text>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {t('create_account')}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
              {t('app_tagline')}
            </Text>
          </View>

          <Card style={styles.card}>
            <Input label={t('full_name')} value={name} onChangeText={setName} placeholder="John Doe" />
            <Input label={t('email')} value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
            <Input label={t('password')} value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
            <Input label={t('confirm_password')} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="••••••••" secureTextEntry />
            <Button title={t('create_account')} onPress={handleSignup} loading={loading} style={styles.button} />
            <TouchableOpacity onPress={() => router.push('/login')}>
              <Text style={styles.link}>{t('already_have_account')} <Text style={styles.linkBold}>{t('sign_in')}</Text></Text>
            </TouchableOpacity>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  subtitle: { fontSize: 16, color: '#6b7280', marginTop: 8 },
  card: { padding: 24 },
  button: { marginTop: 8, marginBottom: 16 },
  link: { textAlign: 'center', color: '#6b7280', fontSize: 14 },
  linkBold: { color: '#3b82f6', fontWeight: '600' },
});
