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
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import {
  getHomeServices,
  createHomeService,
  updateHomeService,
  deleteHomeService,
  getRefillItems,
  createRefillItem,
  updateRefillItem,
  deleteRefillItem,
  createRefillLog,
  deleteRefillLog,
  getRefillLogs,
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  markReminderDone,
  getOrganizerDashboard,
  getTodaysReminders,
  getHabits,
  createHabit,
  updateHabit,
  deleteHabit,
  getHabitTimes,
  toggleHabitLog,
  ensureHabitLogsForDate,
  getTodaysHabitsSummary,
  getHabitLogsForDate,
} from '../../src/lib/organizerDatabase';
import {
  requestNotificationPermissions,
  scheduleHabitReminders,
  cancelHabitReminders,
  scheduleReminderNotification,
  cancelReminderNotification,
} from '../../src/lib/notificationService';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Select } from '../../src/components/Select';
import DatePicker from '../../src/components/DatePicker';
import { EmptyState } from '../../src/components/EmptyState';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { StatPill } from '../../src/components/StatPill';

type Tab = 'dashboard' | 'services' | 'refills' | 'reminders' | 'habits';

// ── Helper functions ──────────────────────────────────────────────────────

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return dateStr; }
}

function getCategoryEmoji(category: string): string {
  switch (category) {
    case 'maid': return '🧹';
    case 'newspaper': return '📰';
    case 'milkman': return '🥛';
    case 'laundry': return '👔';
    case 'cook': return '👨‍🍳';
    case 'driver': return '🚗';
    case 'gardener': return '🌱';
    case 'gas': return '🔥';
    case 'water': return '💧';
    case 'filter': return '🚰';
    case 'birthday': return '🎂';
    case 'anniversary': return '🎊';
    case 'bill': return '💳';
    case 'plan': return '📋';
    case 'recurring': return '🔄';
    case 'custom': return '🔔';
    default: return '📦';
  }
}

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

function getReminderCategoryEmoji(category: string): string {
  switch (category) {
    case 'birthday': return '🎂';
    case 'anniversary': return '🎊';
    case 'bill': return '💳';
    case 'plan': return '📋';
    case 'recurring': return '🔄';
    default: return '🔔';
  }
}

