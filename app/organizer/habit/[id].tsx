import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import { getHabitStats } from '../../../src/lib/organizerDatabase';
import { Card } from '../../../src/components/Card';

function getHabitEmoji(category: string): string {
  switch (category) {
    case 'water': return '💧';
    case 'food': return '🍽️';
    case 'medicine': return '💊';
    case 'exercise': return '🏃';
    case 'reading': return '📖';
    case 'meditation': return '🧘';
    default: return '🔔';
  }
}

function formatTime12h(timeStr: string): string {
  const [h, m] = (timeStr || '09:00').split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short', day: '2-digit', month: 'short',
    });
  } catch { return dateStr; }
}

export default function HabitHistory() {
  const { id, habitName } = useLocalSearchParams<{
    id: string;
    habitName: string;
  }>();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const habitId = Number(id);

  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    if (!user) return;
    try {
      const data = await getHabitStats(user.id, habitId);
      setStats(data);
    } catch (error) {
      console.error('Habit stats error:', error);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [user, habitId]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (!stats) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.muted }]}>
            {t('loading')}
          </Text>
        </View>
      </View>
    );
  }

  const { habit, times, todayDone, todayTotal, todayPercent, streak, history } = stats;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← {t('back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {getHabitEmoji(habit?.category || 'custom')} {habitName}
          </Text>
          <Text style={styles.headerSub}>{t('habit_history')}</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Card style={[styles.statCard, {
            backgroundColor: todayPercent === 100
              ? isDark ? '#064e3b' : '#ecfdf5'
              : isDark ? '#1e3a5f' : '#eff6ff',
          }]}>
            <Text style={styles.statEmoji}>📊</Text>
            <Text style={[styles.statValue, {
              color: todayPercent === 100 ? '#059669' : theme.colors.primary,
            }]}>
              {todayPercent}%
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.muted }]}>
              {t('todays_progress')}
            </Text>
          </Card>

          <Card style={[styles.statCard, {
            backgroundColor: isDark ? '#451a03' : '#fffbeb',
          }]}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={[styles.statValue, { color: '#d97706' }]}>
              {streak}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.muted }]}>
              {t('streak')} ({t('days_label')})
            </Text>
          </Card>

          <Card style={[styles.statCard, {
            backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
          }]}>
            <Text style={styles.statEmoji}>✅</Text>
            <Text style={[styles.statValue, { color: '#059669' }]}>
              {todayDone}/{todayTotal}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.muted }]}>
              {t('completed_label')}
            </Text>
          </Card>

          <Card style={[styles.statCard, {
            backgroundColor: isDark ? '#2e1065' : '#f3e8ff',
          }]}>
            <Text style={styles.statEmoji}>⏰</Text>
            <Text style={[styles.statValue, { color: '#8b5cf6' }]}>
              {times.length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.muted }]}>
              {t('fixed_times')}
            </Text>
          </Card>
        </View>

        {/* Today's Progress Bar */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            📊 {t('todays_progress')}
          </Text>
          <View style={[styles.bigProgressBar, { backgroundColor: isDark ? '#334155' : '#f3f4f6' }]}>
            <View style={[styles.bigProgressFill, {
              width: `${todayPercent}%`,
              backgroundColor: todayPercent === 100 ? '#059669' : theme.colors.primary,
            }]} />
          </View>
          <Text style={[styles.progressText, { color: theme.colors.muted }]}>
            {todayDone} / {todayTotal} {t('completed_label')}
            {todayPercent === 100 ? ` — ${t('all_done')}` : ''}
          </Text>
        </Card>

        {/* Scheduled Times */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            🕐 {t('fixed_times')}
          </Text>
          <View style={styles.timesGrid}>
            {times.map((timeEntry: any, index: number) => (
              <View
                key={index}
                style={[styles.timeChip, {
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  borderColor: theme.colors.border,
                }]}
              >
                <Text style={[styles.timeChipText, { color: theme.colors.text }]}>
                  ⏰ {formatTime12h(timeEntry.reminder_time)}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[styles.modeInfo, { color: theme.colors.muted }]}>
            {habit?.mode === 'interval'
              ? `⏱️ ${t('mode_interval')} — ${habit.interval_hours}h (${formatTime12h(habit.start_time)} - ${formatTime12h(habit.end_time)})`
              : `🕐 ${t('mode_fixed')}`
            }
          </Text>
        </Card>

        {/* Streak Card */}
        <Card style={[styles.streakCard, {
          backgroundColor: streak > 0
            ? isDark ? '#451a03' : '#fffbeb'
            : isDark ? '#1e293b' : '#f9fafb',
          borderWidth: streak > 0 ? 1 : 0,
          borderColor: '#d97706',
        }]}>
          <View style={styles.streakRow}>
            <Text style={styles.streakFireEmoji}>🔥</Text>
            <View>
              <Text style={[styles.streakValue, {
                color: streak > 0 ? '#d97706' : theme.colors.muted,
              }]}>
                {streak} {t('days_label')}
              </Text>
              <Text style={[styles.streakLabel, { color: theme.colors.muted }]}>
                {streak > 0 ? `${t('streak')} — Keep it going!` : `${t('streak')} — Start today!`}
              </Text>
            </View>
          </View>
        </Card>

        {/* 30 Days History Calendar */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            📅 {t('habit_history')}
          </Text>

          {history.length === 0 ? (
            <Text style={[styles.empty, { color: theme.colors.muted }]}>
              {t('no_data')}
            </Text>
          ) : (
            history.map((day: any) => {
              const percent = day.total_count > 0
                ? Math.round((day.done_count / day.total_count) * 100)
                : 0;
              const isFullDone = percent === 100;
              const isPartial = percent > 0 && percent < 100;
              const today = day.log_date === new Date().toISOString().split('T')[0];

              return (
                <View
                  key={day.log_date}
                  style={[styles.historyRow, {
                    borderBottomColor: theme.colors.border,
                    backgroundColor: today
                      ? isDark ? '#1e3a5f' : '#eff6ff'
                      : 'transparent',
                  }]}
                >
                  {/* Date */}
                  <View style={styles.historyDateCol}>
                    <Text style={[styles.historyDate, { color: theme.colors.text }]}>
                      {formatDateDisplay(day.log_date)}
                    </Text>
                    {today && (
                      <View style={[styles.todayBadge, { backgroundColor: theme.colors.primary }]}>
                        <Text style={styles.todayBadgeText}>{t('today')}</Text>
                      </View>
                    )}
                  </View>

                  {/* Progress */}
                  <View style={styles.historyProgressCol}>
                    <View style={[styles.historyProgressBar, { backgroundColor: isDark ? '#334155' : '#f3f4f6' }]}>
                      <View style={[styles.historyProgressFill, {
                        width: `${percent}%`,
                        backgroundColor: isFullDone ? '#059669' : isPartial ? '#d97706' : '#dc2626',
                      }]} />
                    </View>
                  </View>

                  {/* Count */}
                  <View style={styles.historyCountCol}>
                    <Text style={[styles.historyCount, {
                      color: isFullDone ? '#059669' : isPartial ? '#d97706' : '#dc2626',
                    }]}>
                      {isFullDone ? '✅' : isPartial ? '⚠️' : '❌'} {day.done_count}/{day.total_count}
                    </Text>
                    <Text style={[styles.historyPercent, { color: theme.colors.muted }]}>
                      {percent}%
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16 },

  // Header
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 60 },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 },
  statCard: { width: '47%', padding: 14, alignItems: 'center' },
  statEmoji: { fontSize: 22, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, marginTop: 2, textAlign: 'center' },

  // Section
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 14 },
  empty: { textAlign: 'center', paddingVertical: 20 },

  // Progress bar
  bigProgressBar: { height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 8 },
  bigProgressFill: { height: '100%', borderRadius: 6 },
  progressText: { fontSize: 13, textAlign: 'center' },

  // Times grid
  timesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  timeChipText: { fontSize: 13, fontWeight: '600' },
  modeInfo: { fontSize: 12, textAlign: 'center', marginTop: 4 },

  // Streak
  streakCard: { marginHorizontal: 16, marginBottom: 16, padding: 18 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  streakFireEmoji: { fontSize: 40 },
  streakValue: { fontSize: 28, fontWeight: '900' },
  streakLabel: { fontSize: 13, marginTop: 2 },

  // History
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderRadius: 6 },
  historyDateCol: { width: 90 },
  historyDate: { fontSize: 13, fontWeight: '500' },
  todayBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginTop: 2, alignSelf: 'flex-start' },
  todayBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  historyProgressCol: { flex: 1, marginHorizontal: 10 },
  historyProgressBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  historyProgressFill: { height: '100%', borderRadius: 4 },
  historyCountCol: { width: 70, alignItems: 'flex-end' },
  historyCount: { fontSize: 12, fontWeight: '700' },
  historyPercent: { fontSize: 10, marginTop: 2 },
});