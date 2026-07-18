import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import {
  getRefillItemStats,
  createRefillLog,
  deleteRefillLog,
} from '../../../src/lib/organizerDatabase';
import { Card } from '../../../src/components/Card';
import { Button } from '../../../src/components/Button';
import { Input } from '../../../src/components/Input';
import DatePicker from '../../../src/components/DatePicker';

function getCategoryEmoji(category: string): string {
  switch (category) {
    case 'gas': return '🔥';
    case 'water': return '💧';
    case 'filter': return '🚰';
    default: return '📦';
  }
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return dateStr; }
}

export default function RefillHistory() {
  const { id, itemName } = useLocalSearchParams<{
    id: string;
    itemName: string;
  }>();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const itemId = Number(id);

  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Log form
  const [logModal, setLogModal] = useState(false);
  const [logForm, setLogForm] = useState({
    refillDate: new Date().toISOString().split('T')[0],
    amount: '',
    notes: '',
  });
  const [logSaving, setLogSaving] = useState(false);

  const loadData = async () => {
    if (!user) return;
    try {
      const data = await getRefillItemStats(user.id, itemId);
      setStats(data);
      // Auto fill default price
      if (data?.item?.default_price) {
        setLogForm((prev) => ({
          ...prev,
          amount: prev.amount || String(data.item.default_price),
        }));
      }
    } catch (error) {
      console.error('Refill history error:', error);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [user, itemId]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAddLog = async () => {
    if (!logForm.amount || Number(logForm.amount) <= 0) {
      Alert.alert(t('error'), t('payment_invalid'));
      return;
    }
    setLogSaving(true);
    try {
      await createRefillLog(
        user!.id, itemId, logForm.refillDate,
        Number(logForm.amount), logForm.notes
      );
      setLogModal(false);
      setLogForm({
        refillDate: new Date().toISOString().split('T')[0],
        amount: stats?.item?.default_price ? String(stats.item.default_price) : '',
        notes: '',
      });
      await loadData();
    } catch (error) {
      Alert.alert(t('error'), (error as Error).message);
    } finally {
      setLogSaving(false);
    }
  };

  const handleDeleteLog = (logId: number) => {
    Alert.alert(t('delete'), t('are_you_sure'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          await deleteRefillLog(logId, user!.id);
          await loadData();
        },
      },
    ]);
  };

  const formatCurrency = (amount: number) =>
    '₹' + Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← {t('back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {getCategoryEmoji(stats?.item?.category || 'other')} {itemName}
          </Text>
          <Text style={styles.headerSub}>{t('refill_history')}</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {/* Stats Cards */}
        {stats && (
          <View style={styles.statsGrid}>
            {[
              {
                emoji: '🔄', label: t('total_refills'),
                value: String(stats.totalRefills),
                color: theme.colors.primary,
                bg: isDark ? '#1e3a5f' : '#eff6ff',
              },
              {
                emoji: '💰', label: t('total_spent_label'),
                value: formatCurrency(stats.totalSpent),
                color: '#059669',
                bg: isDark ? '#064e3b' : '#ecfdf5',
              },
              {
                emoji: '📅', label: t('avg_days_between'),
                value: stats.avgDaysBetweenRefills > 0
                  ? `${stats.avgDaysBetweenRefills}d`
                  : '-',
                color: '#8b5cf6',
                bg: isDark ? '#2e1065' : '#f3e8ff',
              },
              {
                emoji: '🕐', label: t('last_refill'),
                value: stats.lastRefillDate
                  ? formatDateDisplay(stats.lastRefillDate).split(',')[0]
                  : '-',
                color: '#d97706',
                bg: isDark ? '#451a03' : '#fffbeb',
              },
            ].map((item, i) => (
              <Card key={i} style={[styles.statCard, { backgroundColor: item.bg }]}>
                <Text style={styles.statEmoji}>{item.emoji}</Text>
                <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.muted }]}>{item.label}</Text>
              </Card>
            ))}
          </View>
        )}

        {/* Add Refill Button */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Button
            title={`+ ${t('log_refill')}`}
            variant="success"
            onPress={() => setLogModal(true)}
          />
        </View>

        {/* Refill Log History */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            📋 {t('refill_history')} ({stats?.totalRefills || 0})
          </Text>

          {!stats || stats.logs.length === 0 ? (
            <Text style={[styles.empty, { color: theme.colors.muted }]}>
              {t('no_refills_yet')}
            </Text>
          ) : (
            stats.logs.map((log: any, index: number) => {
              // Calculate days since previous refill
              let daysSincePrev = null;
              if (index < stats.logs.length - 1) {
                const current = new Date(log.refill_date).getTime();
                const prev = new Date(stats.logs[index + 1].refill_date).getTime();
                daysSincePrev = Math.round((current - prev) / (1000 * 60 * 60 * 24));
              }

              return (
                <View
                  key={log.id}
                  style={[styles.logRow, { borderBottomColor: theme.colors.border }]}
                >
                  <View style={[
                    styles.logIcon,
                    { backgroundColor: isDark ? '#064e3b' : '#ecfdf5' },
                  ]}>
                    <Text style={styles.logIconText}>
                      {getCategoryEmoji(stats.item.category)}
                    </Text>
                  </View>

                  <View style={styles.logInfo}>
                    <Text style={[styles.logDate, { color: theme.colors.text }]}>
                      📅 {formatDateDisplay(log.refill_date)}
                    </Text>
                    {daysSincePrev !== null && (
                      <Text style={[styles.logDays, { color: theme.colors.muted }]}>
                        {daysSincePrev} days since previous
                      </Text>
                    )}
                    {log.notes && (
                      <Text style={[styles.logNotes, { color: theme.colors.muted }]}>
                        📝 {log.notes}
                      </Text>
                    )}
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.logAmount, { color: '#059669' }]}>
                      {formatCurrency(log.amount)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleDeleteLog(log.id)}
                      style={{ marginTop: 4 }}
                    >
                      <Text style={styles.deleteBtn}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Log Refill Modal ───────────────────────────────────────── */}
      <Modal visible={logModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.modalBg }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              🔄 {t('log_refill')}
            </Text>
            <DatePicker
              label={t('refill_date_label')}
              value={logForm.refillDate}
              onChange={(d) => setLogForm({ ...logForm, refillDate: d })}
            />
            <Input
              label={`${t('refill_amount_label')} *`}
              value={logForm.amount}
              onChangeText={(v) => setLogForm({ ...logForm, amount: v })}
              placeholder="0"
              keyboardType="numeric"
            />
            <Input
              label={t('notes')}
              value={logForm.notes}
              onChangeText={(v) => setLogForm({ ...logForm, notes: v })}
              placeholder={t('optional')}
            />
            <View style={styles.modalButtons}>
              <Button
                title={t('cancel')}
                variant="secondary"
                onPress={() => setLogModal(false)}
              />
              <Button
                title={t('save')}
                variant="success"
                onPress={handleAddLog}
                loading={logSaving}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: { width: 60 },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },

  // Stats
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 12, padding: 16,
  },
  statCard: { width: '47%', padding: 14, alignItems: 'center' },
  statEmoji: { fontSize: 20, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10, marginTop: 2, textAlign: 'center' },

  // Section
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 14 },
  empty: { textAlign: 'center', paddingVertical: 20 },

  // Log rows
  logRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1,
  },
  logIcon: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  logIconText: { fontSize: 18 },
  logInfo: { flex: 1 },
  logDate: { fontSize: 14, fontWeight: '600' },
  logDays: { fontSize: 11, marginTop: 2 },
  logNotes: { fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  logAmount: { fontSize: 18, fontWeight: '800' },
  deleteBtn: { fontSize: 16, padding: 2 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '90%',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
});