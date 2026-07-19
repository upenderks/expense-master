import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { signup } = useAuth();
  const router = useRouter();
  const { theme, isDark } = useTheme();
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />

      {/* ── Compact Header ────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <View style={[styles.headerCircle, { backgroundColor: theme.colors.gradient2, opacity: 0.3 }]} />
        <View style={styles.headerContent}>
          <View style={styles.logoRow}>
            <View style={styles.logoBox}>
              <Text style={styles.logoEmoji}>📓</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>{t('create_account')}</Text>
              <Text style={styles.headerSubtitle}>{t('app_tagline')}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Form ──────────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Welcome */}
          <Text style={[styles.welcomeTitle, { color: theme.colors.text }]}>
            {t('sign_up')} ✨
          </Text>

          {/* Form Card */}
          <View style={[
            styles.formCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.cardBorder,
              shadowColor: theme.colors.shadow,
            },
          ]}>
            <Input
              label={t('full_name')}
              value={name}
              onChangeText={setName}
              placeholder="John Doe"
            />
            <Input
              label={t('email')}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label={t('password')}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />
            <Input
              label={t('confirm_password')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              secureTextEntry
            />

            <Button
              title={t('create_account')}
              onPress={handleSignup}
              loading={loading}
              style={styles.signupBtn}
              size="lg"
            />

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
              <Text style={[styles.dividerText, { color: theme.colors.muted }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
            </View>

            {/* Sign In Link */}
            <TouchableOpacity
              style={[styles.loginBtn, { borderColor: theme.colors.primary }]}
              onPress={() => router.push('/login')}
            >
              <Text style={[styles.loginBtnText, { color: theme.colors.primary }]}>
                {t('already_have_account')}{' '}
                <Text style={styles.loginBtnBold}>{t('sign_in')}</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Features */}
          <View style={styles.featuresRow}>
            {[
              { emoji: '💾', label: 'Auto Save' },
              { emoji: '🔒', label: 'Private' },
              { emoji: '📊', label: 'Reports' },
            ].map((item, i) => (
              <View
                key={i}
                style={[
                  styles.featureChip,
                  {
                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={styles.featureEmoji}>{item.emoji}</Text>
                <Text style={[styles.featureLabel, { color: theme.colors.muted }]}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },

  // ── Compact Header ────────────────────────────────────────────────
  header: {
    paddingTop: 44,
    paddingBottom: 20,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  headerCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -50,
    right: -50,
  },
  headerContent: { zIndex: 1 },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logoBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoEmoji: { fontSize: 28 },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },

  // ── Form ──────────────────────────────────────────────────────────
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
  },
  formCard: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
    marginBottom: 16,
  },
  signupBtn: { marginTop: 4 },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontWeight: '500' },

  // Login button
  loginBtn: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  loginBtnText: { fontSize: 14 },
  loginBtnBold: { fontWeight: '700' },

  // Features
  featuresRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  featureEmoji: { fontSize: 14 },
  featureLabel: { fontSize: 11, fontWeight: '600' },
});