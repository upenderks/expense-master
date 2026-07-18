import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import {
  getServiceMonthlySummary,
  toggleServiceAbsence,
} from '../../../src/lib/organizerDatabase';
import { Card } from '../../../src/components/Card';

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getCategoryEmoji(category: string): string {
  switch (category) {
    case 'maid': return '🧹';
    case 'newspaper': return '📰';
    case 'milkman': return '🥛';
    case 'laundry': return '👔';
    case 'cook': return '👨‍🍳';
    case 'driver': return '🚗';
    case 'gardener': return '🌱';
    default: return '📋';
  }
}

export default function ServiceCalendar() {
  const { id, serviceName } = useLocalSearchParams<{
    id: string;
    serviceName: string;
  }>();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const serviceId = Number(id);

  const [summary, setSummary] = useState<any>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const loadData = async () => {
    if (!user) return;
    try {
      const data = await getServiceMonthlySummary(user.id, serviceId, currentMonth);
      setSummary(data);
    } catch (error) {
      console.error('Service calendar error:', error);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [user, serviceId, currentMonth]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Month navigation ──────────────────────────────────────────────

  const goToPrevMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    setCurrentMonth(
      `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
    );
  };

  const goToNextMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const next = new Date(y, m, 1);
    setCurrentMonth(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
    );
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    setCurrentMonth(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    );
  };

  // ── Toggle absence ─────────────────────────────────────────────────

  const handleToggleAbsence = async (date: string) => {
    if (toggling) return;
    setToggling(true);
    try {
      await toggleServiceAbsence(user!.id, serviceId, date);
      await loadData();
    } catch (error) {
      Alert.alert(t('error'), (error as Error).message);
    } finally {
      setToggling(false);
    }
  };

  // ── Calendar generation ────────────────────────────────────────────

  const generateCalendarDays = () => {
    if (!summary) return [];

    const [year, month] = currentMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0=Sun

    const absentDates = new Set(
      (summary.absences || []).map((a: any) => a.absent_date)
    );

    const workingDaysArr = (summary.service?.working_days || '')
      .split(',')
      .map((d: string) => d.trim().toLowerCase());
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    const isWorkingDay = (dayOfWeek: number): boolean => {
      if (workingDaysArr.includes('all')) return true;
      return workingDaysArr.includes(dayNames[dayOfWeek]);
    };

    const today = new Date().toISOString().split('T')[0];

    const days: any[] = [];

    // Empty cells for days before start of month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ empty: true });
    }

    // Actual days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = dateObj.getDay();
      const isWorking = isWorkingDay(dayOfWeek);
      const isAbsent = absentDates.has(dateStr);
      const isToday = dateStr === today;
      const isFuture = dateStr > today;

      days.push({
        day,
        dateStr,
        isWorking,
        isAbsent,
        isToday,
        isFuture,
        empty: false,
      });
    }

    return days;
  };

  // ── Formatting ─────────────────────────────────────────────────────

  const formatCurrency = (amount: number) =>
    '₹' + Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const [year, month] = currentMonth.split('-').map(Number);
  const monthName = MONTH_NAMES[month - 1];
  const calendarDays = generateCalendarDays();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← {t('back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {getCategoryEmoji(summary?.service?.category || 'other')} {serviceName}
          </Text>
          <Text style={styles.headerSub}>{t('view_calendar')}</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {/* Service Info */}
        {summary?.service && (
          <Card style={styles.serviceInfoCard}>
            <View style={styles.serviceInfoRow}>
              <View>
                <Text style={[styles.serviceInfoName, { color: theme.colors.text }]}>
                  {getCategoryEmoji(summary.service.category)} {summary.service.name}
                </Text>
                <Text style={[styles.serviceInfoRate, { color: theme.colors.muted }]}>
                  {formatCurrency(summary.service.monthly_rate)}/{t('month')}
                  {summary.service.per_visit_rate > 0
                    ? ` • ${formatCurrency(summary.service.per_visit_rate)}/visit`
                    : ''}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Month Navigator */}
        <View style={[styles.monthNav, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <TouchableOpacity onPress={goToPrevMonth} style={styles.monthNavBtn}>
            <Text style={[styles.monthNavBtnText, { color: theme.colors.primary }]}>◀</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={goToCurrentMonth}>
            <Text style={[styles.monthNavTitle, { color: theme.colors.text }]}>
              {monthName} {year}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={goToNextMonth} style={styles.monthNavBtn}>
            <Text style={[styles.monthNavBtnText, { color: theme.colors.primary }]}>▶</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar Grid */}
        <Card style={styles.calendarCard}>
          {/* Day Headers */}
          <View style={styles.calendarRow}>
            {DAY_NAMES_SHORT.map((day) => (
              <View key={day} style={styles.calendarHeaderCell}>
                <Text style={[styles.calendarHeaderText, { color: theme.colors.muted }]}>
                  {day}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar Days */}
          <View style={styles.calendarGrid}>
            {calendarDays.map((dayInfo, index) => {
              if (dayInfo.empty) {
                return <View key={`empty-${index}`} style={styles.calendarCell} />;
              }

              const { day, dateStr, isWorking, isAbsent, isToday, isFuture } = dayInfo;

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.calendarCell,
                    isToday && [styles.calendarCellToday, { borderColor: theme.colors.primary }],
                    isAbsent && styles.calendarCellAbsent,
                    !isWorking && styles.calendarCellOff,
                  ]}
                  onPress={() => {
                    if (isWorking && !isFuture) {
                      handleToggleAbsence(dateStr);
                    }
                  }}
                  disabled={!isWorking || isFuture || toggling}
                  activeOpacity={0.6}
                >
                  <Text style={[
                    styles.calendarDayText,
                    { color: theme.colors.text },
                    !isWorking && { color: theme.colors.muted },
                    isAbsent && styles.calendarDayAbsent,
                    isToday && { color: theme.colors.primary, fontWeight: '800' },
                    isFuture && { opacity: 0.4 },
                  ]}>
                    {day}
                  </Text>
                  {isAbsent && (
                    <Text style={styles.absentMark}>❌</Text>
                  )}
                  {!isWorking && (
                    <Text style={styles.offMark}>—</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#059669' }]} />
              <Text style={[styles.legendText, { color: theme.colors.muted }]}>
                {t('present_days')}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={styles.legendEmoji}>❌</Text>
              <Text style={[styles.legendText, { color: theme.colors.muted }]}>
                {t('absent_days')}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={[styles.legendDash, { color: theme.colors.muted }]}>—</Text>
              <Text style={[styles.legendText, { color: theme.colors.muted }]}>Off Day</Text>
            </View>
          </View>

          {/* Hint */}
          <Text style={[styles.calendarHint, { color: theme.colors.muted }]}>
            💡 {t('mark_absent')}
          </Text>
        </Card>

        {/* Monthly Summary */}
        {summary && (
          <Card style={styles.summaryCard}>
            <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>
              📊 {monthName} {year} Summary
            </Text>

            <View style={styles.summaryGrid}>
              <View style={[styles.summaryItem, { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }]}>
                <Text style={styles.summaryItemEmoji}>📅</Text>
                <Text style={[styles.summaryItemValue, { color: theme.colors.text }]}>
                  {summary.totalWorkingDays}
                </Text>
                <Text style={[styles.summaryItemLabel, { color: theme.colors.muted }]}>
                  {t('working_days_total')}
                </Text>
              </View>

              <View style={[styles.summaryItem, { backgroundColor: isDark ? '#064e3b' : '#ecfdf5' }]}>
                <Text style={styles.summaryItemEmoji}>✅</Text>
                <Text style={[styles.summaryItemValue, { color: '#059669' }]}>
                  {summary.presentDays}
                </Text>
                <Text style={[styles.summaryItemLabel, { color: theme.colors.muted }]}>
                  {t('present_days')}
                </Text>
              </View>

              <View style={[styles.summaryItem, { backgroundColor: isDark ? '#450a0a' : '#fef2f2' }]}>
                <Text style={styles.summaryItemEmoji}>❌</Text>
                <Text style={[styles.summaryItemValue, { color: '#dc2626' }]}>
                  {summary.absentDays}
                </Text>
                <Text style={[styles.summaryItemLabel, { color: theme.colors.muted }]}>
                  {t('absent_days')}
                </Text>
              </View>
            </View>

            {/* Payment Calculation */}
            <View style={[styles.paymentSection, { borderTopColor: theme.colors.border }]}>
              <View style={styles.paymentRow}>
                <Text style={[styles.paymentLabel, { color: theme.colors.muted }]}>
                  {t('monthly_rate_label')}
                </Text>
                <Text style={[styles.paymentValue, { color: theme.colors.text }]}>
                  {formatCurrency(summary.monthlyRate)}
                </Text>
              </View>

              <View style={styles.paymentRow}>
                <Text style={[styles.paymentLabel, { color: theme.colors.muted }]}>
                  {t('per_visit_rate_label')}
                </Text>
                <Text style={[styles.paymentValue, { color: theme.colors.text }]}>
                  {formatCurrency(summary.perDayRate)}
                </Text>
              </View>

              <View style={styles.paymentRow}>
                <Text style={[styles.paymentLabel, { color: '#dc2626' }]}>
                  {t('deduction_label')} ({summary.absentDays} × {formatCurrency(summary.perDayRate)})
                </Text>
                <Text style={[styles.paymentValue, { color: '#dc2626' }]}>
                  - {formatCurrency(summary.deduction)}
                </Text>
              </View>

              <View style={[styles.paymentRow, styles.paymentRowTotal, { borderTopColor: theme.colors.border }]}>
                <Text style={[styles.paymentTotalLabel, { color: theme.colors.text }]}>
                  💰 {t('payable_label')}
                </Text>
                <Text style={[styles.paymentTotalValue, { color: '#059669' }]}>
                  {formatCurrency(summary.payable)}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Absence List */}
        {summary && summary.absences.length > 0 && (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              ❌ {t('absent_days')} ({summary.absences.length})
            </Text>
            {summary.absences.map((abs: any) => (
              <View
                key={abs.absent_date}
                style={[styles.absenceRow, { borderBottomColor: theme.colors.border }]}
              >
                <Text style={[styles.absenceDate, { color: theme.colors.text }]}>
                  📅 {new Date(abs.absent_date).toLocaleDateString('en-IN', {
                    weekday: 'short', day: '2-digit', month: 'short',
                  })}
                </Text>
                {abs.reason && (
                  <Text style={[styles.absenceReason, { color: theme.colors.muted }]}>
                    {abs.reason}
                  </Text>
                )}
                <TouchableOpacity
                  onPress={() => handleToggleAbsence(abs.absent_date)}
                  style={[styles.removeAbsenceBtn, { backgroundColor: isDark ? '#064e3b' : '#ecfdf5' }]}
                >
                  <Text style={styles.removeAbsenceBtnText}>✅ Mark Present</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 60 },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },

  // Service info
  serviceInfoCard: { margin: 16, marginBottom: 8 },
  serviceInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  serviceInfoName: { fontSize: 18, fontWeight: '700' },
  serviceInfoRate: { fontSize: 13, marginTop: 4 },

  // Month navigator
  monthNav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, padding: 12,
  },
  monthNavBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  monthNavBtnText: { fontSize: 18, fontWeight: '700' },
  monthNavTitle: { fontSize: 18, fontWeight: '700' },

  // Calendar
  calendarCard: { marginHorizontal: 16, marginBottom: 16, padding: 12 },
  calendarRow: { flexDirection: 'row' },
  calendarHeaderCell: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  calendarHeaderText: { fontSize: 12, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: {
    width: '14.28%', aspectRatio: 1, justifyContent: 'center',
    alignItems: 'center', position: 'relative',
  },
  calendarCellToday: { borderWidth: 2, borderRadius: 8 },
  calendarCellAbsent: { backgroundColor: 'rgba(220, 38, 38, 0.1)', borderRadius: 8 },
  calendarCellOff: { opacity: 0.3 },
  calendarDayText: { fontSize: 14, fontWeight: '500' },
  calendarDayAbsent: { color: '#dc2626' },
  absentMark: { position: 'absolute', bottom: 2, fontSize: 8 },
  offMark: { position: 'absolute', bottom: 4, fontSize: 10 },

  // Legend
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendEmoji: { fontSize: 10 },
  legendDash: { fontSize: 14, fontWeight: '700' },
  legendText: { fontSize: 11 },
  calendarHint: { textAlign: 'center', fontSize: 11, marginTop: 10 },

  // Summary
  summaryCard: { marginHorizontal: 16, marginBottom: 16 },
  summaryTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  summaryGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12 },
  summaryItemEmoji: { fontSize: 18, marginBottom: 4 },
  summaryItemValue: { fontSize: 22, fontWeight: '800' },
  summaryItemLabel: { fontSize: 10, marginTop: 2 },

  // Payment
  paymentSection: { borderTopWidth: 1, paddingTop: 14 },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  paymentLabel: { fontSize: 13 },
  paymentValue: { fontSize: 14, fontWeight: '600' },
  paymentRowTotal: { borderTopWidth: 1, paddingTop: 12, marginTop: 4, marginBottom: 0 },
  paymentTotalLabel: { fontSize: 16, fontWeight: '700' },
  paymentTotalValue: { fontSize: 22, fontWeight: '800' },

  // Section
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 14 },

  // Absence list
  absenceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 8 },
  absenceDate: { fontSize: 14, fontWeight: '500', flex: 1 },
  absenceReason: { fontSize: 12 },
  removeAbsenceBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  removeAbsenceBtnText: { fontSize: 11, fontWeight: '600', color: '#059669' },
});