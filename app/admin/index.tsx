import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import {
  getAllUsers,
  getUserStats,
  changeAdminPassword,
} from '../../src/lib/database';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';

export default function AdminPanel() {
  const { adminId, adminName } = useLocalSearchParams<{
    adminId: string;
    adminName: string;
  }>();
  const { theme, isDark } = useTheme();

  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<number, any>>({});

  // Password change
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);

  const loadData = async () => {
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);

      // Load stats for each user
      const statsMap: Record<number, any> = {};
      for (const u of allUsers) {
        if (!u.is_admin) {
          statsMap[u.id] = await getUserStats(u.id);
        }
      }
      setStats(statsMap);
    } catch (error) {
      console.error('Admin load error:', error);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const formatCurrency = (amount: number) =>
    '₹' + Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) {
      Alert.alert('Error', 'Please fill all password fields');
      return;
    }
    if (newPwd !== confirmPwd) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    if (newPwd.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setChangingPwd(true);
    try {
      await changeAdminPassword(Number(adminId), currentPwd, newPwd);
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      Alert.alert('✅ Success', 'Admin password changed successfully');
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setChangingPwd(false);
    }
  };

  const normalUsers = users.filter((u) => !u.is_admin);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>🔐 Admin Panel</Text>
          <Text style={styles.headerSubtitle}>Welcome, {adminName}</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Overview Stats */}
        <Card style={styles.overviewCard}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            📊 System Overview
          </Text>
          <View style={styles.overviewGrid}>
            <View style={[styles.overviewItem, { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }]}>
              <Text style={styles.overviewEmoji}>👥</Text>
              <Text style={[styles.overviewValue, { color: theme.colors.text }]}>{normalUsers.length}</Text>
              <Text style={[styles.overviewLabel, { color: theme.colors.muted }]}>Users</Text>
            </View>
            <View style={[styles.overviewItem, { backgroundColor: isDark ? '#064e3b' : '#ecfdf5' }]}>
              <Text style={styles.overviewEmoji}>✅</Text>
              <Text style={[styles.overviewValue, { color: theme.colors.text }]}>{normalUsers.filter(u => u.is_active).length}</Text>
              <Text style={[styles.overviewLabel, { color: theme.colors.muted }]}>Active</Text>
            </View>
            <View style={[styles.overviewItem, { backgroundColor: isDark ? '#450a0a' : '#fef2f2' }]}>
              <Text style={styles.overviewEmoji}>🚫</Text>
              <Text style={[styles.overviewValue, { color: theme.colors.text }]}>{normalUsers.filter(u => !u.is_active).length}</Text>
              <Text style={[styles.overviewLabel, { color: theme.colors.muted }]}>Inactive</Text>
            </View>
          </View>
        </Card>

        {/* Users List */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            👥 Manage Users
          </Text>
          {normalUsers.length === 0 ? (
            <Text style={[styles.empty, { color: theme.colors.muted }]}>
              No users registered yet
            </Text>
          ) : (
            normalUsers.map((u) => {
              const userStats = stats[u.id];
              return (
                <TouchableOpacity
                  key={u.id}
                  style={[
                    styles.userRow,
                    { borderBottomColor: theme.colors.border },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: '/admin/user-settings/[id]',
                      params: {
                        id: u.id,
                        userName: u.name,
                        userEmail: u.email,
                        isActive: u.is_active ? '1' : '0',
                        adminId: adminId,
                      },
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.userAvatar,
                    {
                      backgroundColor: u.is_active
                        ? theme.colors.primary
                        : theme.colors.muted,
                    },
                  ]}>
                    <Text style={styles.userAvatarText}>
                      {u.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <View style={styles.userNameRow}>
                      <Text style={[styles.userName, { color: theme.colors.text }]}>
                        {u.name}
                      </Text>
                      <View style={[
                        styles.statusBadge,
                        {
                          backgroundColor: u.is_active
                            ? isDark ? '#064e3b' : '#ecfdf5'
                            : isDark ? '#450a0a' : '#fef2f2',
                        },
                      ]}>
                        <Text style={[
                          styles.statusText,
                          { color: u.is_active ? '#059669' : '#dc2626' },
                        ]}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.userEmail, { color: theme.colors.muted }]}>
                      {u.email}
                    </Text>
                    {userStats && (
                      <Text style={[styles.userStats, { color: theme.colors.muted }]}>
                        {userStats.expenseCount} expenses • {userStats.borrowerCount} borrowers
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.chevron, { color: theme.colors.muted }]}>›</Text>
                </TouchableOpacity>
              );
            })
          )}
        </Card>

        {/* Change Admin Password */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            🔑 Change Admin Password
          </Text>
          <Input
            label="Current Password"
            value={currentPwd}
            onChangeText={setCurrentPwd}
            placeholder="••••••••"
            secureTextEntry
          />
          <Input
            label="New Password"
            value={newPwd}
            onChangeText={setNewPwd}
            placeholder="••••••••"
            secureTextEntry
          />
          <Input
            label="Confirm New Password"
            value={confirmPwd}
            onChangeText={setConfirmPwd}
            placeholder="••••••••"
            secureTextEntry
          />
          <Button
            title="🔑 Change Password"
            onPress={handleChangePassword}
            loading={changingPwd}
          />
        </Card>

        {/* Exit */}
        <Card style={styles.section}>
          <Button
            title="← Exit Admin Panel"
            variant="secondary"
            onPress={() => router.back()}
          />
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  content: { flex: 1, padding: 16 },

  // Overview
  overviewCard: { marginBottom: 16 },
  overviewGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  overviewItem: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12 },
  overviewEmoji: { fontSize: 22, marginBottom: 4 },
  overviewValue: { fontSize: 22, fontWeight: '800' },
  overviewLabel: { fontSize: 11, marginTop: 2 },

  // Section
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  empty: { textAlign: 'center', paddingVertical: 20 },

  // User rows
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  userAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  userInfo: { flex: 1, marginLeft: 12 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 15, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '700' },
  userEmail: { fontSize: 12, marginTop: 2 },
  userStats: { fontSize: 11, marginTop: 3 },
  chevron: { fontSize: 24, fontWeight: '300' },
});