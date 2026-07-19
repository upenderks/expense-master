// src/lib/notificationService.production.ts
// USE THIS WHEN BUILDING REAL APK

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
      await Notifications.setNotificationChannelAsync('habits', {
        name: 'Habits',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250],
        sound: 'default',
      });
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }
    return true;
  } catch (error) {
    console.error('Notification permission error:', error);
    return false;
  }
}

export async function scheduleNotification(
  title: string,
  body: string,
  date: Date,
  channelId: string = 'default',
  data?: Record<string, any>
): Promise<string | null> {
  try {
    if (date.getTime() <= Date.now()) return null;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title, body, sound: 'default', data: data || {},
        ...(Platform.OS === 'android' ? { channelId } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    });
    return id;
  } catch (error) {
    console.error('Schedule notification error:', error);
    return null;
  }
}

export async function scheduleHabitReminders(
  habitName: string,
  habitId: number,
  times: string[],
  category: string
): Promise<void> {
  try {
    await cancelHabitReminders(habitId);
    const emojis: Record<string, string> = {
      water: '💧', food: '🍽️', medicine: '💊',
      exercise: '🏃', reading: '📖', meditation: '🧘',
    };
    const emoji = emojis[category] || '🔔';
    for (const time of times) {
      const [hours, minutes] = time.split(':').map(Number);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${emoji} ${habitName}`,
          body: `Time for your ${habitName}!`,
          sound: 'default',
          data: { type: 'habit', habitId },
          ...(Platform.OS === 'android' ? { channelId: 'habits' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hours,
          minute: minutes,
        },
      });
    }
  } catch (error) {
    console.error('Schedule habit reminders error:', error);
  }
}

export async function cancelHabitReminders(habitId: number): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n.content.data?.type === 'habit' && n.content.data?.habitId === habitId) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch (error) {
    console.error('Cancel habit reminders error:', error);
  }
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
  try {
    await cancelReminderNotification(reminderId);
    const emojis: Record<string, string> = {
      birthday: '🎂', anniversary: '🎊', bill: '💳',
      plan: '📋', recurring: '🔄', custom: '🔔',
    };
    const emoji = emojis[category] || '🔔';
    const [hours, minutes] = (reminderTime || '09:00').split(':').map(Number);
    const content = {
      title: `${emoji} ${title}`,
      body: description || `Reminder: ${title}`,
      sound: 'default' as const,
      data: { type: 'reminder', reminderId },
      ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
    };

    if (recurrence === 'none') {
      const dateObj = new Date(reminderDate);
      dateObj.setHours(hours, minutes, 0, 0);
      if (dateObj.getTime() > Date.now()) {
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dateObj },
        });
      }
    } else if (recurrence === 'daily') {
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: hours, minute: minutes },
      });
    } else if (recurrence === 'weekly') {
      const dayOfWeek = new Date(reminderDate).getDay() + 1;
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: dayOfWeek, hour: hours, minute: minutes },
      });
    } else {
      const dateObj = new Date(reminderDate);
      dateObj.setHours(hours, minutes, 0, 0);
      if (dateObj.getTime() > Date.now()) {
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dateObj },
        });
      }
    }
  } catch (error) {
    console.error('Schedule reminder notification error:', error);
  }
}

export async function cancelReminderNotification(reminderId: number): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n.content.data?.type === 'reminder' && n.content.data?.reminderId === reminderId) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch (error) {
    console.error('Cancel reminder notification error:', error);
  }
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Cancel all notifications error:', error);
  }
}

export async function getScheduledCount(): Promise<number> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all.length;
  } catch {
    return 0;
  }
}