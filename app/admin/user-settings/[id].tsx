import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../src/context/ThemeContext';
import { FEATURE_KEYS } from '../../../src/context/AppSettingsContext';
import {
  getAllUserSettings,
  setUserSetting,
  updateUserStatus,
  resetUserPassword,
  deleteUser,
  getUserStats,
} from '../../../src/lib/database';
import { Card } from '../../../src/components/Card';
import { Button } from '../../../src/components/Button';
import { Input } from '../../../src/components/Input';

interface FeatureToggle {
  key: string;
  label: string;
  icon: string;
  description: string;
}

const MODULE_TOGGLES: FeatureToggle[] = [
  { key: FEATURE_KEYS.MODULE_MONEY, label: 'Money Module', icon: '💰', description: 'Borrowers, transactions, settlements' },
  { key: FEATURE_KEYS.MODULE_EXPENSE, label: 'Expense Module', icon: '💸', description: 'Expense tracking, categories' },
];

const FEATURE_TOGGLES: FeatureToggle[] = [
  { key: FEATURE_KEYS.FEATURE_PDF_REPORT, label: 'PDF Reports', icon: '📄', description: 'Generate expense reports' },
  { key: FEATURE_KEYS.FEATURE_RECEIPT_PHOTO, label: 'Receipt Photos', icon: '📷', description: 'Attach photos to expenses' },
  { key: FEATURE_KEYS.FEATURE_SETTLEMENT, label: 'Settlements', icon: '🤝', description: 'Settle borrower accounts' },
  { key: FEATURE_KEYS.FEATURE_BACKUP_RESTORE, label: 'Backup & Restore', icon: '💾', description: 'Database backup/restore' },
  { key: FEATURE_KEYS.FEATURE_DARK_MODE, label: 'Dark Mode', icon: '🌙', description: 'Theme toggle option' },
  { key: FEATURE_KEYS.FEATURE_CHARTS, label: 'Charts & Graphs', icon: '📊', description: 'Dashboard visualizations' },
];

