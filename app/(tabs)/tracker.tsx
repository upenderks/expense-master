import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import {
  getAssets,
  getAssetCustomers,
  getTimeLogs,
  createTimeLog,
  updateTimeLog,
  deleteTimeLog,
  createAsset,
  updateAsset,
  deleteAsset,
  createAssetCustomer,
  updateAssetCustomer,
  deleteAssetCustomer,
  getAssetDashboardData,
} from '../../src/lib/database';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Select } from '../../src/components/Select';
import { EmptyState } from '../../src/components/EmptyState';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { StatPill } from '../../src/components/StatPill';
import { formatCurrency, formatCompactCurrency } from '../../src/lib/formatters';

type Tab = 'dashboard' | 'logs' | 'customers' | 'assets';

// ── Filter Types ──────────────────────────────────────────────────────────────
type FilterState = {
  fromDate:   Date | null;
  toDate:     Date | null;
  customerId: number | string | null;
  assetId:    number | string | null;
};

type FilterPickerField =
  | 'startDate'
  | 'startTime'
  | 'endDate'
  | 'endTime'
  | 'filterFromDate'
  | 'filterToDate';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAssetEmoji(type: string): string {
  switch (type) {
    case 'tractor':   return '🚜';
    case 'vehicle':   return '🚛';
    case 'machine':   return '⚙️';
    case 'equipment': return '🔧';
    default:          return '📦';
  }
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m';
  const hrs  = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs === 0)  return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return dateStr; }
}

function formatDateOnly(dateStr: string | Date): string {
  if (!dateStr) return '';
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return String(dateStr); }
}

function formatTimeOnly(dateStr: string | Date): string {
  if (!dateStr) return '';
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return String(dateStr); }
}

function calcDurationMinutes(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime();
  if (diff <= 0) return 0;
  return diff / (1000 * 60);
}

