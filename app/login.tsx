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
  Modal,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { adminLogin } from '../src/lib/database';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { useLanguage } from '../src/context/LanguageContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { t } = useLanguage();

  const [adminModal, setAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert(t('error'), t('fill_all_fields'));
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/(tabs)/dashboard');
    } catch (error) {
      Alert.alert(t('login_failed'), (error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminLogin() {
    if (!adminEmail || !adminPassword) {
      Alert.alert(t('error'), t('fill_all_fields'));
      return;
    }
    setAdminLoading(true);
    try {
      const admin = await adminLogin(adminEmail, adminPassword);
      setAdminModal(false);
      setAdminEmail('');
      setAdminPassword('');
      router.push({
        pathname: '/admin',
        params: { adminId: admin.id, adminName: admin.name },
      });
    } catch (error) {
      Alert.alert(t('admin_login_failed'), (error as Error).message);
    } finally {
      setAdminLoading(false);
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
              <Text style={styles.headerTitle}>{t('app_name')}</Text>
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
            {t('sign_in')} 👋
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
            <Button
              title={t('sign_in')}
              onPress={handleLogin}
              loading={loading}
              style={styles.loginBtn}
              size="lg"
            />

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
              <Text style={[styles.dividerText, { color: theme.colors.muted }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
            </View>

            {/* Sign Up Link */}
            <TouchableOpacity
              style={[styles.signupBtn, { borderColor: theme.colors.primary }]}
              onPress={() => router.push('/signup')}
            >
              <Text style={[styles.signupBtnText, { color: theme.colors.primary }]}>
                {t('dont_have_account')}{' '}
                <Text style={styles.signupBtnBold}>{t('sign_up')}</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Features */}
          <View style={styles.featuresRow}>
            {[
              { emoji: '🔒', label: 'Offline' },
              { emoji: '🌙', label: 'Dark Mode' },
              { emoji: '🌐', label: 'Hindi' },
            ].map((item, i) => (
              <View key={i} style={[
                styles.featureChip,
                { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: theme.colors.border },
              ]}>
                <Text style={styles.featureEmoji}>{item.emoji}</Text>
                <Text style={[styles.featureLabel, { color: theme.colors.muted }]}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Admin */}
          <TouchableOpacity
            style={[
              styles.adminButton,
              {
                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                borderColor: theme.colors.border,
              },
            ]}
            onPress={() => setAdminModal(true)}
          >
            <Text style={styles.adminIcon}>🔐</Text>
            <Text style={[styles.adminText, { color: theme.colors.muted }]}>
              {t('admin_login')}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Admin Modal ───────────────────────────────────────────── */}
      <Modal visible={adminModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.modalBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                🔐 {t('admin_login')}
              </Text>
              <TouchableOpacity onPress={() => setAdminModal(false)}>
                <Text style={[styles.closeBtn, { color: theme.colors.muted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalDesc, { color: theme.colors.muted }]}>
              {t('admin_login_desc')}
            </Text>

            <Input
              label={t('admin_email')}
              value={adminEmail}
              onChangeText={setAdminEmail}
              placeholder="admin@app.local"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label={t('admin_password')}
              value={adminPassword}
              onChangeText={setAdminPassword}
              placeholder="••••••••"
              secureTextEntry
            />

            <View style={[
              styles.infoBox,
              {
                backgroundColor: isDark ? '#451a03' : '#fffbeb',
                borderColor: isDark ? '#92400e' : '#fde68a',
              },
            ]}>
              <Text style={[styles.infoText, { color: isDark ? '#fcd34d' : '#92400e' }]}>
                💡 {t('admin_default_creds')}
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <Button title={t('cancel')} variant="secondary" onPress={() => setAdminModal(false)} />
              <Button title={t('login_as_admin')} onPress={handleAdminLogin} loading={adminLoading} />
            </View>
          </View>
        </View>
      </Modal>
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
  loginBtn: { marginTop: 4 },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontWeight: '500' },

  // Signup
  signupBtn: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  signupBtnText: { fontSize: 14 },
  signupBtnBold: { fontWeight: '700' },

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

  // Admin
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  adminIcon: { fontSize: 15 },
  adminText: { fontSize: 13, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  closeBtn: { fontSize: 22, padding: 4 },
  modalDesc: { fontSize: 13, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  infoBox: { borderRadius: 8, padding: 10, borderWidth: 1, marginBottom: 8 },
  infoText: { fontSize: 12, lineHeight: 18 },
});