export default function UserSettings() {
  const { id, userName, userEmail, isActive, adminId } = useLocalSearchParams<{
    id: string;
    userName: string;
    userEmail: string;
    isActive: string;
    adminId: string;
  }>();
  const { theme, isDark } = useTheme();
  const userId = Number(id);

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [userActive, setUserActive] = useState(isActive === '1');
  const [userStats, setUserStats] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPwd, setResettingPwd] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const userSettings = await getAllUserSettings(userId);
      setSettings(userSettings);
      const stats = await getUserStats(userId);
      setUserStats(stats);
    } catch (error) {
      console.error('Load user settings error:', error);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [userId]));

  const isFeatureEnabled = (key: string): boolean => {
    const value = settings[key];
    if (value === undefined) return true;
    return value === 'true';
  };

  const handleToggle = async (key: string, value: boolean) => {
    setSaving(true);
    try {
      await setUserSetting(userId, key, value ? 'true' : 'false');
      setSettings({ ...settings, [key]: value ? 'true' : 'false' });
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (value: boolean) => {
    try {
        console.log(`Toggling user status for ID: ${userId}, New Status: ${value}`);
      await updateUserStatus(userId, value);
       setUserActive(value);
      Alert.alert('✅ Updated', `User ${value ? 'activated' : 'deactivated'}`);
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setResettingPwd(true);
    try {
      await resetUserPassword(userId, newPassword);
      setNewPassword('');
      Alert.alert('✅ Success', 'Password has been reset');
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setResettingPwd(false);
    }
  };

  const handleDeleteUser = () => {
    Alert.alert(
      '⚠️ Delete User',
      `Permanently delete ${userName}? This will remove ALL their data including expenses, transactions, and settings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser(userId);
              Alert.alert('✅ Deleted', 'User has been removed');
              router.back();
            } catch (error) {
              Alert.alert('Error', (error as Error).message);
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (amount: number) =>
    '₹' + Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const renderToggle = (item: FeatureToggle) => (
    <View
      key={item.key}
      style={[styles.toggleRow, { borderBottomColor: theme.colors.border }]}
    >
      <Text style={styles.toggleIcon}>{item.icon}</Text>
      <View style={styles.toggleInfo}>
        <Text style={[styles.toggleLabel, { color: theme.colors.text }]}>
          {item.label}
        </Text>
        <Text style={[styles.toggleDesc, { color: theme.colors.muted }]}>
          {item.description}
        </Text>
      </View>
      <Switch
        value={isFeatureEnabled(item.key)}
        onValueChange={(value) => handleToggle(item.key, value)}
        trackColor={{
          false: isDark ? '#475569' : '#d1d5db',
          true: theme.colors.primary,
        }}
        thumbColor="#fff"
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>User Settings</Text>
          <Text style={styles.headerSubtitle}>{userName}</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* User Profile */}
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: userActive ? theme.colors.primary : theme.colors.muted }]}>
              <Text style={styles.avatarText}>{userName?.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: theme.colors.text }]}>{userName}</Text>
              <Text style={[styles.profileEmail, { color: theme.colors.muted }]}>{userEmail}</Text>
            </View>
          </View>

          {/* Active Toggle */}
          <View style={[styles.activeRow, { borderTopColor: theme.colors.border }]}>
            <View>
              <Text style={[styles.activeLabel, { color: theme.colors.text }]}>
                Account Active
              </Text>
              <Text style={[styles.activeDesc, { color: theme.colors.muted }]}>
                {userActive ? 'User can login and use the app' : 'User cannot login'}
              </Text>
            </View>
            <Switch
              value={userActive}
              onValueChange={handleToggleActive}
              trackColor={{
                false: isDark ? '#475569' : '#d1d5db',
                true: '#059669',
              }}
              thumbColor="#fff"
            />
          </View>
        </Card>

        {/* User Stats */}
        {userStats && (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              📊 User Data
            </Text>
            <View style={styles.statsGrid}>
              {[
                { label: 'Expenses', value: userStats.expenseCount, icon: '💸' },
                { label: 'Total Spent', value: formatCurrency(userStats.totalExpenses), icon: '💰' },
                { label: 'Borrowers', value: userStats.borrowerCount, icon: '👥' },
                { label: 'Given', value: formatCurrency(userStats.totalGiven), icon: '↗️' },
                { label: 'Received', value: formatCurrency(userStats.totalReceived), icon: '↙️' },
                { label: 'Transactions', value: userStats.transactionCount, icon: '📝' },
              ].map((s, i) => (
                <View
                  key={i}
                  style={[styles.statItem, { backgroundColor: isDark ? '#1e293b' : '#f9fafb' }]}
                >
                  <Text style={styles.statIcon}>{s.icon}</Text>
                  <Text style={[styles.statValue, { color: theme.colors.text }]}>{s.value}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.muted }]}>{s.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Module Controls */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            📦 Modules
          </Text>
          {MODULE_TOGGLES.map(renderToggle)}
        </Card>

        {/* Feature Controls */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            🎛️ Features
          </Text>
          {FEATURE_TOGGLES.map(renderToggle)}
        </Card>

        {/* Reset Password */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            🔑 Reset Password
          </Text>
          <Input
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Min 6 characters"
            secureTextEntry
          />
          <Button
            title="Reset Password"
            onPress={handleResetPassword}
            loading={resettingPwd}
          />
        </Card>

        {/* Danger Zone */}
        <Card style={[
          styles.dangerCard,
          {
            backgroundColor: isDark ? '#450a0a' : '#fef2f2',
            borderColor: isDark ? '#dc2626' : '#fecaca',
          },
        ]}>
          <Text style={styles.dangerTitle}>⚠️ Danger Zone</Text>
          <Text style={[styles.dangerDesc, { color: theme.colors.muted }]}>
            Permanently delete this user and all their data.
          </Text>
          <Button
            title="🗑️ Delete User"
            variant="danger"
            onPress={handleDeleteUser}
          />
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 60 },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  content: { flex: 1, padding: 16 },

  // Profile
  profileCard: { marginBottom: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  profileInfo: { flex: 1, marginLeft: 14 },
  profileName: { fontSize: 20, fontWeight: '700' },
  profileEmail: { fontSize: 13, marginTop: 2 },
  activeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTopWidth: 1 },
  activeLabel: { fontSize: 15, fontWeight: '600' },
  activeDesc: { fontSize: 12, marginTop: 2 },

  // Section
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statItem: { width: '31%', alignItems: 'center', paddingVertical: 12, borderRadius: 10 },
  statIcon: { fontSize: 18, marginBottom: 4 },
  statValue: { fontSize: 14, fontWeight: '700' },
  statLabel: { fontSize: 10, marginTop: 2 },

  // Toggle rows
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  toggleIcon: { fontSize: 22, marginRight: 12 },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  toggleDesc: { fontSize: 12, marginTop: 2 },

  // Danger
  dangerCard: { marginBottom: 16, borderWidth: 1 },
  dangerTitle: { fontSize: 15, fontWeight: '700', color: '#dc2626', marginBottom: 6 },
  dangerDesc: { fontSize: 13, marginBottom: 14 },
});