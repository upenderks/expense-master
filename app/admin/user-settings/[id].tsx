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
import { useLanguage } from '../../../src/context/LanguageContext';
import { FEATURE_KEYS } from '../../../src/context/AppSettingsContext';
import { Language } from '../../../src/i18n/translations';
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

export default function UserSettings() {
  const { id, userName, userEmail, isActive, adminId } = useLocalSearchParams<{
    id: string;
    userName: string;
    userEmail: string;
    isActive: string;
    adminId: string;
  }>();
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const userId = Number(id);

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [userActive, setUserActive] = useState(isActive === '1');
  const [userStats, setUserStats] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPwd, setResettingPwd] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Toggle arrays (inside component for t() access) ────────────────

  const MODULE_TOGGLES: FeatureToggle[] = [
    {
      key: FEATURE_KEYS.MODULE_MONEY,
      label: t('money_module'),
      icon: '💰',
      description: t('money_module_desc'),
    },
    {
      key: FEATURE_KEYS.MODULE_EXPENSE,
      label: t('expense_module'),
      icon: '💸',
      description: t('expense_module_desc'),
    },
    {
      key: FEATURE_KEYS.MODULE_TRACKER,
      label: t('tracker_module'),
      icon: '⏱️',
      description: t('tracker_module_desc'),
    },
  ];

  const FEATURE_TOGGLES: FeatureToggle[] = [
    {
      key: FEATURE_KEYS.FEATURE_PDF_REPORT,
      label: t('pdf_reports'),
      icon: '📄',
      description: t('pdf_reports_desc'),
    },
    {
      key: FEATURE_KEYS.FEATURE_RECEIPT_PHOTO,
      label: t('receipt_photos'),
      icon: '📷',
      description: t('receipt_photos_desc'),
    },
    {
      key: FEATURE_KEYS.FEATURE_SETTLEMENT,
      label: t('settlements_feature'),
      icon: '🤝',
      description: t('settlements_desc'),
    },
    {
      key: FEATURE_KEYS.FEATURE_BACKUP_RESTORE,
      label: t('backup_restore'),
      icon: '💾',
      description: t('backup_restore_desc'),
    },
    {
      key: FEATURE_KEYS.FEATURE_DARK_MODE,
      label: t('dark_mode_feature'),
      icon: '🌙',
      description: t('dark_mode_desc'),
    },
    {
      key: FEATURE_KEYS.FEATURE_CHARTS,
      label: t('charts_feature'),
      icon: '📊',
      description: t('charts_desc'),
    },
  ];

  // ── Load data ──────────────────────────────────────────────────────

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

  // ── Helpers ────────────────────────────────────────────────────────

  const isFeatureEnabled = (key: string): boolean => {
    const value = settings[key];
    if (value === undefined) return true;
    return value === 'true';
  };

  const formatCurrency = (amount: number) =>
    '₹' + Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  // ── Handlers ───────────────────────────────────────────────────────

  const handleToggle = async (key: string, value: boolean) => {
    setSaving(true);
    try {
      await setUserSetting(userId, key, value ? 'true' : 'false');
      setSettings({ ...settings, [key]: value ? 'true' : 'false' });
    } catch (error) {
      Alert.alert(t('error'), (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (value: boolean) => {
    try {
      await updateUserStatus(userId, value);
      setUserActive(value);
      Alert.alert(
        `✅ ${t('updated')}`,
        value ? t('user_activated') : t('user_deactivated')
      );
    } catch (error) {
      Alert.alert(t('error'), (error as Error).message);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert(t('error'), t('password_min_length'));
      return;
    }
    setResettingPwd(true);
    try {
      await resetUserPassword(userId, newPassword);
      setNewPassword('');
      Alert.alert(`✅ ${t('success')}`, t('password_reset_success'));
    } catch (error) {
      Alert.alert(t('error'), (error as Error).message);
    } finally {
      setResettingPwd(false);
    }
  };

  const handleDeleteUser = () => {
    Alert.alert(
      `⚠️ ${t('delete_user')}`,
      `${userName} - ${t('delete_user_confirm')}`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser(userId);
              Alert.alert(`✅ ${t('success')}`, t('user_deleted'));
              router.back();
            } catch (error) {
              Alert.alert(t('error'), (error as Error).message);
            }
          },
        },
      ]
    );
  };

  const handleSetLanguage = async (lang: string) => {
    setSaving(true);
    try {
      await setUserSetting(userId, 'app_language', lang);
      setSettings({ ...settings, app_language: lang });
    } catch (error) {
      Alert.alert(t('error'), (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ── Render toggle row ──────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← {t('back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('user_settings')}</Text>
          <Text style={styles.headerSubtitle}>{userName}</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>

        {/* User Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={[
              styles.avatar,
              { backgroundColor: userActive ? theme.colors.primary : theme.colors.muted },
            ]}>
              <Text style={styles.avatarText}>
                {userName?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: theme.colors.text }]}>
                {userName}
              </Text>
              <Text style={[styles.profileEmail, { color: theme.colors.muted }]}>
                {userEmail}
              </Text>
            </View>
          </View>

          {/* Active Toggle */}
          <View style={[styles.activeRow, { borderTopColor: theme.colors.border }]}>
            <View>
              <Text style={[styles.activeLabel, { color: theme.colors.text }]}>
                {t('account_active')}
              </Text>
              <Text style={[styles.activeDesc, { color: theme.colors.muted }]}>
                {userActive ? t('user_can_login') : t('user_cannot_login')}
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
              📊 {t('user_data')}
            </Text>
            <View style={styles.statsGrid}>
              {[
                { label: t('expenses'), value: userStats.expenseCount, icon: '💸' },
                { label: t('total_expenses'), value: formatCurrency(userStats.totalExpenses), icon: '💰' },
                { label: t('borrowers'), value: userStats.borrowerCount, icon: '👥' },
                { label: t('total_given'), value: formatCurrency(userStats.totalGiven), icon: '↗️' },
                { label: t('total_received'), value: formatCurrency(userStats.totalReceived), icon: '↙️' },
                { label: t('transactions'), value: userStats.transactionCount, icon: '📝' },
              ].map((s, i) => (
                <View
                  key={i}
                  style={[styles.statItem, { backgroundColor: isDark ? '#1e293b' : '#f9fafb' }]}
                >
                  <Text style={styles.statIcon}>{s.icon}</Text>
                  <Text style={[styles.statValue, { color: theme.colors.text }]}>
                    {s.value}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.muted }]}>
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Module Controls */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            📦 {t('modules')}
          </Text>
          {MODULE_TOGGLES.map(renderToggle)}
        </Card>

        {/* Feature Controls */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            🎛️ {t('features')}
          </Text>
          {FEATURE_TOGGLES.map(renderToggle)}
        </Card>

        {/* Language Control */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            🌐 {t('language')}
          </Text>
          <View style={styles.languageRow}>
            {([
              { lang: 'en', label: 'English', icon: '🇬🇧' },
              { lang: 'hi', label: 'हिंदी', icon: '🇮🇳' },
            ]).map((item) => {
              const currentLang = settings['app_language'] || 'en';
              return (
                <TouchableOpacity
                  key={item.lang}
                  style={[
                    styles.languageOption,
                    {
                      backgroundColor:
                        currentLang === item.lang
                          ? theme.colors.primary
                          : isDark ? '#334155' : '#e5e7eb',
                      borderColor:
                        currentLang === item.lang
                          ? theme.colors.primary
                          : theme.colors.border,
                    },
                  ]}
                  onPress={() => handleSetLanguage(item.lang)}
                >
                  <Text style={styles.languageOptionIcon}>{item.icon}</Text>
                  <Text style={[
                    styles.languageOptionLabel,
                    {
                      color: currentLang === item.lang ? '#fff' : theme.colors.text,
                    },
                  ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Reset Password */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            🔑 {t('reset_password')}
          </Text>
          <Input
            label={t('new_password')}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={t('min_6_chars')}
            secureTextEntry
          />
          <Button
            title={`🔑 ${t('reset_password')}`}
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
          <Text style={styles.dangerTitle}>⚠️ {t('danger_zone')}</Text>
          <Text style={[styles.dangerDesc, { color: theme.colors.muted }]}>
            {t('delete_user_confirm')}
          </Text>
          <Button
            title={`🗑️ ${t('delete_user')}`}
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

  // Header
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { width: 60 },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 2,
  },

  content: { flex: 1, padding: 16 },

  // Profile
  profileCard: { marginBottom: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  profileInfo: { flex: 1, marginLeft: 14 },
  profileName: { fontSize: 20, fontWeight: '700' },
  profileEmail: { fontSize: 13, marginTop: 2 },
  activeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  activeLabel: { fontSize: 15, fontWeight: '600' },
  activeDesc: { fontSize: 12, marginTop: 2 },

  // Section
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statItem: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  statIcon: { fontSize: 18, marginBottom: 4 },
  statValue: { fontSize: 14, fontWeight: '700' },
  statLabel: { fontSize: 10, marginTop: 2 },

  // Toggle rows
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  toggleIcon: { fontSize: 22, marginRight: 12 },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  toggleDesc: { fontSize: 12, marginTop: 2 },

  // Language
  languageRow: { flexDirection: 'row', gap: 8 },
  languageOption: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  languageOptionIcon: { fontSize: 22, marginBottom: 4 },
  languageOptionLabel: { fontSize: 13, fontWeight: '700' },

  // Danger
  dangerCard: { marginBottom: 16, borderWidth: 1 },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 6,
  },
  dangerDesc: { fontSize: 13, marginBottom: 14 },
});