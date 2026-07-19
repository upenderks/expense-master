import { Platform } from 'react-native';

// ── expo-notifications is disabled in Expo Go ─────────────────────────────
// It will be enabled when building real APK via EAS Build
// For now all functions are safe no-ops

console.log('ℹ️ Push notifications disabled in Expo Go. Will work in real APK build.');

export async function requestNotificationPermissions(): Promise<boolean> {
  return false;
}

export async function scheduleNotification(
  title: string,
  body: string,
  date: Date,
  channelId: string = 'default',
  data?: Record<string, any>
): Promise<string | null> {
  return null;
}

export async function scheduleHabitReminders(
  habitName: string,
  habitId: number,
  times: string[],
  category: string
): Promise<void> {
  // Will work in real APK build
  return;
}

export async function cancelHabitReminders(habitId: number): Promise<void> {
  return;
}

export async function scheduleReminderNotification(
  reminderId: number,
  title: string,
  description: string,
  reminderDate: string,
  reminderTime: string,
  category: string,
  recurrence: string
): Promise<void> {
  return;
}

export async function cancelReminderNotification(reminderId: number): Promise<void> {
  return;
}

export async function cancelAllNotifications(): Promise<void> {
  return;
}

export async function getScheduledCount(): Promise<number> {
  return 0;
}