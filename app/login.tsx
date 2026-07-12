import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { adminLogin } from '../src/lib/database';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { theme, isDark } = useTheme();
  const router = useRouter();

  // Admin login
  const [adminModal, setAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/(tabs)/dashboard');
    } catch (error) {
      Alert.alert('Login Failed', (error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminLogin() {
    if (!adminEmail || !adminPassword) {
      Alert.alert('Error', 'Please fill in all fields');
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
      Alert.alert('Admin Login Failed', (error as Error).message);
    } finally {
      setAdminLoading(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>💰</Text>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Money & Expense
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
              Track your finances offline
            </Text>
          </View>

          {/* Login Card */}
          <Card style={styles.card}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />
            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              style={styles.button}
            />
            <TouchableOpacity onPress={() => router.push('/signup')}>
              <Text style={[styles.link, { color: theme.colors.muted }]}>
                Don't have an account?{' '}
                <Text style={[styles.linkBold, { color: theme.colors.primary }]}>
                  Sign Up
                </Text>
              </Text>
            </TouchableOpacity>
          </Card>

          {/* Admin Login Button */}
          <TouchableOpacity
            style={[
              styles.adminButton,
              {
                backgroundColor: isDark ? '#334155' : '#f1f5f9',
                borderColor: theme.colors.border,
              },
            ]}
            onPress={() => setAdminModal(true)}
          >
            <Text style={styles.adminIcon}>🔐</Text>
            <Text style={[styles.adminText, { color: theme.colors.muted }]}>
              Admin Login
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Admin Login Modal */}
      <Modal visible={adminModal} animationType="slide" transparent>
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: theme.colors.overlay },
          ]}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.colors.modalBg },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                🔐 Admin Login
              </Text>
              <TouchableOpacity onPress={() => setAdminModal(false)}>
                <Text style={[styles.closeBtn, { color: theme.colors.muted }]}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <Text
              style={[styles.modalDesc, { color: theme.colors.muted }]}
            >
              Login as administrator to manage users and app settings.
            </Text>

            <Input
              label="Admin Email"
              value={adminEmail}
              onChangeText={setAdminEmail}
              placeholder="admin@app.local"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="Admin Password"
              value={adminPassword}
              onChangeText={setAdminPassword}
              placeholder="••••••••"
              secureTextEntry
            />

            <View
              style={[
                styles.infoBox,
                {
                  backgroundColor: isDark ? '#451a03' : '#fffbeb',
                  borderColor: isDark ? '#92400e' : '#fde68a',
                },
              ]}
            >
              <Text
                style={[
                  styles.infoText,
                  { color: isDark ? '#fcd34d' : '#92400e' },
                ]}
              >
                💡 Default: admin@app.local / admin123
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setAdminModal(false)}
              />
              <Button
                title="Login as Admin"
                onPress={handleAdminLogin}
                loading={adminLoading}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { fontSize: 16, marginTop: 8 },
  card: { padding: 24 },
  button: { marginTop: 8, marginBottom: 16 },
  link: { textAlign: 'center', fontSize: 14 },
  linkBold: { fontWeight: '600' },

  // Admin button
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  adminIcon: { fontSize: 18 },
  adminText: { fontSize: 14, fontWeight: '600' },

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
  infoBox: {
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  infoText: { fontSize: 12, lineHeight: 18 },
});