function isOverdue(dateStr: string): boolean {
  return dateStr < new Date().toISOString().split('T')[0];
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split('T')[0];
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatTime12h(timeStr: string): string {
  const [h, m] = (timeStr || '09:00').split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function parseTimeToDate(timeStr: string): Date {
  const [h, m] = (timeStr || '09:00').split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

// ── HabitTimeSlots Component ──────────────────────────────────────────────

function HabitTimeSlots({
  habitId, userId, theme, isDark, onToggle, formatTime,
}: {
  habitId: number;
  userId: number;
  theme: any;
  isDark: boolean;
  onToggle: (habitId: number, time: string) => void;
  formatTime: (time: string) => string;
}) {
  const [times, setTimes] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadTimes();
    }, [habitId])
  );

  const loadTimes = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const habitTimes = await getHabitTimes(habitId);
      const habitLogs = await getHabitLogsForDate(userId, today);
      setTimes(habitTimes);
      setLogs(habitLogs.filter((l: any) => l.habit_id === habitId));
    } catch {}
  };

  const isTimeDone = (time: string): boolean => {
    return logs.some((l) => l.log_time === time && l.is_done === 1);
  };

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
      {times.map((timeEntry) => {
        const done = isTimeDone(timeEntry.reminder_time);
        const isPast = timeEntry.reminder_time < currentTime;
        const isMissed = !done && isPast;

        return (
          <TouchableOpacity
            key={timeEntry.id}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 20,
              borderWidth: 1.5,
              backgroundColor: done
                ? isDark ? '#064e3b' : '#ecfdf5'
                : isMissed
                ? isDark ? '#451a03' : '#fffbeb'
                : isDark ? '#1e293b' : '#f8fafc',
              borderColor: done
                ? '#059669'
                : isMissed
                ? '#d97706'
                : theme.colors.border,
            }}
            onPress={async () => {
              await onToggle(habitId, timeEntry.reminder_time);
              await loadTimes();
            }}
          >
            <Text style={{
              fontSize: 12,
              fontWeight: '600',
              color: done ? '#059669' : isMissed ? '#d97706' : theme.colors.text,
            }}>
              {done ? '✅ ' : isMissed ? '⚠️ ' : '⏰ '}
              {formatTime(timeEntry.reminder_time)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function Organizer() {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [services, setServices] = useState<any[]>([]);
  const [refillItems, setRefillItems] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [habitsSummary, setHabitsSummary] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ── Service form ───────────────────────────────────────────────────
  const [serviceModal, setServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [serviceForm, setServiceForm] = useState({
    name: '', category: 'maid', monthlyRate: '',
    perVisitRate: '', workingDays: 'mon,tue,wed,thu,fri,sat',
  });
  const [serviceSaving, setServiceSaving] = useState(false);

  // ── Refill item form ───────────────────────────────────────────────
  const [refillItemModal, setRefillItemModal] = useState(false);
  const [editingRefillItem, setEditingRefillItem] = useState<any>(null);
  const [refillItemForm, setRefillItemForm] = useState({
    name: '', category: 'gas', defaultPrice: '', notes: '',
  });
  const [refillItemSaving, setRefillItemSaving] = useState(false);

  // ── Refill log form ────────────────────────────────────────────────
  const [refillLogModal, setRefillLogModal] = useState(false);
  const [refillLogItemId, setRefillLogItemId] = useState<number>(0);
  const [refillLogForm, setRefillLogForm] = useState({
    refillDate: new Date().toISOString().split('T')[0],
    amount: '', notes: '',
  });
  const [refillLogSaving, setRefillLogSaving] = useState(false);

  // ── Reminder form ──────────────────────────────────────────────────
  const [reminderModal, setReminderModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<any>(null);
  const [reminderForm, setReminderForm] = useState({
    title: '', description: '', category: 'custom',
    reminderDate: new Date().toISOString().split('T')[0],
    reminderTime: '09:00', recurrence: 'none', recurrenceDay: '',
  });
  const [reminderSaving, setReminderSaving] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // ── Habit form ─────────────────────────────────────────────────────
  const [habitModal, setHabitModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<any>(null);
  const [habitForm, setHabitForm] = useState({
    name: '', category: 'water', mode: 'interval',
    intervalHours: '2', startTime: '08:00', endTime: '20:00',
    fixedTimes: ['09:00', '12:00', '15:00', '18:00'],
  });
  const [habitSaving, setHabitSaving] = useState(false);
  const [showHabitTimePicker, setShowHabitTimePicker] = useState(false);
  const [habitTimePickerTarget, setHabitTimePickerTarget] = useState<'start' | 'end' | number>('start');

  // ── Category options ───────────────────────────────────────────────

  const SERVICE_CATEGORIES = [
    { value: 'maid', label: t('cat_maid') },
    { value: 'newspaper', label: t('cat_newspaper') },
    { value: 'milkman', label: t('cat_milkman') },
    { value: 'laundry', label: t('cat_laundry') },
    { value: 'cook', label: t('cat_cook') },
    { value: 'driver', label: t('cat_driver') },
    { value: 'gardener', label: t('cat_gardener') },
    { value: 'other', label: t('cat_other_service') },
  ];

  const WORKING_DAYS_OPTIONS = [
    { value: 'mon,tue,wed,thu,fri,sat', label: 'Mon - Sat' },
    { value: 'mon,tue,wed,thu,fri', label: 'Mon - Fri' },
    { value: 'all', label: 'All Days' },
    { value: 'mon,wed,fri', label: 'Mon, Wed, Fri' },
    { value: 'tue,thu,sat', label: 'Tue, Thu, Sat' },
  ];

  const REFILL_CATEGORIES = [
    { value: 'gas', label: t('cat_gas') },
    { value: 'water', label: t('cat_water') },
    { value: 'filter', label: t('cat_filter') },
    { value: 'other', label: t('cat_other_refill') },
  ];

  const REMINDER_CATEGORIES = [
    { value: 'birthday', label: t('cat_birthday') },
    { value: 'anniversary', label: t('cat_anniversary') },
    { value: 'bill', label: t('cat_bill') },
    { value: 'plan', label: t('cat_plan') },
    { value: 'recurring', label: t('cat_recurring') },
    { value: 'custom', label: t('cat_custom') },
  ];

  const RECURRENCE_OPTIONS = [
    { value: 'none', label: t('recur_none') },
    { value: 'daily', label: t('recur_daily') },
    { value: 'weekly', label: t('recur_weekly') },
    { value: 'monthly', label: t('recur_monthly') },
    { value: 'yearly', label: t('recur_yearly') },
  ];

  const HABIT_CATEGORIES = [
    { value: 'water', label: t('habit_cat_water') },
    { value: 'food', label: t('habit_cat_food') },
    { value: 'medicine', label: t('habit_cat_medicine') },
    { value: 'exercise', label: t('habit_cat_exercise') },
    { value: 'reading', label: t('habit_cat_reading') },
    { value: 'meditation', label: t('habit_cat_meditation') },
    { value: 'custom', label: t('habit_cat_custom') },
  ];

  const HABIT_MODE_OPTIONS = [
    { value: 'interval', label: t('mode_interval') },
    { value: 'fixed', label: t('mode_fixed') },
  ];

  // ── Load data ──────────────────────────────────────────────────────

  const loadData = async () => {
    if (!user) return;
    try {
        // Request notification permissions on first load
        await requestNotificationPermissions();
        const today = new Date().toISOString().split('T')[0];
        const [svc, rfi, rem, dash, hab, habSum] = await Promise.all([
            getHomeServices(user.id),
            getRefillItems(user.id),
            getReminders(user.id, { upcoming: false }),
            getOrganizerDashboard(user.id),
            getHabits(user.id),
            getTodaysHabitsSummary(user.id),
        ]);
        await ensureHabitLogsForDate(user.id, today);
        setServices(svc);
        setRefillItems(rfi);
        setReminders(rem);
        setDashboardData(dash);
        setHabits(hab);
        setHabitsSummary(habSum);
    } catch (error) {
      console.error('Organizer load error:', error);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [user]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) =>
    '₹' + Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  // ── Service handlers ───────────────────────────────────────────────

  const openServiceModal = (service?: any) => {
    if (service) {
      setEditingService(service);
      setServiceForm({
        name: service.name, category: service.category,
        monthlyRate: String(service.monthly_rate),
        perVisitRate: String(service.per_visit_rate || ''),
        workingDays: service.working_days,
      });
    } else {
      setEditingService(null);
      setServiceForm({
        name: '', category: 'maid', monthlyRate: '',
        perVisitRate: '', workingDays: 'mon,tue,wed,thu,fri,sat',
      });
    }
    setServiceModal(true);
  };

  const handleSaveService = async () => {
    if (!serviceForm.name.trim()) { Alert.alert(t('error'), t('name_required')); return; }
    setServiceSaving(true);
    try {
      if (editingService) {
        await updateHomeService(editingService.id, user!.id, serviceForm.name.trim(), serviceForm.category, Number(serviceForm.monthlyRate) || 0, Number(serviceForm.perVisitRate) || 0, serviceForm.workingDays);
      } else {
        await createHomeService(user!.id, serviceForm.name.trim(), serviceForm.category, Number(serviceForm.monthlyRate) || 0, Number(serviceForm.perVisitRate) || 0, serviceForm.workingDays);
      }
      setServiceModal(false); await loadData();
    } catch (error) { Alert.alert(t('error'), (error as Error).message); }
    finally { setServiceSaving(false); }
  };

  const handleDeleteService = (id: number, name: string) => {
    Alert.alert(t('delete_service'), `"${name}" - ${t('delete_service_confirm')}`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => { await deleteHomeService(id, user!.id); await loadData(); } },
    ]);
  };

  // ── Refill item handlers ───────────────────────────────────────────

  const openRefillItemModal = (item?: any) => {
    if (item) {
      setEditingRefillItem(item);
      setRefillItemForm({ name: item.name, category: item.category, defaultPrice: String(item.default_price || ''), notes: item.notes || '' });
    } else {
      setEditingRefillItem(null);
      setRefillItemForm({ name: '', category: 'gas', defaultPrice: '', notes: '' });
    }
    setRefillItemModal(true);
  };

  const handleSaveRefillItem = async () => {
    if (!refillItemForm.name.trim()) { Alert.alert(t('error'), t('name_required')); return; }
    setRefillItemSaving(true);
    try {
      if (editingRefillItem) {
        await updateRefillItem(editingRefillItem.id, user!.id, refillItemForm.name.trim(), refillItemForm.category, Number(refillItemForm.defaultPrice) || 0, refillItemForm.notes);
      } else {
        await createRefillItem(user!.id, refillItemForm.name.trim(), refillItemForm.category, Number(refillItemForm.defaultPrice) || 0, refillItemForm.notes);
      }
      setRefillItemModal(false); await loadData();
    } catch (error) { Alert.alert(t('error'), (error as Error).message); }
    finally { setRefillItemSaving(false); }
  };

  const handleDeleteRefillItem = (id: number, name: string) => {
    Alert.alert(t('delete_refill_item'), `"${name}" - ${t('delete_refill_confirm')}`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => { await deleteRefillItem(id, user!.id); await loadData(); } },
    ]);
  };

  // ── Refill log handlers ────────────────────────────────────────────

  const openRefillLogModal = (itemId: number) => {
    const item = refillItems.find((ri) => ri.id === itemId);
    setRefillLogItemId(itemId);
    setRefillLogForm({ refillDate: new Date().toISOString().split('T')[0], amount: item?.default_price ? String(item.default_price) : '', notes: '' });
    setRefillLogModal(true);
  };

  const handleSaveRefillLog = async () => {
    if (!refillLogForm.amount || Number(refillLogForm.amount) <= 0) { Alert.alert(t('error'), t('payment_invalid')); return; }
    setRefillLogSaving(true);
    try {
      await createRefillLog(user!.id, refillLogItemId, refillLogForm.refillDate, Number(refillLogForm.amount), refillLogForm.notes);
      setRefillLogModal(false); await loadData();
    } catch (error) { Alert.alert(t('error'), (error as Error).message); }
    finally { setRefillLogSaving(false); }
  };

  // ── Reminder handlers ──────────────────────────────────────────────

  const openReminderModal = (reminder?: any) => {
    if (reminder) {
      setEditingReminder(reminder);
      setReminderForm({
        title: reminder.title, description: reminder.description || '',
        category: reminder.category, reminderDate: reminder.reminder_date,
        reminderTime: reminder.reminder_time || '09:00',
        recurrence: reminder.recurrence, recurrenceDay: reminder.recurrence_day ? String(reminder.recurrence_day) : '',
      });
    } else {
      setEditingReminder(null);
      setReminderForm({ title: '', description: '', category: 'custom', reminderDate: new Date().toISOString().split('T')[0], reminderTime: '09:00', recurrence: 'none', recurrenceDay: '' });
    }
    setReminderModal(true);
  };

  const handleSaveReminder = async () => {
    if (!reminderForm.title.trim()) { Alert.alert(t('error'), t('name_required')); return; }
    setReminderSaving(true);
    try {
      if (editingReminder) {
        await updateReminder(editingReminder.id, user!.id, reminderForm.title.trim(), reminderForm.description, reminderForm.category, reminderForm.reminderDate, reminderForm.reminderTime, reminderForm.recurrence, Number(reminderForm.recurrenceDay) || undefined);
      } else {
        await createReminder(user!.id, reminderForm.title.trim(), reminderForm.description, reminderForm.category, reminderForm.reminderDate, reminderForm.reminderTime, reminderForm.recurrence, Number(reminderForm.recurrenceDay) || undefined);
      }
      setReminderModal(false); 
      // Schedule push notification
        const savedReminders = await getReminders(user!.id);
        const savedReminder = savedReminders.find((r: any) => r.title === reminderForm.title.trim());
        if (savedReminder) {
        await scheduleReminderNotification(
            savedReminder.id,
            savedReminder.title,
            savedReminder.description || '',
            savedReminder.reminder_date,
            savedReminder.reminder_time,
            savedReminder.category,
            savedReminder.recurrence
        );
        }
      await loadData();
    } catch (error) { Alert.alert(t('error'), (error as Error).message); }
    finally { setReminderSaving(false); }
  };

  const handleMarkDone = async (id: number) => {
    try { await markReminderDone(id, user!.id); await loadData(); }
    catch (error) { Alert.alert(t('error'), (error as Error).message); }
  };

  const handleDeleteReminder = (id: number) => {
    Alert.alert(t('delete_reminder'), t('delete_reminder_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => { 
        await cancelReminderNotification(id);
        await deleteReminder(id, user!.id); 
        await loadData(); } },
    ]);
  };

  const handleTimePickerChange = (_: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (selectedDate) {
      const hours = String(selectedDate.getHours()).padStart(2, '0');
      const mins = String(selectedDate.getMinutes()).padStart(2, '0');
      setReminderForm({ ...reminderForm, reminderTime: `${hours}:${mins}` });
    }
  };

  // ── Habit handlers ─────────────────────────────────────────────────

  const openHabitModal = (habit?: any) => {
    if (habit) {
      setEditingHabit(habit);
      getHabitTimes(habit.id).then((times) => {
        setHabitForm({
          name: habit.name, category: habit.category, mode: habit.mode,
          intervalHours: String(habit.interval_hours || 2),
          startTime: habit.start_time || '08:00', endTime: habit.end_time || '20:00',
          fixedTimes: times.map((tm: any) => tm.reminder_time),
        });
      });
    } else {
      setEditingHabit(null);
      setHabitForm({ name: '', category: 'water', mode: 'interval', intervalHours: '2', startTime: '08:00', endTime: '20:00', fixedTimes: ['09:00', '12:00', '15:00', '18:00'] });
    }
    setHabitModal(true);
  };

  const handleSaveHabit = async () => {
    if (!habitForm.name.trim()) { Alert.alert(t('error'), t('name_required')); return; }
    setHabitSaving(true);
    try {
      if (editingHabit) {
        await updateHabit(editingHabit.id, user!.id, habitForm.name.trim(), habitForm.category, habitForm.mode, Number(habitForm.intervalHours) || 2, habitForm.startTime, habitForm.endTime, habitForm.fixedTimes);
      } else {
        await createHabit(user!.id, habitForm.name.trim(), habitForm.category, habitForm.mode, Number(habitForm.intervalHours) || 2, habitForm.startTime, habitForm.endTime, habitForm.fixedTimes);
      }
      setHabitModal(false); 
        const savedHabits = await getHabits(user!.id);
        const savedHabit = savedHabits.find((h: any) => h.name === habitForm.name.trim());
        if (savedHabit) {
        const habitTimes = await getHabitTimes(savedHabit.id);
        await scheduleHabitReminders(
            savedHabit.name,
            savedHabit.id,
            habitTimes.map((ht: any) => ht.reminder_time),
            savedHabit.category
        );
        }
      await loadData();
    } catch (error) { Alert.alert(t('error'), (error as Error).message); }
    finally { setHabitSaving(false); }
  };

  const handleDeleteHabit = (id: number, name: string) => {
    Alert.alert(t('delete_habit'), `"${name}" - ${t('delete_habit_confirm')}`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => 
        {
            await cancelHabitReminders(id); 
            await deleteHabit(id, user!.id); 
            await loadData(); 
        } },
    ]);
  };

  const handleToggleHabitTime = async (habitId: number, time: string) => {
    const today = new Date().toISOString().split('T')[0];
    try { await toggleHabitLog(user!.id, habitId, today, time); await loadData(); }
    catch (error) { Alert.alert(t('error'), (error as Error).message); }
  };

  const addFixedTime = () => {
    setHabitForm({ ...habitForm, fixedTimes: [...habitForm.fixedTimes, '12:00'] });
  };

  const removeFixedTime = (index: number) => {
    const times = [...habitForm.fixedTimes];
    times.splice(index, 1);
    setHabitForm({ ...habitForm, fixedTimes: times });
  };

  const handleHabitTimePickerChange = (_: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowHabitTimePicker(false);
    if (!selectedDate) return;
    const hours = String(selectedDate.getHours()).padStart(2, '0');
    const mins = String(selectedDate.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${mins}`;

    if (habitTimePickerTarget === 'start') {
      setHabitForm({ ...habitForm, startTime: timeStr });
    } else if (habitTimePickerTarget === 'end') {
      setHabitForm({ ...habitForm, endTime: timeStr });
    } else if (typeof habitTimePickerTarget === 'number') {
      const times = [...habitForm.fixedTimes];
      times[habitTimePickerTarget] = timeStr;
      setHabitForm({ ...habitForm, fixedTimes: times });
    }
  };
  
    // ── Render ──────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>

       <ScreenHeader emoji="📒"  title={t('tab_organizer')}
          subtitle={t('app_tagline')} >
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatPill emoji="🧹" label={t('active_services_label')} value={String(dashboardData?.activeServices || 0)} />
            <StatPill emoji="🔔" label={t('organizer_reminders')} value={String(dashboardData?.todaysReminders?.length || 0)} />
          </View>
      </ScreenHeader>

      {/* Tab Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { backgroundColor: isDark ? '#1e293b' : '#fff', borderBottomColor: theme.colors.border }]}
        contentContainerStyle={styles.tabBarContent}
      >
        {([
          { key: 'dashboard', label: t('tracker_dashboard'), emoji: '📊' },
          { key: 'habits', label: t('organizer_habits'), emoji: '💪' },
          { key: 'reminders', label: t('organizer_reminders'), emoji: '🔔' },
          { key: 'services', label: t('organizer_services'), emoji: '🧹' },
          { key: 'refills', label: t('organizer_refills'), emoji: '🔄' },
        ] as { key: Tab; label: string; emoji: string }[]).map((tab) => (
          <TouchableOpacity key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && [styles.tabItemActive, { borderBottomColor: theme.colors.primary }]]}
            onPress={() => setActiveTab(tab.key)}
          >
            <View style={styles.tabItemContent}>
              <Text style={styles.tabEmoji}>{tab.emoji}</Text>
              <Text style={[styles.tabItemText, { color: theme.colors.muted }, activeTab === tab.key && { color: theme.colors.primary, fontWeight: '700' }]}>
                {tab.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* ── DASHBOARD ────────────────────────────────────────────── */}
        {activeTab === 'dashboard' && dashboardData && (
          <>
            {/* Stats */}
            <View style={styles.statsGrid}>
              {[
                { emoji: '🧹', label: t('active_services_label'), value: String(dashboardData.activeServices), color: theme.colors.primary, bg: isDark ? '#1e3a5f' : '#eff6ff' },
                { emoji: '❌', label: t('month_absences'), value: String(dashboardData.monthAbsences), color: '#dc2626', bg: isDark ? '#450a0a' : '#fef2f2' },
                { emoji: '🔄', label: t('refill_items_label'), value: String(dashboardData.activeRefillItems), color: '#8b5cf6', bg: isDark ? '#2e1065' : '#f3e8ff' },
                { emoji: '🔔', label: t('organizer_reminders'), value: String(dashboardData.todaysReminders.length), color: '#d97706', bg: isDark ? '#451a03' : '#fffbeb' },
              ].map((item, i) => (
                <Card key={i} style={[styles.statCard, { backgroundColor: item.bg }]}>
                  <Text style={styles.statEmoji}>{item.emoji}</Text>
                  <Text style={[styles.statLabel, { color: theme.colors.muted }]}>{item.label}</Text>
                  <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
                </Card>
              ))}
            </View>

            {/* Habits Summary on Dashboard */}
            {habitsSummary && habitsSummary.totalHabits > 0 && (
              <Card style={[
                styles.section,
                {
                  backgroundColor: habitsSummary.completedHabits === habitsSummary.totalHabits
                    ? isDark ? '#064e3b' : '#ecfdf5'
                    : isDark ? '#1e3a5f' : '#eff6ff',
                  borderWidth: 1,
                  borderColor: habitsSummary.completedHabits === habitsSummary.totalHabits
                    ? '#059669' : theme.colors.border,
                },
              ]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  💪 {t('organizer_habits')} — {t('todays_progress')}
                </Text>
                <View style={styles.habitDashRow}>
                  <View style={styles.habitDashItem}>
                    <Text style={[styles.habitDashValue, { color: theme.colors.primary }]}>
                      {habitsSummary.completedHabits}/{habitsSummary.totalHabits}
                    </Text>
                    <Text style={[styles.habitDashLabel, { color: theme.colors.muted }]}>
                      {t('completed_label')}
                    </Text>
                  </View>
                  {habitsSummary.nextHabit && (
                    <View style={styles.habitDashItem}>
                      <Text style={[styles.habitDashValue, { color: '#d97706' }]}>
                        {formatTime12h(habitsSummary.nextHabit.nextTime)}
                      </Text>
                      <Text style={[styles.habitDashLabel, { color: theme.colors.muted }]}>
                        {t('next_reminder')}
                      </Text>
                    </View>
                  )}
                </View>
                {habitsSummary.completedHabits === habitsSummary.totalHabits && (
                  <Text style={[styles.allDoneText, { color: '#059669' }]}>{t('all_done')}</Text>
                )}
              </Card>
            )}

            {/* Today's Reminders */}
            {dashboardData.todaysReminders.length > 0 && (
              <Card style={[styles.section, { backgroundColor: isDark ? '#451a03' : '#fffbeb', borderWidth: 1, borderColor: isDark ? '#92400e' : '#fde68a' }]}>
                <Text style={[styles.sectionTitle, { color: '#d97706' }]}>
                  🔔 {t('todays_reminders')} ({dashboardData.todaysReminders.length})
                </Text>
                {dashboardData.todaysReminders.map((rem: any) => (
                  <View key={rem.id} style={[styles.reminderRow, { borderBottomColor: theme.colors.border }]}>
                    <Text style={styles.reminderEmoji}>{getReminderCategoryEmoji(rem.category)}</Text>
                    <View style={styles.reminderInfo}>
                      <Text style={[styles.reminderTitle, { color: theme.colors.text }]}>{rem.title}</Text>
                      <Text style={[styles.reminderDate, { color: theme.colors.muted }]}>🕐 {formatTime12h(rem.reminder_time)}</Text>
                    </View>
                    <TouchableOpacity style={[styles.doneBtn, { backgroundColor: '#059669' }]} onPress={() => handleMarkDone(rem.id)}>
                      <Text style={styles.doneBtnText}>✅</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </Card>
            )}

            {/* Upcoming Reminders */}
            {dashboardData.upcomingReminders.length > 0 && (
              <Card style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  📅 {t('upcoming_reminders')} ({dashboardData.upcomingReminders.length})
                </Text>
                {dashboardData.upcomingReminders.map((rem: any) => (
                  <View key={rem.id} style={[styles.reminderRow, { borderBottomColor: theme.colors.border }]}>
                    <Text style={styles.reminderEmoji}>{getReminderCategoryEmoji(rem.category)}</Text>
                    <View style={styles.reminderInfo}>
                      <Text style={[styles.reminderTitle, { color: theme.colors.text }]}>{rem.title}</Text>
                      <Text style={[styles.reminderDate, { color: theme.colors.muted }]}>
                        📅 {formatDateDisplay(rem.reminder_date)} • {formatTime12h(rem.reminder_time)}
                      </Text>
                    </View>
                    <Text style={[styles.daysLabel, { color: theme.colors.primary }]}>{daysUntil(rem.reminder_date)}d</Text>
                  </View>
                ))}
              </Card>
            )}

            {/* Services Summary */}
            {dashboardData.servicesWithAbsences.length > 0 && (
              <Card style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>🧹 {t('services_summary')}</Text>
                {dashboardData.servicesWithAbsences.map((svc: any) => (
                  <TouchableOpacity key={svc.id}
                    onPress={() => router.push({ pathname: '/organizer/service/[id]', params: { id: svc.id, serviceName: svc.name } })}
                    style={[styles.serviceSummaryRow, { borderBottomColor: theme.colors.border }]}
                  >
                    <Text style={styles.serviceEmoji}>{getCategoryEmoji(svc.category)}</Text>
                    <View style={styles.serviceInfo}>
                      <Text style={[styles.serviceName, { color: theme.colors.text }]}>{svc.name}</Text>
                      <Text style={[styles.serviceRate, { color: theme.colors.muted }]}>{formatCurrency(svc.monthly_rate)}/month</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      {svc.absences_this_month > 0 && (
                        <View style={[styles.absenceBadge, { backgroundColor: isDark ? '#450a0a' : '#fef2f2' }]}>
                          <Text style={styles.absenceBadgeText}>❌ {svc.absences_this_month}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </Card>
            )}

            {/* Recent Refills */}
            {dashboardData.recentRefills.length > 0 && (
              <Card style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>🔄 {t('recent_refills')}</Text>
                {dashboardData.recentRefills.map((ref: any) => (
                  <View key={ref.id} style={[styles.refillRow, { borderBottomColor: theme.colors.border }]}>
                    <Text style={styles.refillEmoji}>{getCategoryEmoji(ref.item_category)}</Text>
                    <View style={styles.refillInfo}>
                      <Text style={[styles.refillName, { color: theme.colors.text }]}>{ref.item_name}</Text>
                      <Text style={[styles.refillDate, { color: theme.colors.muted }]}>📅 {formatDateDisplay(ref.refill_date)}</Text>
                    </View>
                    <Text style={[styles.refillAmount, { color: '#059669' }]}>{formatCurrency(ref.amount)}</Text>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}

        {/* ── SERVICES TAB ─────────────────────────────────────────── */}
        {activeTab === 'services' && (
          <>
            {services.length === 0 ? (
              <Card>
                <EmptyState
                  emoji="🧹"
                  title={t('no_services_yet')}
                  actionHint={`+ ${t('add_service')}`}
                />
              </Card>
            ) : (
              services.map((svc) => (
                <TouchableOpacity key={svc.id}
                  onPress={() => router.push({ pathname: '/organizer/service/[id]', params: { id: svc.id, serviceName: svc.name } })}
                  activeOpacity={0.7}
                >
                  <Card style={styles.itemCard}>
                    <View style={styles.serviceCardRow}>
                      <View style={[styles.serviceIcon, { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }]}>
                        <Text style={styles.serviceIconText}>{getCategoryEmoji(svc.category)}</Text>
                      </View>
                      <View style={styles.serviceCardInfo}>
                        <Text style={[styles.serviceCardName, { color: theme.colors.text }]}>{svc.name}</Text>
                        <Text style={[styles.serviceCardRate, { color: theme.colors.primary }]}>
                          {formatCurrency(svc.monthly_rate)}/month
                          {svc.per_visit_rate > 0 ? ` • ${formatCurrency(svc.per_visit_rate)}/visit` : ''}
                        </Text>
                        <Text style={[styles.serviceCardMeta, { color: theme.colors.muted }]}>
                          ❌ {svc.current_month_absences || 0} {t('absences_this_month')}
                        </Text>
                      </View>
                      <View style={styles.actionBtns}>
                        <TouchableOpacity onPress={() => openServiceModal(svc)} style={[styles.editBtn, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}>
                          <Text>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteService(svc.id, svc.name)}>
                          <Text style={styles.deleteBtn}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={[styles.tapHint, { color: theme.colors.primary }]}>{t('view_calendar')} →</Text>
                  </Card>
                </TouchableOpacity>
              ))
            )}
            <Button title={`+ ${t('add_service')}`} onPress={() => openServiceModal()} style={styles.addBtn} />
          </>
        )}


        {/* ── REFILLS TAB ──────────────────────────────────────────── */}
        {activeTab === 'refills' && (
          <>
            {refillItems.length === 0 ? (
              <Card>
                <EmptyState
                  emoji="🔄"
                  title={t('no_refill_items')}
                  actionHint={`+ ${t('add_refill_item')}`}
                />
              </Card>
            ) : (
              refillItems.map((item) => (
                <Card key={item.id} style={styles.itemCard}>
                  <View style={styles.refillCardRow}>
                    <View style={[styles.refillIcon, { backgroundColor: isDark ? '#2e1065' : '#f3e8ff' }]}>
                      <Text style={styles.refillIconText}>{getCategoryEmoji(item.category)}</Text>
                    </View>
                    <View style={styles.refillCardInfo}>
                      <Text style={[styles.refillCardName, { color: theme.colors.text }]}>{item.name}</Text>
                      <Text style={[styles.refillCardMeta, { color: theme.colors.muted }]}>
                        {t('total_refills')}: {item.total_refills || 0} • {t('total_spent_label')}: {formatCurrency(item.total_spent || 0)}
                      </Text>
                      {item.last_refill_date && (
                        <Text style={[styles.refillCardMeta, { color: theme.colors.muted }]}>
                          {t('last_refill')}: {formatDateDisplay(item.last_refill_date)}
                        </Text>
                      )}
                    </View>
                    <View style={styles.actionBtns}>
                      <TouchableOpacity onPress={() => openRefillLogModal(item.id)}
                        style={[styles.logRefillBtn, { backgroundColor: '#059669' }]}
                      >
                        <Text style={styles.logRefillBtnText}>+ {t('log_refill')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.refillCardActions}>
                    <TouchableOpacity onPress={() => router.push({ pathname: '/organizer/refill/[id]', params: { id: item.id, itemName: item.name } })}>
                      <Text style={[styles.tapHint, { color: theme.colors.primary }]}>{t('refill_history')} →</Text>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <TouchableOpacity onPress={() => openRefillItemModal(item)}
                        style={[styles.editBtn, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}
                      ><Text>✏️</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteRefillItem(item.id, item.name)}>
                        <Text style={styles.deleteBtn}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              ))
            )}
            <Button title={`+ ${t('add_refill_item')}`} onPress={() => openRefillItemModal()} style={styles.addBtn} />
          </>
        )}

        {/* ── REMINDERS TAB ────────────────────────────────────────── */}
        {activeTab === 'reminders' && (
          <>
            {reminders.length === 0 ? (
              <Card>
                <EmptyState
                  emoji="🔔"
                  title={t('no_reminders')}
                  actionHint={`+ ${t('add_reminder')}`}
                />
              </Card>
            ) : (
              reminders.map((rem) => {
                const overdue = isOverdue(rem.reminder_date);
                const today = isToday(rem.reminder_date);
                return (
                  <Card key={rem.id} style={[
                    styles.itemCard,
                    overdue && { borderWidth: 1, borderColor: '#dc2626' },
                    today && { borderWidth: 1, borderColor: '#d97706' },
                  ]}>
                    <View style={styles.reminderCardRow}>
                      <View style={[
                        styles.reminderIcon,
                        {
                          backgroundColor: overdue
                            ? isDark ? '#450a0a' : '#fef2f2'
                            : today
                            ? isDark ? '#451a03' : '#fffbeb'
                            : isDark ? '#1e3a5f' : '#eff6ff',
                        },
                      ]}>
                        <Text style={styles.reminderIconText}>
                          {getReminderCategoryEmoji(rem.category)}
                        </Text>
                      </View>
                      <View style={styles.reminderCardInfo}>
                        <Text style={[styles.reminderCardTitle, { color: theme.colors.text }]}>{rem.title}</Text>
                        {rem.description && (
                          <Text style={[styles.reminderCardDesc, { color: theme.colors.muted }]}>{rem.description}</Text>
                        )}
                        <Text style={[styles.reminderCardDate, { color: theme.colors.muted }]}>
                          📅 {formatDateDisplay(rem.reminder_date)} • 🕐 {formatTime12h(rem.reminder_time)}
                        </Text>
                        {rem.recurrence !== 'none' && (
                          <View style={[styles.recurrenceBadge, { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }]}>
                            <Text style={[styles.recurrenceBadgeText, { color: theme.colors.primary }]}>
                              🔄 {RECURRENCE_OPTIONS.find((r) => r.value === rem.recurrence)?.label || rem.recurrence}
                            </Text>
                          </View>
                        )}
                        {overdue && (
                          <Text style={styles.overdueText}>⚠️ {t('overdue')}</Text>
                        )}
                      </View>
                      <View style={styles.reminderCardActions}>
                        <TouchableOpacity
                          style={[styles.doneBtn, { backgroundColor: '#059669' }]}
                          onPress={() => handleMarkDone(rem.id)}
                        >
                          <Text style={styles.doneBtnText}>✅</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openReminderModal(rem)}
                          style={[styles.editBtn, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}
                        ><Text>✏️</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteReminder(rem.id)}>
                          <Text style={styles.deleteBtn}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Card>
                );
              })
            )}
            <Button title={`+ ${t('add_reminder')}`} onPress={() => openReminderModal()} style={styles.addBtn} />
          </>
        )}		
		
		
	        {/* ── HABITS TAB ───────────────────────────────────────────── */}
        {activeTab === 'habits' && (
          <>
            {/* Today's Summary */}
            {habitsSummary && habitsSummary.habits.length > 0 && (
              <Card style={[
                styles.habitSummaryCard,
                {
                  backgroundColor: habitsSummary.completedHabits === habitsSummary.totalHabits && habitsSummary.totalHabits > 0
                    ? isDark ? '#064e3b' : '#ecfdf5'
                    : isDark ? '#1e3a5f' : '#eff6ff',
                  borderWidth: 1,
                  borderColor: habitsSummary.completedHabits === habitsSummary.totalHabits && habitsSummary.totalHabits > 0
                    ? '#059669' : theme.colors.border,
                },
              ]}>
                <Text style={[styles.habitSummaryTitle, { color: theme.colors.text }]}>
                  📊 {t('todays_progress')}
                </Text>
                <View style={styles.habitSummaryRow}>
                  <View style={styles.habitSummaryItem}>
                    <Text style={[styles.habitSummaryValue, { color: theme.colors.primary }]}>
                      {habitsSummary.completedHabits}/{habitsSummary.totalHabits}
                    </Text>
                    <Text style={[styles.habitSummaryLabel, { color: theme.colors.muted }]}>
                      {t('completed_label')}
                    </Text>
                  </View>
                  {habitsSummary.nextHabit && (
                    <View style={styles.habitSummaryItem}>
                      <Text style={[styles.habitSummaryValue, { color: '#d97706' }]}>
                        {formatTime12h(habitsSummary.nextHabit.nextTime)}
                      </Text>
                      <Text style={[styles.habitSummaryLabel, { color: theme.colors.muted }]}>
                        {t('next_reminder')}
                      </Text>
                    </View>
                  )}
                </View>
                {habitsSummary.completedHabits === habitsSummary.totalHabits && habitsSummary.totalHabits > 0 && (
                  <Text style={[styles.allDoneText, { color: '#059669' }]}>{t('all_done')}</Text>
                )}
              </Card>
            )}

            {/* Habits List */}
            {habits.length === 0 ? (
              <Card>
                <EmptyState
                  emoji="💪"
                  title={t('no_habits_yet')}
                  actionHint={`+ ${t('add_habit')}`}
                />
              </Card>
            ) : (
              habits.map((habit) => {
                const habitData = habitsSummary?.habits.find((h: any) => h.id === habit.id);
                const doneCount = habitData?.done_count || 0;
                const totalTimes = habitData?.total_times || 0;
                const isComplete = doneCount >= totalTimes && totalTimes > 0;

                return (
                  <Card key={habit.id} style={[
                    styles.habitCard,
                    isComplete && { borderWidth: 1, borderColor: '#059669' },
                  ]}>
                    <View style={styles.habitCardHeader}>
                      <View style={[
                        styles.habitIcon,
                        {
                          backgroundColor: isComplete
                            ? isDark ? '#064e3b' : '#ecfdf5'
                            : isDark ? '#1e3a5f' : '#eff6ff',
                        },
                      ]}>
                        <Text style={styles.habitIconText}>{getHabitEmoji(habit.category)}</Text>
                      </View>
                      <View style={styles.habitCardInfo}>
                        <Text style={[styles.habitCardName, { color: theme.colors.text }]}>
                          {habit.name}
                        </Text>
                        <Text style={[styles.habitCardProgress, { color: theme.colors.muted }]}>
                          {isComplete ? '✅ ' : ''}{doneCount}/{totalTimes} {t('completed_label')}
                        </Text>
                        <View style={[styles.progressBar, { backgroundColor: isDark ? '#334155' : '#f3f4f6' }]}>
                          <View style={[
                            styles.progressFill,
                            {
                              width: `${totalTimes > 0 ? (doneCount / totalTimes) * 100 : 0}%`,
                              backgroundColor: isComplete ? '#059669' : theme.colors.primary,
                            },
                          ]} />
                        </View>
                      </View>
                      <View style={styles.actionBtns}>
                        <TouchableOpacity
                          onPress={() => openHabitModal(habit)}
                          style={[styles.editBtn, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}
                        ><Text>✏️</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteHabit(habit.id, habit.name)}>
                          <Text style={styles.deleteBtn}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Time Slots */}
                    <HabitTimeSlots
                      habitId={habit.id}
                      userId={user!.id}
                      theme={theme}
                      isDark={isDark}
                      onToggle={handleToggleHabitTime}
                      formatTime={formatTime12h}
                    />
                  </Card>
                );
              })
            )}
            <Button title={`+ ${t('add_habit')}`} onPress={() => openHabitModal()} style={styles.addBtn} />
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Service Modal ──────────────────────────────────────────── */}
      <Modal visible={serviceModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <ScrollView style={[styles.modalScrollContent, { backgroundColor: theme.colors.modalBg }]} bounces={false}>
            <View style={styles.modalInner}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {editingService ? t('edit_service') : t('add_service')}
              </Text>
              <Input label={`${t('service_name')} *`} value={serviceForm.name} onChangeText={(v) => setServiceForm({ ...serviceForm, name: v })} placeholder={t('service_name')} />
              <Select label={t('service_category')} value={serviceForm.category} onChange={(v) => setServiceForm({ ...serviceForm, category: String(v) })} options={SERVICE_CATEGORIES} />
              <Input label={t('monthly_rate_label')} value={serviceForm.monthlyRate} onChangeText={(v) => setServiceForm({ ...serviceForm, monthlyRate: v })} placeholder="e.g., 5000" keyboardType="numeric" />
              <Input label={t('per_visit_rate_label')} value={serviceForm.perVisitRate} onChangeText={(v) => setServiceForm({ ...serviceForm, perVisitRate: v })} placeholder="e.g., 200" keyboardType="numeric" />
              <Select label={t('working_days_label')} value={serviceForm.workingDays} onChange={(v) => setServiceForm({ ...serviceForm, workingDays: String(v) })} options={WORKING_DAYS_OPTIONS} />
              <View style={styles.modalButtons}>
                <Button title={t('cancel')} variant="secondary" onPress={() => setServiceModal(false)} />
                <Button title={t('save')} onPress={handleSaveService} loading={serviceSaving} />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Refill Item Modal ──────────────────────────────────────── */}
      <Modal visible={refillItemModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.modalBg }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {editingRefillItem ? t('edit_refill_item') : t('add_refill_item')}
            </Text>
            <Input label={`${t('name')} *`} value={refillItemForm.name} onChangeText={(v) => setRefillItemForm({ ...refillItemForm, name: v })} placeholder={t('name')} />
            <Select label={t('service_category')} value={refillItemForm.category} onChange={(v) => setRefillItemForm({ ...refillItemForm, category: String(v) })} options={REFILL_CATEGORIES} />
            <Input label={t('refill_amount_label')} value={refillItemForm.defaultPrice} onChangeText={(v) => setRefillItemForm({ ...refillItemForm, defaultPrice: v })} placeholder="e.g., 900" keyboardType="numeric" />
            <Input label={t('notes')} value={refillItemForm.notes} onChangeText={(v) => setRefillItemForm({ ...refillItemForm, notes: v })} placeholder={t('optional')} />
            <View style={styles.modalButtons}>
              <Button title={t('cancel')} variant="secondary" onPress={() => setRefillItemModal(false)} />
              <Button title={t('save')} onPress={handleSaveRefillItem} loading={refillItemSaving} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Refill Log Modal ───────────────────────────────────────── */}
      <Modal visible={refillLogModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.modalBg }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>🔄 {t('log_refill')}</Text>
            <DatePicker label={t('refill_date_label')} value={refillLogForm.refillDate} onChange={(d) => setRefillLogForm({ ...refillLogForm, refillDate: d })} />
            <Input label={t('refill_amount_label')} value={refillLogForm.amount} onChangeText={(v) => setRefillLogForm({ ...refillLogForm, amount: v })} placeholder="0" keyboardType="numeric" />
            <Input label={t('notes')} value={refillLogForm.notes} onChangeText={(v) => setRefillLogForm({ ...refillLogForm, notes: v })} placeholder={t('optional')} />
            <View style={styles.modalButtons}>
              <Button title={t('cancel')} variant="secondary" onPress={() => setRefillLogModal(false)} />
              <Button title={t('save')} variant="success" onPress={handleSaveRefillLog} loading={refillLogSaving} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Reminder Modal ─────────────────────────────────────────── */}
      <Modal visible={reminderModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <ScrollView style={[styles.modalScrollContent, { backgroundColor: theme.colors.modalBg }]} bounces={false}>
            <View style={styles.modalInner}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {editingReminder ? t('edit_reminder') : t('add_reminder')}
              </Text>
              <Input label={`${t('reminder_title')} *`} value={reminderForm.title} onChangeText={(v) => setReminderForm({ ...reminderForm, title: v })} placeholder={t('reminder_title')} />
              <Input label={t('reminder_description')} value={reminderForm.description} onChangeText={(v) => setReminderForm({ ...reminderForm, description: v })} placeholder={t('optional')} />
              <Select label={t('reminder_category_label')} value={reminderForm.category} onChange={(v) => setReminderForm({ ...reminderForm, category: String(v) })} options={REMINDER_CATEGORIES} />
              <DatePicker label={t('reminder_date_label')} value={reminderForm.reminderDate} onChange={(d) => setReminderForm({ ...reminderForm, reminderDate: d })} />
              <View style={styles.timePickerRow}>
                <Text style={[styles.timePickerLabel, { color: theme.colors.textSecondary }]}>{t('reminder_time_label')}</Text>
                <TouchableOpacity
                  style={[styles.timePickerBtn, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.inputBorder }]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={[styles.timePickerValue, { color: theme.colors.text }]}>🕐 {formatTime12h(reminderForm.reminderTime)}</Text>
                </TouchableOpacity>
              </View>
              <Select label={t('recurrence_label')} value={reminderForm.recurrence} onChange={(v) => setReminderForm({ ...reminderForm, recurrence: String(v) })} options={RECURRENCE_OPTIONS} />
              <View style={styles.modalButtons}>
                <Button title={t('cancel')} variant="secondary" onPress={() => setReminderModal(false)} />
                <Button title={t('save')} onPress={handleSaveReminder} loading={reminderSaving} />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Reminder Time Picker ───────────────────────────────────── */}
      {showTimePicker && Platform.OS === 'android' && (
        <DateTimePicker value={parseTimeToDate(reminderForm.reminderTime)} mode="time" is24Hour={false} display="default" onChange={handleTimePickerChange} />
      )}
      {showTimePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade">
          <TouchableOpacity style={[styles.pickerOverlay, { backgroundColor: theme.colors.overlay }]} activeOpacity={1} onPress={() => setShowTimePicker(false)}>
            <View style={[styles.pickerContent, { backgroundColor: theme.colors.modalBg }]}>
              <View style={[styles.pickerHeader, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.pickerTitle, { color: theme.colors.text }]}>{t('reminder_time_label')}</Text>
                <TouchableOpacity onPress={() => setShowTimePicker(false)} style={[styles.pickerDoneBtn, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.pickerDoneBtnText}>{t('done')}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker value={parseTimeToDate(reminderForm.reminderTime)} mode="time" is24Hour={false} display="spinner" onChange={handleTimePickerChange} style={{ height: 200 }} />
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* ── Habit Modal ────────────────────────────────────────────── */}
      <Modal visible={habitModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <ScrollView style={[styles.modalScrollContent, { backgroundColor: theme.colors.modalBg }]} bounces={false}>
            <View style={styles.modalInner}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {editingHabit ? t('edit_habit') : t('add_habit')}
              </Text>

              <Input label={`${t('habit_name')} *`} value={habitForm.name} onChangeText={(v) => setHabitForm({ ...habitForm, name: v })} placeholder={t('habit_name')} />
              <Select label={t('habit_category')} value={habitForm.category} onChange={(v) => setHabitForm({ ...habitForm, category: String(v) })} options={HABIT_CATEGORIES} />
              <Select label={t('habit_mode')} value={habitForm.mode} onChange={(v) => setHabitForm({ ...habitForm, mode: String(v) })} options={HABIT_MODE_OPTIONS} />

              {/* Interval Mode */}
              {habitForm.mode === 'interval' && (
                <View style={[styles.modeSection, { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: theme.colors.border }]}>
                  <Text style={[styles.modeSectionTitle, { color: theme.colors.text }]}>⏱️ {t('mode_interval')}</Text>
                  <Input label={t('interval_hours')} value={habitForm.intervalHours} onChangeText={(v) => setHabitForm({ ...habitForm, intervalHours: v })} placeholder="2" keyboardType="numeric" />
                  <View style={styles.timeRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.timeLabel, { color: theme.colors.muted }]}>{t('start_time_label')}</Text>
                      <TouchableOpacity
                        style={[styles.timeBtn, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.inputBorder }]}
                        onPress={() => { setHabitTimePickerTarget('start'); setShowHabitTimePicker(true); }}
                      >
                        <Text style={[styles.timeBtnText, { color: theme.colors.text }]}>🕐 {formatTime12h(habitForm.startTime)}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.timeLabel, { color: theme.colors.muted }]}>{t('end_time_label')}</Text>
                      <TouchableOpacity
                        style={[styles.timeBtn, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.inputBorder }]}
                        onPress={() => { setHabitTimePickerTarget('end'); setShowHabitTimePicker(true); }}
                      >
                        <Text style={[styles.timeBtnText, { color: theme.colors.text }]}>🕐 {formatTime12h(habitForm.endTime)}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* Fixed Times Mode */}
              {habitForm.mode === 'fixed' && (
                <View style={[styles.modeSection, { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: theme.colors.border }]}>
                  <Text style={[styles.modeSectionTitle, { color: theme.colors.text }]}>🕐 {t('fixed_times')}</Text>
                  {habitForm.fixedTimes.map((time, index) => (
                    <View key={index} style={styles.fixedTimeRow}>
                      <TouchableOpacity
                        style={[styles.fixedTimeBtn, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.inputBorder }]}
                        onPress={() => { setHabitTimePickerTarget(index); setShowHabitTimePicker(true); }}
                      >
                        <Text style={[styles.fixedTimeBtnText, { color: theme.colors.text }]}>🕐 {formatTime12h(time)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => removeFixedTime(index)}
                        style={[styles.removeTimeBtn, { backgroundColor: isDark ? '#450a0a' : '#fef2f2' }]}
                      >
                        <Text style={styles.removeTimeBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[styles.addTimeBtn, { borderColor: theme.colors.primary }]}
                    onPress={addFixedTime}
                  >
                    <Text style={[styles.addTimeBtnText, { color: theme.colors.primary }]}>{t('add_time')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.modalButtons}>
                <Button title={t('cancel')} variant="secondary" onPress={() => setHabitModal(false)} />
                <Button title={t('save')} onPress={handleSaveHabit} loading={habitSaving} />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Habit Time Picker ──────────────────────────────────────── */}
      {showHabitTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={parseTimeToDate(
            habitTimePickerTarget === 'start' ? habitForm.startTime
              : habitTimePickerTarget === 'end' ? habitForm.endTime
              : habitForm.fixedTimes[habitTimePickerTarget as number] || '12:00'
          )}
          mode="time" is24Hour={false} display="default"
          onChange={handleHabitTimePickerChange}
        />
      )}
      {showHabitTimePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade">
          <TouchableOpacity
            style={[styles.pickerOverlay, { backgroundColor: theme.colors.overlay }]}
            activeOpacity={1} onPress={() => setShowHabitTimePicker(false)}
          >
            <View style={[styles.pickerContent, { backgroundColor: theme.colors.modalBg }]}>
              <View style={[styles.pickerHeader, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.pickerTitle, { color: theme.colors.text }]}>{t('reminder_time_label')}</Text>
                <TouchableOpacity onPress={() => setShowHabitTimePicker(false)} style={[styles.pickerDoneBtn, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.pickerDoneBtnText}>{t('done')}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={parseTimeToDate(
                  habitTimePickerTarget === 'start' ? habitForm.startTime
                    : habitTimePickerTarget === 'end' ? habitForm.endTime
                    : habitForm.fixedTimes[habitTimePickerTarget as number] || '12:00'
                )}
                mode="time" is24Hour={false} display="spinner"
                onChange={handleHabitTimePickerChange}
                style={{ height: 200 }}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Tab bar
  tabBar: { flexGrow: 0, borderBottomWidth: 1 },
  tabBarContent: { paddingHorizontal: 8 },
  tabItem: { paddingHorizontal: 12, paddingVertical: 12, marginHorizontal: 4 },
  tabItemActive: { borderBottomWidth: 2 },
  tabItemContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tabEmoji: { fontSize: 14 },
  tabItemText: { fontSize: 13, fontWeight: '500' },
  content: { flex: 1, padding: 16 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  statCard: { width: '47%', padding: 14, alignItems: 'center' },
  statEmoji: { fontSize: 22, marginBottom: 4 },
  statLabel: { fontSize: 10, textAlign: 'center', marginBottom: 2 },
  statValue: { fontSize: 16, fontWeight: '800' },

  // Section
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 14 },
  empty: { textAlign: 'center', padding: 20 },

  // Service summary
  serviceSummaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  serviceEmoji: { fontSize: 22, marginRight: 12 },
  serviceInfo: { flex: 1 },
  serviceName: { fontSize: 14, fontWeight: '600' },
  serviceRate: { fontSize: 12, marginTop: 2 },
  absenceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  absenceBadgeText: { fontSize: 11, fontWeight: '700', color: '#dc2626' },

  // Service cards
  itemCard: { marginBottom: 12 },
  serviceCardRow: { flexDirection: 'row', alignItems: 'center' },
  serviceIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  serviceIconText: { fontSize: 24 },
  serviceCardInfo: { flex: 1 },
  serviceCardName: { fontSize: 15, fontWeight: '600' },
  serviceCardRate: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  serviceCardMeta: { fontSize: 11, marginTop: 2 },
  tapHint: { fontSize: 12, marginTop: 8, fontWeight: '500' },

  // Refill rows
  refillRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  refillEmoji: { fontSize: 20, marginRight: 12 },
  refillInfo: { flex: 1 },
  refillName: { fontSize: 14, fontWeight: '600' },
  refillDate: { fontSize: 11, marginTop: 2 },
  refillAmount: { fontSize: 16, fontWeight: '800' },

  // Refill cards
  refillCardRow: { flexDirection: 'row', alignItems: 'center' },
  refillIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  refillIconText: { fontSize: 24 },
  refillCardInfo: { flex: 1 },
  refillCardName: { fontSize: 15, fontWeight: '600' },
  refillCardMeta: { fontSize: 11, marginTop: 2 },
  refillCardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  logRefillBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  logRefillBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Reminder rows
  reminderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  reminderEmoji: { fontSize: 20, marginRight: 12 },
  reminderInfo: { flex: 1 },
  reminderTitle: { fontSize: 14, fontWeight: '600' },
  reminderDate: { fontSize: 11, marginTop: 2 },
  daysLabel: { fontSize: 14, fontWeight: '800' },

  // Reminder cards
  reminderCardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  reminderIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  reminderIconText: { fontSize: 22 },
  reminderCardInfo: { flex: 1 },
  reminderCardTitle: { fontSize: 15, fontWeight: '600' },
  reminderCardDesc: { fontSize: 12, marginTop: 2 },
  reminderCardDate: { fontSize: 11, marginTop: 4 },
  reminderCardActions: { gap: 6, alignItems: 'center' },
  recurrenceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 6, alignSelf: 'flex-start' },
  recurrenceBadgeText: { fontSize: 11, fontWeight: '600' },
  overdueText: { color: '#dc2626', fontSize: 12, fontWeight: '700', marginTop: 4 },
  doneBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  doneBtnText: { fontSize: 16 },

  // Habit summary
  habitSummaryCard: { marginBottom: 16, padding: 16 },
  habitSummaryTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  habitSummaryRow: { flexDirection: 'row', gap: 16 },
  habitSummaryItem: { flex: 1, alignItems: 'center' },
  habitSummaryValue: { fontSize: 22, fontWeight: '800' },
  habitSummaryLabel: { fontSize: 11, marginTop: 2 },
  allDoneText: { textAlign: 'center', fontSize: 16, fontWeight: '700', marginTop: 12 },

  // Habit dashboard
  habitDashRow: { flexDirection: 'row', gap: 16 },
  habitDashItem: { flex: 1, alignItems: 'center' },
  habitDashValue: { fontSize: 20, fontWeight: '800' },
  habitDashLabel: { fontSize: 11, marginTop: 2 },

  // Habit cards
  habitCard: { marginBottom: 12 },
  habitCardHeader: { flexDirection: 'row', alignItems: 'center' },
  habitIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  habitIconText: { fontSize: 22 },
  habitCardInfo: { flex: 1 },
  habitCardName: { fontSize: 15, fontWeight: '600' },
  habitCardProgress: { fontSize: 12, marginTop: 2 },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  progressFill: { height: '100%', borderRadius: 3 },

  // Habit modal
  modeSection: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16 },
  modeSectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  timeRow: { flexDirection: 'row', gap: 10 },
  timeLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  timeBtn: { borderWidth: 1.3, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center' },
  timeBtnText: { fontSize: 14, fontWeight: '600' },
  fixedTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  fixedTimeBtn: { flex: 1, borderWidth: 1.3, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center' },
  fixedTimeBtnText: { fontSize: 14, fontWeight: '600' },
  removeTimeBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  removeTimeBtnText: { fontSize: 14, fontWeight: '700', color: '#dc2626' },
  addTimeBtn: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  addTimeBtnText: { fontSize: 14, fontWeight: '600' },

  // Actions
  actionBtns: { flexDirection: 'row', gap: 4, marginLeft: 8 },
  editBtn: { padding: 6, borderRadius: 6 },
  deleteBtn: { fontSize: 18, padding: 4 },
  addBtn: { marginTop: 8, marginBottom: 8 },

  // Time picker
  timePickerRow: { marginBottom: 16 },
  timePickerLabel: { fontSize: 13, fontWeight: '800', marginBottom: 7 },
  timePickerBtn: { borderWidth: 1.3, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14 },
  timePickerValue: { fontSize: 15, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalScrollContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  modalInner: { padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },

  // Picker
  pickerOverlay: { flex: 1, justifyContent: 'flex-end' },
  pickerContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  pickerTitle: { fontSize: 16, fontWeight: '600' },
  pickerDoneBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  pickerDoneBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});	