function buildDateTime(dateObj: Date, timeObj: Date): Date {
  const result = new Date(dateObj);
  result.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Tracker() {
  const { user }          = useAuth();
  const { theme, isDark } = useTheme();
  const { t }             = useLanguage();

  const [activeTab, setActiveTab]         = useState<Tab>('dashboard');
  const [assets, setAssets]               = useState<any[]>([]);
  const [customers, setCustomers]         = useState<any[]>([]);
  const [timeLogs, setTimeLogs]           = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [refreshing, setRefreshing]       = useState(false);

  // ── Filter State ────────────────────────────────────────────────────────────
  const [filterModal, setFilterModal] = useState(false);
  const [filters, setFilters]         = useState<FilterState>({
    fromDate: null, toDate: null, customerId: null, assetId: null,
  });
  const [tempFilters, setTempFilters] = useState<FilterState>({
    fromDate: null, toDate: null, customerId: null, assetId: null,
  });

  // Active filter count badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.fromDate || filters.toDate) count += 1;
    if (filters.customerId)                 count += 1;
    if (filters.assetId)                    count += 1;
    return count;
  }, [filters]);

  // ── Log form ────────────────────────────────────────────────────────────────
  const [logModal, setLogModal]     = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [logForm, setLogForm]       = useState({
    assetId:    '' as number | string,
    customerId: '' as number | string,
    startDate:  new Date(),
    startTime:  new Date(),
    hasEndTime: false,
    endDate:    new Date(),
    endTime:    new Date(),
    hourlyRate: '',
    notes:      '',
  });
  const [logSaving, setLogSaving] = useState(false);

  // ── Picker ──────────────────────────────────────────────────────────────────
  const [showPicker, setShowPicker] = useState<FilterPickerField | null>(null);

  // ── Asset form ──────────────────────────────────────────────────────────────
  const [assetModal, setAssetModal]     = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [assetForm, setAssetForm]       = useState({
    name: '', assetType: 'vehicle', hourlyRate: '', description: '', isActive: true,
  });
  const [assetSaving, setAssetSaving] = useState(false);

  // ── Customer form ───────────────────────────────────────────────────────────
  const [customerModal, setCustomerModal]     = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [customerForm, setCustomerForm]       = useState({
    name: '', phone: '', address: '', notes: '',
  });
  const [customerSaving, setCustomerSaving] = useState(false);

  // ── Load data ───────────────────────────────────────────────────────────────

  const loadData = async () => {
    if (!user) return;
    try {
      const [a, c, tl, dash] = await Promise.all([
        getAssets(user.id),
        getAssetCustomers(user.id),
        getTimeLogs(user.id),
        getAssetDashboardData(user.id),
      ]);
      setAssets(a);
      setCustomers(c);
      setTimeLogs(tl);
      setDashboardData(dash);
    } catch (error) {
      console.error('Tracker load error:', error);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [user]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Filter Logic ────────────────────────────────────────────────────────────

  const filteredTimeLogs = useMemo(() => {
    return timeLogs.filter((log) => {

      // Filter by Date Range
      if (filters.fromDate || filters.toDate) {
        const logDate = new Date(log.start_time);
        if (filters.fromDate) {
          const from = new Date(filters.fromDate);
          from.setHours(0, 0, 0, 0);
          if (logDate < from) return false;
        }
        if (filters.toDate) {
          const to = new Date(filters.toDate);
          to.setHours(23, 59, 59, 999);
          if (logDate > to) return false;
        }
      }

      // Filter by Customer
      if (filters.customerId) {
        if (Number(log.customer_id) !== Number(filters.customerId)) return false;
      }

      // Filter by Asset
      if (filters.assetId) {
        if (Number(log.asset_id) !== Number(filters.assetId)) return false;
      }

      return true;
    });
  }, [timeLogs, filters]);

  // ── FIX: Robust isInProgress check ─────────────────────────────────────────
  // A log is "In Progress" when:
  //   - status is explicitly 'running', OR
  //   - end_time is null/empty (covers old records with wrong DB default)
  const isInProgress = (log: any): boolean =>
    log.status === 'running' ||
    !log.end_time            ||
    log.end_time === '';

  const inProgressLogs = filteredTimeLogs.filter(isInProgress);
  const completedLogs  = filteredTimeLogs.filter((l) => !isInProgress(l));

  // Unfiltered counts for dashboard (show full data, not filtered)
  const allInProgress = timeLogs.filter(isInProgress);

  // Filtered summary stats shown in the summary bar
  const filteredTotalAmount = useMemo(
    () => completedLogs.reduce((sum, l) => sum + (l.total_amount || 0), 0),
    [completedLogs],
  );
  const filteredTotalDuration = useMemo(
    () => completedLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0),
    [completedLogs],
  );

  // ── Picker handlers ─────────────────────────────────────────────────────────

  const handlePickerChange = (_: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowPicker(null);
    if (!selectedDate) return;
    switch (showPicker) {
      case 'startDate':      setLogForm((f) => ({ ...f, startDate: selectedDate })); break;
      case 'startTime':      setLogForm((f) => ({ ...f, startTime: selectedDate })); break;
      case 'endDate':        setLogForm((f) => ({ ...f, endDate:   selectedDate })); break;
      case 'endTime':        setLogForm((f) => ({ ...f, endTime:   selectedDate })); break;
      case 'filterFromDate': setTempFilters((f) => ({ ...f, fromDate: selectedDate })); break;
      case 'filterToDate':   setTempFilters((f) => ({ ...f, toDate:   selectedDate })); break;
    }
  };

  const handlePickerDone = () => setShowPicker(null);

  const getPickerValue = (): Date => {
    switch (showPicker) {
      case 'startDate':      return logForm.startDate;
      case 'startTime':      return logForm.startTime;
      case 'endDate':        return logForm.endDate;
      case 'endTime':        return logForm.endTime;
      case 'filterFromDate': return tempFilters.fromDate ?? new Date();
      case 'filterToDate':   return tempFilters.toDate   ?? new Date();
      default:               return new Date();
    }
  };

  const getPickerMode = (): 'date' | 'time' =>
    showPicker === 'startTime' || showPicker === 'endTime' ? 'time' : 'date';

  const getPickerTitle = (): string => {
    switch (showPicker) {
      case 'startDate':      return `${t('start_time')} - ${t('date')}`;
      case 'startTime':      return `${t('start_time')} - ${t('time')}`;
      case 'endDate':        return `${t('end_time')} - ${t('date')}`;
      case 'endTime':        return `${t('end_time')} - ${t('time')}`;
      case 'filterFromDate': return '📅 From Date';
      case 'filterToDate':   return '📅 To Date';
      default:               return '';
    }
  };

  // ── Computed preview ────────────────────────────────────────────────────────

  const startDateTime      = buildDateTime(logForm.startDate, logForm.startTime);
  const endDateTime        = logForm.hasEndTime
    ? buildDateTime(logForm.endDate, logForm.endTime)
    : null;
  const logPreviewDuration = endDateTime
    ? calcDurationMinutes(startDateTime, endDateTime)
    : 0;
  const logPreviewAmount   = (logPreviewDuration / 60) * Number(logForm.hourlyRate || 0);

  // ── Filter Modal Handlers ───────────────────────────────────────────────────

  const openFilterModal = () => {
    setTempFilters({ ...filters });
    setFilterModal(true);
  };

  const applyFilters = () => {
    setFilters({ ...tempFilters });
    setFilterModal(false);
  };

  const clearAllFilters = () => {
    const empty: FilterState = {
      fromDate: null, toDate: null, customerId: null, assetId: null,
    };
    setFilters(empty);
    setTempFilters(empty);
    setFilterModal(false);
  };

  const clearSingleFilter = (key: keyof FilterState) => {
    if (key === 'fromDate' || key === 'toDate') {
      setFilters((f) => ({ ...f, fromDate: null, toDate: null }));
    } else {
      setFilters((f) => ({ ...f, [key]: null }));
    }
  };

  // ── Quick Date Presets ──────────────────────────────────────────────────────

  const applyDatePreset = (preset: 'today' | 'week' | 'month') => {
    const now = new Date();
    let from  = new Date();
    if (preset === 'today') {
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
    } else if (preset === 'week') {
      from = new Date(now);
      from.setDate(now.getDate() - 7);
      from.setHours(0, 0, 0, 0);
    } else if (preset === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    setTempFilters((f) => ({ ...f, fromDate: from, toDate: now }));
  };

  // ── Log CRUD ────────────────────────────────────────────────────────────────

  const openLogModal = (log?: any) => {
    if (log) {
      setEditingLog(log);
      const startDt = new Date(log.start_time);
      // FIX: properly detect if end_time exists and is not empty
      const hasEnd  = !!log.end_time && log.end_time !== '' && log.status === 'completed';
      const endDt   = hasEnd ? new Date(log.end_time) : new Date();
      setLogForm({
        assetId:    log.asset_id,
        customerId: log.customer_id,
        startDate:  startDt,
        startTime:  startDt,
        hasEndTime: hasEnd,
        endDate:    endDt,
        endTime:    endDt,
        hourlyRate: String(log.hourly_rate),
        notes:      log.notes || '',
      });
    } else {
      setEditingLog(null);
      const now = new Date();
      setLogForm({
        assetId:    '',
        customerId: '',
        startDate:  now,
        startTime:  now,
        hasEndTime: false,
        endDate:    now,
        endTime:    now,
        hourlyRate: '',
        notes:      '',
      });
    }
    setLogModal(true);
  };

  const handleSaveLog = async () => {
    if (!logForm.assetId || !logForm.customerId) {
      Alert.alert(t('error'), t('select_asset_customer'));
      return;
    }
    const startIso         = startDateTime.toISOString();
    let endIso: string | null = null;
    let durationMins       = 0;
    let totalAmount        = 0;
    const rate             = Number(logForm.hourlyRate) || 0;

    if (logForm.hasEndTime && endDateTime) {
      durationMins = calcDurationMinutes(startDateTime, endDateTime);
      if (durationMins <= 0) {
        Alert.alert(t('error'), t('end_after_start'));
        return;
      }
      endIso      = endDateTime.toISOString();
      totalAmount = (durationMins / 60) * rate;
    }

    setLogSaving(true);
    try {
      if (editingLog) {
        await updateTimeLog(
          editingLog.id, user!.id, Number(logForm.assetId),
          Number(logForm.customerId), startIso,
          endIso || '', durationMins, rate, totalAmount, logForm.notes,
        );
      } else {
        await createTimeLog(
          user!.id, Number(logForm.assetId), Number(logForm.customerId),
          startIso, endIso || '', durationMins, rate, totalAmount, logForm.notes,
        );
      }
      setLogModal(false);
      await loadData();
    } catch (error) {
      Alert.alert(t('error'), (error as Error).message);
    } finally {
      setLogSaving(false);
    }
  };

  const handleDeleteLog = (id: number) => {
    Alert.alert(t('delete_log'), t('are_you_sure'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => { await deleteTimeLog(id, user!.id); await loadData(); },
      },
    ]);
  };

  // ── Asset CRUD ──────────────────────────────────────────────────────────────

  const openAssetModal = (asset?: any) => {
    if (asset) {
      setEditingAsset(asset);
      setAssetForm({
        name:        asset.name,
        assetType:   asset.asset_type,
        hourlyRate:  String(asset.hourly_rate),
        description: asset.description || '',
        isActive:    asset.is_active === 1,
      });
    } else {
      setEditingAsset(null);
      setAssetForm({
        name: '', assetType: 'vehicle', hourlyRate: '', description: '', isActive: true,
      });
    }
    setAssetModal(true);
  };

  const handleSaveAsset = async () => {
    if (!assetForm.name.trim()) {
      Alert.alert(t('error'), t('asset_name_required'));
      return;
    }
    if (!assetForm.hourlyRate || Number(assetForm.hourlyRate) <= 0) {
      Alert.alert(t('error'), t('hourly_rate_invalid'));
      return;
    }
    setAssetSaving(true);
    try {
      if (editingAsset) {
        await updateAsset(
          editingAsset.id, user!.id, assetForm.name.trim(),
          assetForm.assetType, Number(assetForm.hourlyRate),
          assetForm.description, assetForm.isActive,
        );
      } else {
        await createAsset(
          user!.id, assetForm.name.trim(), assetForm.assetType,
          Number(assetForm.hourlyRate), assetForm.description,
        );
      }
      setAssetModal(false);
      await loadData();
    } catch (error) {
      Alert.alert(t('error'), (error as Error).message);
    } finally {
      setAssetSaving(false);
    }
  };

  const handleDeleteAsset = (id: number, name: string) => {
    Alert.alert(t('delete_asset'), `"${name}" - ${t('delete_asset_confirm')}`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => { await deleteAsset(id, user!.id); await loadData(); },
      },
    ]);
  };

  // ── Customer CRUD ───────────────────────────────────────────────────────────

  const openCustomerModal = (customer?: any) => {
    if (customer) {
      setEditingCustomer(customer);
      setCustomerForm({
        name:    customer.name,
        phone:   customer.phone   || '',
        address: customer.address || '',
        notes:   customer.notes   || '',
      });
    } else {
      setEditingCustomer(null);
      setCustomerForm({ name: '', phone: '', address: '', notes: '' });
    }
    setCustomerModal(true);
  };

  const handleSaveCustomer = async () => {
    if (!customerForm.name.trim()) {
      Alert.alert(t('error'), t('customer_name_required'));
      return;
    }
    setCustomerSaving(true);
    try {
      if (editingCustomer) {
        await updateAssetCustomer(
          editingCustomer.id, user!.id, customerForm.name.trim(),
          customerForm.phone, customerForm.address, customerForm.notes,
        );
      } else {
        await createAssetCustomer(
          user!.id, customerForm.name.trim(),
          customerForm.phone, customerForm.address, customerForm.notes,
        );
      }
      setCustomerModal(false);
      await loadData();
    } catch (error) {
      Alert.alert(t('error'), (error as Error).message);
    } finally {
      setCustomerSaving(false);
    }
  };

  const handleDeleteCustomer = (id: number, name: string) => {
    Alert.alert(t('delete_customer'), `"${name}" - ${t('delete_customer_confirm')}`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          await deleteAssetCustomer(id, user!.id);
          await loadData();
        },
      },
    ]);
  };

  // ── Misc Helpers ────────────────────────────────────────────────────────────

  const handleLogAssetChange = (assetId: number | string) => {
    const asset = assets.find((a) => a.id === Number(assetId));
    setLogForm({
      ...logForm,
      assetId,
      hourlyRate: asset ? String(asset.hourly_rate) : '',
    });
  };

  const ASSET_TYPE_OPTIONS = [
    { value: 'vehicle',   label: t('type_vehicle') },
    { value: 'tractor',   label: t('type_tractor') },
    { value: 'machine',   label: t('type_machine') },
    { value: 'equipment', label: t('type_equipment') },
    { value: 'other',     label: t('type_other') },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>

      {/* ── Screen Header ───────────────────────────────────────────────────── */}
      <ScreenHeader
        emoji="⏱️"
        title={t('tab_tracker')}
        subtitle={`${t('total_revenue')}: ${formatCompactCurrency(dashboardData?.totalRevenue || 0)}`}
      >
        <View style={styles.headerStats}>
          <StatPill
            emoji="👥"
            label={t('tracker_customers')}
            value={String(dashboardData?.totalCustomers || 0)}
          />
          <StatPill
            emoji="⚠️"
            label={t('outstanding_amount')}
            value={formatCompactCurrency(dashboardData?.outstanding || 0)}
          />
        </View>
      </ScreenHeader>

      {/* ── Tab Bar ─────────────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[
          styles.tabBar,
          { backgroundColor: isDark ? '#1e293b' : '#fff', borderBottomColor: theme.colors.border },
        ]}
        contentContainerStyle={styles.tabBarContent}
      >
        {([
          { key: 'dashboard', label: t('tracker_dashboard'), emoji: '📊' },
          { key: 'logs',      label: t('tracker_logs'),      emoji: '📋' },
          { key: 'customers', label: t('tracker_customers'), emoji: '👥' },
          { key: 'assets',    label: t('tracker_assets'),    emoji: '🚜' },
        ] as { key: Tab; label: string; emoji: string }[]).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabItem,
              activeTab === tab.key && [
                styles.tabItemActive,
                { borderBottomColor: theme.colors.primary },
              ],
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <View style={styles.tabItemContent}>
              <Text style={styles.tabEmoji}>{tab.emoji}</Text>
              <Text
                style={[
                  styles.tabItemText,
                  { color: theme.colors.muted },
                  activeTab === tab.key && {
                    color: theme.colors.primary, fontWeight: '700',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/*  DASHBOARD TAB                                                      */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <>
            <View style={styles.statsGrid}>
              {[
                { emoji: '🚜', label: t('active_assets'),      value: String(dashboardData?.totalAssets    || 0), color: theme.colors.primary, bg: isDark ? '#1e3a5f' : '#eff6ff' },
                { emoji: '👥', label: t('tracker_customers'),  value: String(dashboardData?.totalCustomers || 0), color: '#8b5cf6',            bg: isDark ? '#2e1065' : '#f3e8ff' },
                { emoji: '💰', label: t('total_revenue'),      value: formatCurrency(dashboardData?.totalRevenue  || 0), color: '#059669', bg: isDark ? '#064e3b' : '#ecfdf5' },
                { emoji: '⚠️', label: t('outstanding_amount'), value: formatCurrency(dashboardData?.outstanding   || 0), color: '#dc2626', bg: isDark ? '#450a0a' : '#fef2f2' },
              ].map((item, i) => (
                <Card key={i} style={[styles.statCard, { backgroundColor: item.bg }]}>
                  <Text style={styles.statEmoji}>{item.emoji}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.muted }]}>{item.label}</Text>
                  <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
                </Card>
              ))}
            </View>

            {/* Quick Add */}
            <TouchableOpacity
              style={[styles.quickAddEntry, { backgroundColor: theme.colors.primary }]}
              onPress={() => { setActiveTab('logs'); openLogModal(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.quickAddEntryIcon}>⏱️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.quickAddEntryTitle}>{t('add_log')}</Text>
                <Text style={styles.quickAddEntryDesc}>{t('enter_start_end')}</Text>
              </View>
              <Text style={styles.quickAddEntryArrow}>→</Text>
            </TouchableOpacity>

            {/* In Progress Jobs */}
            {allInProgress.length > 0 && (
              <Card
                style={[
                  styles.section,
                  {
                    backgroundColor: isDark ? '#451a03' : '#fffbeb',
                    borderWidth: 1,
                    borderColor: isDark ? '#92400e' : '#fde68a',
                  },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: '#d97706' }]}>
                  🔄 In Progress ({allInProgress.length})
                </Text>
                {allInProgress.map((log) => (
                  <TouchableOpacity
                    key={log.id}
                    onPress={() => openLogModal(log)}
                    activeOpacity={0.7}
                    style={[styles.logRow, { borderBottomColor: theme.colors.border }]}
                  >
                    <View style={[styles.logIcon, { backgroundColor: '#fef3c7' }]}>
                      <Text style={styles.logIconText}>{getAssetEmoji(log.asset_type)}</Text>
                    </View>
                    <View style={styles.logInfo}>
                      <Text style={[styles.logAsset,    { color: theme.colors.text }]}>{log.asset_name}</Text>
                      <Text style={[styles.logCustomer, { color: theme.colors.muted }]}>👤 {log.customer_name}</Text>
                      <Text style={[styles.logDate,     { color: theme.colors.muted }]}>🕐 {formatDateTime(log.start_time)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={[styles.inProgressBadge, { backgroundColor: '#fef3c7' }]}>
                        <Text style={styles.inProgressBadgeText}>🔄 In Progress</Text>
                      </View>
                      <Text style={[styles.tapToComplete, { color: '#d97706' }]}>
                        Tap to complete →
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </Card>
            )}

            {/* Recent Completed Jobs */}
            <Card style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                📋 {t('recent_jobs')}
              </Text>
              {(dashboardData?.recentLogs || []).filter((l: any) => l.end_time).length === 0 ? (
                <EmptyState
                  emoji="⏱️"
                  title={t('no_jobs_yet')}
                  subtitle={t('app_tagline')}
                  actionHint={`+ ${t('add_log')}`}
                />
              ) : (
                (dashboardData?.recentLogs || [])
                  .filter((l: any) => l.end_time)
                  .map((log: any) => (
                    <View key={log.id} style={[styles.logRow, { borderBottomColor: theme.colors.border }]}>
                      <View style={[styles.logIcon, { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }]}>
                        <Text style={styles.logIconText}>{getAssetEmoji(log.asset_type)}</Text>
                      </View>
                      <View style={styles.logInfo}>
                        <Text style={[styles.logAsset,    { color: theme.colors.text }]}>{log.asset_name}</Text>
                        <Text style={[styles.logCustomer, { color: theme.colors.muted }]}>👤 {log.customer_name}</Text>
                        <Text style={[styles.logDate,     { color: theme.colors.muted }]}>
                          📅 {formatDateOnly(log.start_time)}{'  '}
                          ⏱ {formatDuration(log.duration_minutes)}
                        </Text>
                      </View>
                      <Text style={[styles.logAmount, { color: '#059669' }]}>
                        {formatCurrency(log.total_amount)}
                      </Text>
                    </View>
                  ))
              )}
            </Card>

            {/* Top Customers */}
            {(dashboardData?.topCustomers || []).length > 0 && (
              <Card style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  👥 {t('top_customers')}
                </Text>
                {dashboardData.topCustomers.map((c: any) => {
                  const out = c.total_billed - c.total_paid;
                  return (
                    <View key={c.id} style={[styles.logRow, { borderBottomColor: theme.colors.border }]}>
                      <View style={[styles.customerAvatar, { backgroundColor: theme.colors.primary }]}>
                        <Text style={styles.customerAvatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.logInfo}>
                        <Text style={[styles.logAsset,    { color: theme.colors.text }]}>{c.name}</Text>
                        <Text style={[styles.logCustomer, { color: theme.colors.muted }]}>
                          {t('billed')}: {formatCurrency(c.total_billed)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.logAmount, { color: '#dc2626' }]}>{formatCurrency(out)}</Text>
                        <Text style={[styles.logDate,   { color: theme.colors.muted }]}>{t('due')}</Text>
                      </View>
                    </View>
                  );
                })}
              </Card>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/*  ASSETS TAB                                                         */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'assets' && (
          <>
            {assets.length === 0 ? (
              <Card>
                <EmptyState emoji="🚜" title={t('no_assets_yet')} actionHint={`+ ${t('add_asset')}`} />
              </Card>
            ) : (
              assets.map((a) => (
                <Card key={a.id} style={[styles.itemCard, { opacity: a.is_active ? 1 : 0.6 }]}>
                  <View style={styles.assetRow}>
                    <View style={[styles.assetIcon, { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }]}>
                      <Text style={styles.assetIconText}>{getAssetEmoji(a.asset_type)}</Text>
                    </View>
                    <View style={styles.assetInfo}>
                      <View style={styles.assetNameRow}>
                        <Text style={[styles.assetName, { color: theme.colors.text }]}>{a.name}</Text>
                        {!a.is_active && (
                          <View style={[styles.inactiveBadge, { backgroundColor: isDark ? '#334155' : '#f3f4f6' }]}>
                            <Text style={[styles.inactiveBadgeText, { color: theme.colors.muted }]}>
                              {t('asset_inactive')}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.assetRate,  { color: theme.colors.primary }]}>
                        ₹{a.hourly_rate}/hr
                      </Text>
                      <Text style={[styles.assetStats, { color: theme.colors.muted }]}>
                        ⏱ {formatDuration(a.total_minutes || 0)} • {formatCurrency(a.total_earned || 0)}
                      </Text>
                    </View>
                    <View style={styles.actionBtns}>
                      <TouchableOpacity
                        onPress={() => openAssetModal(a)}
                        style={[styles.editBtn, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}
                      >
                        <Text>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteAsset(a.id, a.name)}>
                        <Text style={styles.deleteBtn}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {a.description ? (
                    <Text style={[styles.assetDesc, { color: theme.colors.muted }]}>{a.description}</Text>
                  ) : null}
                </Card>
              ))
            )}
            <Button title={`+ ${t('add_asset')}`} onPress={() => openAssetModal()} style={styles.addBtn} />
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/*  CUSTOMERS TAB                                                      */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'customers' && (
          <>
            {customers.length === 0 ? (
              <Card>
                <EmptyState emoji="👥" title={t('no_customers_yet')} actionHint={`+ ${t('add_customer')}`} />
              </Card>
            ) : (
              customers.map((c) => {
                const out = (c.total_billed || 0) - (c.total_paid || 0);
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() =>
                      router.push({
                        pathname: '/tracker/customer-report/[id]',
                        params: { id: c.id, customerName: c.name },
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <Card style={styles.itemCard}>
                      <View style={styles.customerRow}>
                        <View style={[styles.customerAvatar, { backgroundColor: theme.colors.primary }]}>
                          <Text style={styles.customerAvatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.customerInfo}>
                          <Text style={[styles.customerName,  { color: theme.colors.text }]}>{c.name}</Text>
                          {c.phone && (
                            <Text style={[styles.customerPhone, { color: theme.colors.muted }]}>
                              📞 {c.phone}
                            </Text>
                          )}
                          <View style={styles.customerBilling}>
                            <Text style={[styles.customerBilledText, { color: theme.colors.muted }]}>
                              {t('billed')}: {formatCurrency(c.total_billed || 0)}
                            </Text>
                            <Text style={[styles.customerOutstanding, { color: out > 0 ? '#dc2626' : '#059669' }]}>
                              {t('due')}: {formatCurrency(Math.abs(out))}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.actionBtns}>
                          <TouchableOpacity
                            onPress={() => openCustomerModal(c)}
                            style={[styles.editBtn, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}
                          >
                            <Text>✏️</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteCustomer(c.id, c.name)}>
                            <Text style={styles.deleteBtn}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={[styles.tapHint, { color: theme.colors.primary }]}>
                        {t('tap_for_report')}
                      </Text>
                    </Card>
                  </TouchableOpacity>
                );
              })
            )}
            <Button
              title={`+ ${t('add_customer')}`}
              onPress={() => openCustomerModal()}
              style={styles.addBtn}
            />
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/*  TIME LOGS TAB                                                      */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'logs' && (
          <>
            {/* ── Filter Toolbar ─────────────────────────────────────────────── */}
            <View style={styles.filterToolbar}>
              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  {
                    backgroundColor: activeFilterCount > 0
                      ? theme.colors.primary
                      : isDark ? '#1e293b' : '#f1f5f9',
                    borderColor: activeFilterCount > 0
                      ? theme.colors.primary
                      : theme.colors.border,
                  },
                ]}
                onPress={openFilterModal}
                activeOpacity={0.8}
              >
                <Text style={styles.filterBtnIcon}>⚙️</Text>
                <Text style={[
                  styles.filterBtnText,
                  { color: activeFilterCount > 0 ? '#fff' : theme.colors.text },
                ]}>
                  Filter
                </Text>
                {activeFilterCount > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Active Filter Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                <View style={styles.filterChips}>
                  {(filters.fromDate || filters.toDate) && (
                    <View style={[styles.filterChip, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe', borderColor: theme.colors.primary }]}>
                      <Text style={[styles.filterChipText, { color: theme.colors.primary }]}>
                        📅 {filters.fromDate ? formatDateOnly(filters.fromDate) : '...'}
                        {' → '}
                        {filters.toDate ? formatDateOnly(filters.toDate) : '...'}
                      </Text>
                      <TouchableOpacity onPress={() => clearSingleFilter('fromDate')} style={styles.filterChipClose}>
                        <Text style={[styles.filterChipCloseText, { color: theme.colors.primary }]}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {filters.customerId && (
                    <View style={[styles.filterChip, { backgroundColor: isDark ? '#2e1065' : '#f3e8ff', borderColor: '#8b5cf6' }]}>
                      <Text style={[styles.filterChipText, { color: '#8b5cf6' }]}>
                        👤 {customers.find((c) => c.id === Number(filters.customerId))?.name ?? 'Customer'}
                      </Text>
                      <TouchableOpacity onPress={() => clearSingleFilter('customerId')} style={styles.filterChipClose}>
                        <Text style={[styles.filterChipCloseText, { color: '#8b5cf6' }]}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {filters.assetId && (
                    <View style={[styles.filterChip, { backgroundColor: isDark ? '#064e3b' : '#ecfdf5', borderColor: '#059669' }]}>
                      <Text style={[styles.filterChipText, { color: '#059669' }]}>
                        {getAssetEmoji(assets.find((a) => a.id === Number(filters.assetId))?.asset_type ?? '')}
                        {' '}
                        {assets.find((a) => a.id === Number(filters.assetId))?.name ?? 'Asset'}
                      </Text>
                      <TouchableOpacity onPress={() => clearSingleFilter('assetId')} style={styles.filterChipClose}>
                        <Text style={[styles.filterChipCloseText, { color: '#059669' }]}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>

            {/* ── Filtered Summary Bar ────────────────────────────────────────── */}
            {activeFilterCount > 0 && (
              <View style={[
                styles.filteredSummaryBar,
                { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: theme.colors.border },
              ]}>
                <View style={styles.filteredSummaryStat}>
                  <Text style={[styles.filteredSummaryLabel, { color: theme.colors.muted }]}>Results</Text>
                  <Text style={[styles.filteredSummaryValue, { color: theme.colors.text }]}>
                    {filteredTimeLogs.length} / {timeLogs.length}
                  </Text>
                </View>
                <View style={[styles.filteredSummaryDivider, { backgroundColor: theme.colors.border }]} />
                <View style={styles.filteredSummaryStat}>
                  <Text style={[styles.filteredSummaryLabel, { color: theme.colors.muted }]}>Duration</Text>
                  <Text style={[styles.filteredSummaryValue, { color: theme.colors.text }]}>
                    {formatDuration(filteredTotalDuration)}
                  </Text>
                </View>
                <View style={[styles.filteredSummaryDivider, { backgroundColor: theme.colors.border }]} />
                <View style={styles.filteredSummaryStat}>
                  <Text style={[styles.filteredSummaryLabel, { color: theme.colors.muted }]}>Amount</Text>
                  <Text style={[styles.filteredSummaryValue, { color: '#059669', fontWeight: '800' }]}>
                    {formatCurrency(filteredTotalAmount)}
                  </Text>
                </View>
                <TouchableOpacity onPress={clearAllFilters} style={styles.clearAllBtn}>
                  <Text style={[styles.clearAllBtnText, { color: '#dc2626' }]}>Clear All</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── In Progress Logs ────────────────────────────────────────────── */}
            {inProgressLogs.length > 0 && (
              <>
                <Text style={[styles.logSectionLabel, { color: '#d97706' }]}>
                  🔄 In Progress ({inProgressLogs.length})
                </Text>
                {inProgressLogs.map((log) => (
                  <Card key={log.id} style={[styles.itemCard, { borderWidth: 1, borderColor: '#fde68a' }]}>
                    <View style={styles.logDetailRow}>
                      <View style={[styles.logIcon, { backgroundColor: '#fef3c7' }]}>
                        <Text style={styles.logIconText}>{getAssetEmoji(log.asset_type)}</Text>
                      </View>
                      <View style={styles.logInfo}>
                        <Text style={[styles.logAsset,    { color: theme.colors.text }]}>{log.asset_name}</Text>
                        <Text style={[styles.logCustomer, { color: theme.colors.muted }]}>👤 {log.customer_name}</Text>
                        <Text style={[styles.logDate,     { color: theme.colors.muted }]}>🕐 {formatDateTime(log.start_time)}</Text>
                        <View style={[
                          styles.inProgressBadge,
                          { backgroundColor: '#fef3c7', alignSelf: 'flex-start', marginTop: 6 },
                        ]}>
                          <Text style={styles.inProgressBadgeText}>🔄 In Progress</Text>
                        </View>
                      </View>
                      <View style={styles.actionBtns}>
                        <TouchableOpacity
                          onPress={() => openLogModal(log)}
                          style={[styles.completeBtn, { backgroundColor: '#059669' }]}
                        >
                          <Text style={styles.completeBtnText}>✅ {t('done')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteLog(log.id)}>
                          <Text style={styles.deleteBtn}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Card>
                ))}
              </>
            )}

            {/* ── Completed Logs ──────────────────────────────────────────────── */}
            {/* FIX: Label changed from "Settled" to "Completed"                  */}
            {completedLogs.length > 0 && (
              <Text style={[styles.logSectionLabel, { color: theme.colors.text }]}>
                ✅ Completed ({completedLogs.length})
              </Text>
            )}

            {filteredTimeLogs.length === 0 ? (
              <Card>
                {activeFilterCount > 0 ? (
                  <EmptyState
                    emoji="🔍"
                    title="No Results Found"
                    subtitle="Try adjusting or clearing your filters"
                    actionHint="Clear Filters"
                  />
                ) : (
                  <EmptyState
                    emoji="📋"
                    title={t('no_logs_yet')}
                    actionHint={`+ ${t('add_log')}`}
                  />
                )}
              </Card>
            ) : (
              completedLogs.map((log) => (
                <Card key={log.id} style={styles.itemCard}>
                  <View style={styles.logDetailRow}>
                    <View style={[styles.logIcon, { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }]}>
                      <Text style={styles.logIconText}>{getAssetEmoji(log.asset_type)}</Text>
                    </View>
                    <View style={styles.logInfo}>
                      <Text style={[styles.logAsset,    { color: theme.colors.text }]}>{log.asset_name}</Text>
                      <Text style={[styles.logCustomer, { color: theme.colors.muted }]}>👤 {log.customer_name}</Text>
                      <Text style={[styles.logDate,     { color: theme.colors.muted }]}>🕐 {formatDateTime(log.start_time)}</Text>
                      <Text style={[styles.logDate,     { color: theme.colors.muted }]}>🏁 {formatDateTime(log.end_time)}</Text>
                      <Text style={[styles.logDate,     { color: theme.colors.muted }]}>
                        ⏱ {formatDuration(log.duration_minutes)} • ₹{log.hourly_rate}/hr
                      </Text>
                      {log.notes && (
                        <Text style={[styles.logNotes, { color: theme.colors.muted }]}>📝 {log.notes}</Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.logAmount, { color: '#059669' }]}>
                        {formatCurrency(log.total_amount)}
                      </Text>
                      <View style={styles.actionBtns}>
                        <TouchableOpacity
                          onPress={() => openLogModal(log)}
                          style={[styles.editBtn, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}
                        >
                          <Text>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteLog(log.id)}>
                          <Text style={styles.deleteBtn}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Card>
              ))
            )}

            <Button title={`+ ${t('add_log')}`} onPress={() => openLogModal()} style={styles.addBtn} />
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/*  FILTER BOTTOM SHEET MODAL                                            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={filterModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.filterModalContent, { backgroundColor: theme.colors.modalBg }]}>

            <View style={[styles.filterModalHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.filterModalTitle, { color: theme.colors.text }]}>
                ⚙️ Filter Time Logs
              </Text>
              <TouchableOpacity onPress={() => setFilterModal(false)} style={styles.filterModalCloseBtn}>
                <Text style={[styles.filterModalCloseTxt, { color: theme.colors.muted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterModalBody} showsVerticalScrollIndicator={false}>

              {/* ── Section 1 : Filter by Date ────────────────────────────────── */}
              <View style={[styles.filterSection, { borderColor: theme.colors.border }]}>
                <View style={styles.filterSectionHeader}>
                  <Text style={styles.filterSectionIcon}>📅</Text>
                  <Text style={[styles.filterSectionTitle, { color: theme.colors.text }]}>
                    Filter by Date
                  </Text>
                  {(tempFilters.fromDate || tempFilters.toDate) && (
                    <TouchableOpacity
                      onPress={() => setTempFilters((f) => ({ ...f, fromDate: null, toDate: null }))}
                      style={styles.filterSectionClear}
                    >
                      <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '600' }}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Quick Presets */}
                <View style={styles.presetRow}>
                  {(['today', 'week', 'month'] as const).map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.presetBtn,
                        { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderColor: theme.colors.border },
                      ]}
                      onPress={() => applyDatePreset(p)}
                    >
                      <Text style={[styles.presetBtnText, { color: theme.colors.text }]}>
                        {p === 'today' ? '📆 Today' : p === 'week' ? '📅 Last 7 Days' : '🗓️ This Month'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* From / To Date Pickers */}
                <View style={styles.dateRangeRow}>
                  <TouchableOpacity
                    style={[
                      styles.dateRangeBtn,
                      {
                        backgroundColor: isDark ? '#1e293b' : '#fff',
                        borderColor: tempFilters.fromDate ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                    onPress={() => setShowPicker('filterFromDate')}
                  >
                    <Text style={[styles.dateRangeBtnLabel, { color: theme.colors.muted }]}>From</Text>
                    <Text style={[
                      styles.dateRangeBtnValue,
                      { color: tempFilters.fromDate ? theme.colors.primary : theme.colors.muted },
                    ]}>
                      {tempFilters.fromDate ? formatDateOnly(tempFilters.fromDate) : 'Select date'}
                    </Text>
                  </TouchableOpacity>

                  <Text style={[styles.dateRangeSep, { color: theme.colors.muted }]}>→</Text>

                  <TouchableOpacity
                    style={[
                      styles.dateRangeBtn,
                      {
                        backgroundColor: isDark ? '#1e293b' : '#fff',
                        borderColor: tempFilters.toDate ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                    onPress={() => setShowPicker('filterToDate')}
                  >
                    <Text style={[styles.dateRangeBtnLabel, { color: theme.colors.muted }]}>To</Text>
                    <Text style={[
                      styles.dateRangeBtnValue,
                      { color: tempFilters.toDate ? theme.colors.primary : theme.colors.muted },
                    ]}>
                      {tempFilters.toDate ? formatDateOnly(tempFilters.toDate) : 'Select date'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* ── Section 2 : Filter by Customer (Dropdown) ─────────────────── */}
              <View style={[styles.filterSection, { borderColor: theme.colors.border }]}>
                <View style={styles.filterSectionHeader}>
                  <Text style={styles.filterSectionIcon}>👤</Text>
                  <Text style={[styles.filterSectionTitle, { color: theme.colors.text }]}>
                    Filter by Customer
                  </Text>
                  {tempFilters.customerId && (
                    <TouchableOpacity
                      onPress={() => setTempFilters((f) => ({ ...f, customerId: null }))}
                      style={styles.filterSectionClear}
                    >
                      <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '600' }}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {customers.length === 0 ? (
                  <Text style={[styles.filterEmptyHint, { color: theme.colors.muted }]}>
                    No customers found. Add a customer first.
                  </Text>
                ) : (
                  <Select
                    label=""
                    value={tempFilters.customerId ?? ''}
                    onChange={(v) =>
                      setTempFilters((f) => ({ ...f, customerId: v === '' ? null : v }))
                    }
                    options={[
                      { value: '', label: '👥 All Customers' },
                      ...customers.map((c) => ({
                        value: c.id,
                        label: `${c.name}${c.phone ? '  📞 ' + c.phone : ''}`,
                      })),
                    ]}
                    placeholder="Select Customer"
                  />
                )}
              </View>

              {/* ── Section 3 : Filter by Asset (Dropdown) ────────────────────── */}
              <View style={[styles.filterSection, { borderColor: theme.colors.border }]}>
                <View style={styles.filterSectionHeader}>
                  <Text style={styles.filterSectionIcon}>🚜</Text>
                  <Text style={[styles.filterSectionTitle, { color: theme.colors.text }]}>
                    Filter by Asset
                  </Text>
                  {tempFilters.assetId && (
                    <TouchableOpacity
                      onPress={() => setTempFilters((f) => ({ ...f, assetId: null }))}
                      style={styles.filterSectionClear}
                    >
                      <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '600' }}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {assets.length === 0 ? (
                  <Text style={[styles.filterEmptyHint, { color: theme.colors.muted }]}>
                    No assets found. Add an asset first.
                  </Text>
                ) : (
                  <Select
                    label=""
                    value={tempFilters.assetId ?? ''}
                    onChange={(v) =>
                      setTempFilters((f) => ({ ...f, assetId: v === '' ? null : v }))
                    }
                    options={[
                      { value: '', label: '🚜 All Assets' },
                      ...assets.map((a) => ({
                        value: a.id,
                        label: `${getAssetEmoji(a.asset_type)} ${a.name}  ₹${a.hourly_rate}/hr`,
                      })),
                    ]}
                    placeholder="Select Asset"
                  />
                )}
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Footer Buttons */}
            <View style={[styles.filterModalFooter, { borderTopColor: theme.colors.border }]}>
              <TouchableOpacity
                style={[styles.filterFooterClearBtn, { borderColor: '#dc2626' }]}
                onPress={clearAllFilters}
              >
                <Text style={[styles.filterFooterClearTxt, { color: '#dc2626' }]}>🗑️ Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterFooterApplyBtn, { backgroundColor: theme.colors.primary }]}
                onPress={applyFilters}
              >
                <Text style={styles.filterFooterApplyTxt}>✅ Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/*  TIME LOG ENTRY MODAL                                                 */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={logModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <ScrollView
            style={[styles.modalScrollContent, { backgroundColor: theme.colors.modalBg }]}
            bounces={false}
          >
            <View style={styles.modalInner}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {editingLog ? `✏️ ${t('edit_log')}` : `⏱️ ${t('add_log')}`}
              </Text>

              <Select
                label={`${t('asset_label')} *`}
                value={logForm.assetId}
                onChange={handleLogAssetChange}
                options={assets.map((a) => ({
                  value: a.id,
                  label: `${getAssetEmoji(a.asset_type)} ${a.name} (₹${a.hourly_rate}/hr)`,
                }))}
                placeholder={t('select_asset')}
              />

              <Select
                label={`${t('tracker_customers')} *`}
                value={logForm.customerId}
                onChange={(v) => setLogForm({ ...logForm, customerId: v })}
                options={customers.map((c) => ({ value: c.id, label: c.name }))}
                placeholder={t('select_customer')}
              />

              {/* Start Date & Time */}
              <View style={[styles.dtSection, { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: theme.colors.border }]}>
                <Text style={[styles.dtSectionTitle, { color: theme.colors.text }]}>🕐 {t('start_time')}</Text>
                <View style={styles.dtRow}>
                  <TouchableOpacity
                    style={[styles.dtButton, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: theme.colors.primary }]}
                    onPress={() => setShowPicker('startDate')}
                  >
                    <Text style={[styles.dtButtonLabel, { color: theme.colors.muted }]}>📅 {t('date')}</Text>
                    <Text style={[styles.dtButtonValue, { color: theme.colors.text }]}>{formatDateOnly(logForm.startDate)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dtButton, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: theme.colors.primary }]}
                    onPress={() => setShowPicker('startTime')}
                  >
                    <Text style={[styles.dtButtonLabel, { color: theme.colors.muted }]}>🕐 {t('time')}</Text>
                    <Text style={[styles.dtButtonValue, { color: theme.colors.text }]}>{formatTimeOnly(logForm.startTime)}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* End Time Toggle */}
              <TouchableOpacity
                style={[
                  styles.endTimeToggle,
                  {
                    backgroundColor: logForm.hasEndTime
                      ? isDark ? '#064e3b' : '#ecfdf5'
                      : isDark ? '#334155' : '#f3f4f6',
                    borderColor: logForm.hasEndTime ? '#059669' : theme.colors.border,
                  },
                ]}
                onPress={() => setLogForm({ ...logForm, hasEndTime: !logForm.hasEndTime })}
              >
                <Text style={[
                  styles.endTimeToggleText,
                  { color: logForm.hasEndTime ? '#059669' : theme.colors.muted },
                ]}>
                  {logForm.hasEndTime ? '✅ End Time Added' : '➕ Add End Time (optional)'}
                </Text>
                <Text style={[styles.endTimeToggleHint, { color: theme.colors.muted }]}>
                  {logForm.hasEndTime
                    ? 'Job will be marked as completed'
                    : 'Leave empty to mark as "In Progress"'}
                </Text>
              </TouchableOpacity>

              {/* End Date & Time */}
              {logForm.hasEndTime && (
                <View style={[styles.dtSection, { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: theme.colors.border }]}>
                  <Text style={[styles.dtSectionTitle, { color: theme.colors.text }]}>🏁 {t('end_time')}</Text>
                  <View style={styles.dtRow}>
                    <TouchableOpacity
                      style={[styles.dtButton, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: theme.colors.primary }]}
                      onPress={() => setShowPicker('endDate')}
                    >
                      <Text style={[styles.dtButtonLabel, { color: theme.colors.muted }]}>📅 {t('date')}</Text>
                      <Text style={[styles.dtButtonValue, { color: theme.colors.text }]}>{formatDateOnly(logForm.endDate)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.dtButton, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: theme.colors.primary }]}
                      onPress={() => setShowPicker('endTime')}
                    >
                      <Text style={[styles.dtButtonLabel, { color: theme.colors.muted }]}>🕐 {t('time')}</Text>
                      <Text style={[styles.dtButtonValue, { color: theme.colors.text }]}>{formatTimeOnly(logForm.endTime)}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <Input
                label={`${t('hourly_rate')} *`}
                value={logForm.hourlyRate}
                onChangeText={(v) => setLogForm({ ...logForm, hourlyRate: v })}
                placeholder="0"
                keyboardType="numeric"
              />

              {logForm.hasEndTime && logPreviewDuration > 0 && (
                <Card style={[styles.previewCard, { backgroundColor: isDark ? '#064e3b' : '#ecfdf5' }]}>
                  <Text style={[styles.previewCardTitle, { color: '#059669' }]}>
                    ✅ {t('duration')} Preview
                  </Text>
                  <View style={styles.previewRow}>
                    <Text style={[styles.previewLabel, { color: theme.colors.muted }]}>{t('duration')}</Text>
                    <Text style={[styles.previewValue, { color: theme.colors.text }]}>
                      {formatDuration(logPreviewDuration)}
                    </Text>
                  </View>
                  <View style={[styles.previewRow, styles.previewRowLast]}>
                    <Text style={[styles.previewLabel, { color: theme.colors.muted }]}>{t('amount')}</Text>
                    <Text style={[styles.previewValue, { color: '#059669', fontSize: 20, fontWeight: '800' }]}>
                      {formatCurrency(logPreviewAmount)}
                    </Text>
                  </View>
                </Card>
              )}

              {!logForm.hasEndTime && (
                <View style={[
                  styles.inProgressInfo,
                  {
                    backgroundColor: isDark ? '#451a03' : '#fffbeb',
                    borderColor:     isDark ? '#92400e' : '#fde68a',
                  },
                ]}>
                  <Text style={[styles.inProgressInfoText, { color: isDark ? '#fcd34d' : '#92400e' }]}>
                    💡 This job will be saved as "In Progress". You can add the end time later by editing this entry.
                  </Text>
                </View>
              )}

              <Input
                label={t('notes')}
                value={logForm.notes}
                onChangeText={(v) => setLogForm({ ...logForm, notes: v })}
                placeholder={t('optional')}
              />

              <View style={styles.modalButtons}>
                <Button title={t('cancel')} variant="secondary" onPress={() => setLogModal(false)} />
                <Button
                  title={logForm.hasEndTime ? t('save') : '💾 Save as In Progress'}
                  onPress={handleSaveLog}
                  loading={logSaving}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/*  NATIVE DATE / TIME PICKER                                            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={getPickerValue()}
          mode={getPickerMode()}
          display="default"
          is24Hour={false}
          onChange={handlePickerChange}
        />
      )}

      {showPicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade">
          <TouchableOpacity
            style={[styles.pickerOverlay, { backgroundColor: theme.colors.overlay }]}
            activeOpacity={1}
            onPress={handlePickerDone}
          >
            <View style={[
              styles.pickerContent,
              {
                backgroundColor: theme.colors.modalBg,
                borderColor:     theme.colors.border,
                borderWidth:     isDark ? 1 : 0,
              },
            ]}>
              <View style={[styles.pickerHeader, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.pickerTitle, { color: theme.colors.text }]}>
                  {getPickerTitle()}
                </Text>
                <TouchableOpacity
                  onPress={handlePickerDone}
                  style={[styles.pickerDoneBtn, { backgroundColor: theme.colors.primary }]}
                >
                  <Text style={styles.pickerDoneBtnText}>{t('done')}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={getPickerValue()}
                mode={getPickerMode()}
                display="spinner"
                is24Hour={false}
                onChange={handlePickerChange}
                style={{ height: 200 }}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/*  ASSET MODAL                                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={assetModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <ScrollView
            style={[styles.modalScrollContent, { backgroundColor: theme.colors.modalBg }]}
            bounces={false}
          >
            <View style={styles.modalInner}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {editingAsset ? t('edit_asset') : t('add_asset')}
              </Text>
              <Input
                label={`${t('asset_name')} *`}
                value={assetForm.name}
                onChangeText={(v) => setAssetForm({ ...assetForm, name: v })}
                placeholder="e.g., Mahindra Tractor"
              />
              <Select
                label={t('asset_type')}
                value={assetForm.assetType}
                onChange={(v) => setAssetForm({ ...assetForm, assetType: String(v) })}
                options={ASSET_TYPE_OPTIONS}
              />
              <Input
                label={`${t('hourly_rate')} *`}
                value={assetForm.hourlyRate}
                onChangeText={(v) => setAssetForm({ ...assetForm, hourlyRate: v })}
                placeholder="e.g., 500"
                keyboardType="numeric"
              />
              <Input
                label={t('description')}
                value={assetForm.description}
                onChangeText={(v) => setAssetForm({ ...assetForm, description: v })}
                placeholder={t('optional')}
              />
              {editingAsset && (
                <View style={[styles.activeToggleRow, { borderColor: theme.colors.border }]}>
                  <View>
                    <Text style={[styles.activeToggleLabel, { color: theme.colors.text }]}>
                      {t('asset_active_toggle')}
                    </Text>
                    <Text style={[styles.activeToggleDesc, { color: theme.colors.muted }]}>
                      {t('asset_active_desc')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      { backgroundColor: assetForm.isActive ? '#059669' : isDark ? '#334155' : '#e5e7eb' },
                    ]}
                    onPress={() => setAssetForm({ ...assetForm, isActive: !assetForm.isActive })}
                  >
                    <Text style={styles.toggleBtnText}>{assetForm.isActive ? 'ON' : 'OFF'}</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.modalButtons}>
                <Button title={t('cancel')} variant="secondary" onPress={() => setAssetModal(false)} />
                <Button title={t('save')} onPress={handleSaveAsset} loading={assetSaving} />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/*  CUSTOMER MODAL                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={customerModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <ScrollView
            style={[styles.modalScrollContent, { backgroundColor: theme.colors.modalBg }]}
            bounces={false}
          >
            <View style={styles.modalInner}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {editingCustomer ? t('edit_customer') : t('add_customer')}
              </Text>
              <Input
                label={`${t('name')} *`}
                value={customerForm.name}
                onChangeText={(v) => setCustomerForm({ ...customerForm, name: v })}
                placeholder={t('name')}
              />
              <Input
                label={t('phone')}
                value={customerForm.phone}
                onChangeText={(v) => setCustomerForm({ ...customerForm, phone: v })}
                placeholder={t('phone')}
                keyboardType="phone-pad"
              />
              <Input
                label={t('address')}
                value={customerForm.address}
                onChangeText={(v) => setCustomerForm({ ...customerForm, address: v })}
                placeholder={t('address')}
              />
              <Input
                label={t('notes')}
                value={customerForm.notes}
                onChangeText={(v) => setCustomerForm({ ...customerForm, notes: v })}
                placeholder={t('optional')}
              />
              <View style={styles.modalButtons}>
                <Button title={t('cancel')} variant="secondary" onPress={() => setCustomerModal(false)} />
                <Button title={t('save')} onPress={handleSaveCustomer} loading={customerSaving} />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1 },
  headerStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  tabBar:         { flexGrow: 0, borderBottomWidth: 1 },
  tabBarContent:  { paddingHorizontal: 8 },
  tabItem:        { paddingHorizontal: 12, paddingVertical: 12, marginHorizontal: 4 },
  tabItemActive:  { borderBottomWidth: 2 },
  tabItemContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tabEmoji:       { fontSize: 14 },
  tabItemText:    { fontSize: 13, fontWeight: '500' },
  content:        { flex: 1, padding: 16 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  statCard:  { width: '47%', padding: 14, alignItems: 'center' },
  statEmoji: { fontSize: 22, marginBottom: 4 },
  statLabel: { fontSize: 10, textAlign: 'center', marginBottom: 2 },
  statValue: { fontSize: 16, fontWeight: '800' },

  quickAddEntry:      { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 14, marginBottom: 16 },
  quickAddEntryIcon:  { fontSize: 32 },
  quickAddEntryTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  quickAddEntryDesc:  { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  quickAddEntryArrow: { color: '#fff', fontSize: 22, fontWeight: '700' },

  section:      { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 14 },

  logRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  logDetailRow:    { flexDirection: 'row', alignItems: 'flex-start' },
  logIcon:         { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  logIconText:     { fontSize: 20 },
  logInfo:         { flex: 1 },
  logAsset:        { fontSize: 14, fontWeight: '600' },
  logCustomer:     { fontSize: 12, marginTop: 2 },
  logDate:         { fontSize: 11, marginTop: 2 },
  logNotes:        { fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  logAmount:       { fontSize: 16, fontWeight: '800' },
  logSectionLabel: { fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 4 },

  inProgressBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  inProgressBadgeText: { fontSize: 11, fontWeight: '700', color: '#92400e' },
  tapToComplete:       { fontSize: 11, fontWeight: '600', marginTop: 4 },
  completeBtn:         { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 4 },
  completeBtnText:     { color: '#fff', fontSize: 12, fontWeight: '700' },

  itemCard:      { marginBottom: 12 },
  assetRow:      { flexDirection: 'row', alignItems: 'center' },
  assetIcon:     { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  assetIconText: { fontSize: 24 },
  assetInfo:     { flex: 1 },
  assetNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assetName:     { fontSize: 15, fontWeight: '600' },
  assetRate:     { fontSize: 13, fontWeight: '600', marginTop: 2 },
  assetStats:    { fontSize: 11, marginTop: 2 },
  assetDesc:     { fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  inactiveBadge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  inactiveBadgeText: { fontSize: 10, fontWeight: '600' },

  customerRow:         { flexDirection: 'row', alignItems: 'center' },
  customerAvatar:      { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  customerAvatarText:  { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  customerInfo:        { flex: 1 },
  customerName:        { fontSize: 15, fontWeight: '600' },
  customerPhone:       { fontSize: 12, marginTop: 2 },
  customerBilling:     { flexDirection: 'row', gap: 12, marginTop: 4 },
  customerBilledText:  { fontSize: 11 },
  customerOutstanding: { fontSize: 11, fontWeight: '700' },
  tapHint:             { fontSize: 12, marginTop: 8, fontWeight: '500' },

  actionBtns: { flexDirection: 'row', gap: 4, marginLeft: 8 },
  editBtn:    { padding: 6, borderRadius: 6 },
  deleteBtn:  { fontSize: 18, padding: 4 },
  addBtn:     { marginTop: 8, marginBottom: 8 },

  filterToolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5,
  },
  filterBtnIcon:       { fontSize: 15 },
  filterBtnText:       { fontSize: 13, fontWeight: '700' },
  filterBadge:         { backgroundColor: '#fff', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterBadgeText:     { fontSize: 11, fontWeight: '800', color: '#1e40af' },
  filterChips:         { flexDirection: 'row', gap: 8, alignItems: 'center' },
  filterChip:          { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  filterChipText:      { fontSize: 12, fontWeight: '600' },
  filterChipClose:     { marginLeft: 2 },
  filterChipCloseText: { fontSize: 13, fontWeight: '700' },

  filteredSummaryBar:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12, gap: 4 },
  filteredSummaryStat:    { flex: 1, alignItems: 'center' },
  filteredSummaryLabel:   { fontSize: 10, fontWeight: '600', marginBottom: 2 },
  filteredSummaryValue:   { fontSize: 14, fontWeight: '700' },
  filteredSummaryDivider: { width: 1, height: 32, marginHorizontal: 4 },
  clearAllBtn:            { paddingHorizontal: 10, paddingVertical: 6 },
  clearAllBtnText:        { fontSize: 12, fontWeight: '700' },

  filterModalContent: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '88%', flex: 0, marginTop: 'auto',
  },
  filterModalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  filterModalTitle:    { fontSize: 18, fontWeight: '800' },
  filterModalCloseBtn: { padding: 4 },
  filterModalCloseTxt: { fontSize: 20, fontWeight: '700' },
  filterModalBody:     { padding: 16 },
  filterModalFooter:   { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, paddingBottom: 32 },
  filterFooterClearBtn:{ flex: 1, borderWidth: 1.5, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  filterFooterClearTxt:{ fontSize: 15, fontWeight: '700' },
  filterFooterApplyBtn:{ flex: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  filterFooterApplyTxt:{ color: '#fff', fontSize: 15, fontWeight: '800' },

  filterSection:       { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  filterSectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  filterSectionIcon:   { fontSize: 18 },
  filterSectionTitle:  { fontSize: 15, fontWeight: '700', flex: 1 },
  filterSectionClear:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#fee2e2' },
  filterEmptyHint:     { fontSize: 13, textAlign: 'center', padding: 12 },

  presetRow:     { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  presetBtn:     { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  presetBtnText: { fontSize: 12, fontWeight: '600' },

  dateRangeRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateRangeBtn:      { flex: 1, borderWidth: 1.5, borderRadius: 10, padding: 12 },
  dateRangeBtnLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  dateRangeBtnValue: { fontSize: 13, fontWeight: '700' },
  dateRangeSep:      { fontSize: 18, fontWeight: '700' },

  dtSection:      { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16 },
  dtSectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  dtRow:          { flexDirection: 'row', gap: 10 },
  dtButton:       { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center' },
  dtButtonLabel:  { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  dtButtonValue:  { fontSize: 14, fontWeight: '700' },

  endTimeToggle:     { borderWidth: 1.5, borderRadius: 12, padding: 16, marginBottom: 16, alignItems: 'center' },
  endTimeToggleText: { fontSize: 15, fontWeight: '700' },
  endTimeToggleHint: { fontSize: 12, marginTop: 4 },

  inProgressInfo:     { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  inProgressInfoText: { fontSize: 12, lineHeight: 18 },

  previewCard:      { marginBottom: 16, padding: 14 },
  previewCardTitle: { fontSize: 13, fontWeight: '700', marginBottom: 10 },
  previewRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  previewRowLast:   { marginBottom: 0, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)', paddingTop: 8, marginTop: 4 },
  previewLabel:     { fontSize: 13 },
  previewValue:     { fontSize: 15, fontWeight: '700' },

  activeToggleRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16 },
  activeToggleLabel:{ fontSize: 15, fontWeight: '600' },
  activeToggleDesc: { fontSize: 12, marginTop: 2 },
  toggleBtn:        { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  toggleBtnText:    { color: '#fff', fontWeight: '700', fontSize: 13 },
    // ── Modals ──────────────────────────────────────────────────────────────────
  modalOverlay:      { flex: 1, justifyContent: 'flex-end' },
  modalScrollContent:{ borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  modalInner:        { padding: 20, paddingBottom: 40 },
  modalTitle:        { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  modalButtons:      { flexDirection: 'row', gap: 12, marginTop: 16 },

  pickerOverlay:    { flex: 1, justifyContent: 'flex-end' },
  pickerContent:    { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  pickerHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  pickerTitle:      { fontSize: 16, fontWeight: '600' },
  pickerDoneBtn:    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  pickerDoneBtnText:{ color: '#fff', fontSize: 14, fontWeight: '700' },
});