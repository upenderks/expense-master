import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ── Configure notification behavior ──────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Request permissions ──────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permission denied');
      return false;
    }

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

// ── Schedule a one-time notification ─────────────────────────────────────

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
        title,
        body,
        sound: 'default',
        data: data || {},
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

// ── Schedule daily habit reminders ───────────────────────────────────────

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

// ── Cancel habit reminders ───────────────────────────────────────────────

export async function cancelHabitReminders(habitId: number): Promise<void> {
  try {
    const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of allNotifications) {
      if (
        notification.content.data?.type === 'habit' &&
        notification.content.data?.habitId === habitId
      ) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  } catch (error) {
    console.error('Cancel habit reminders error:', error);
  }
}

// ── Schedule a reminder notification ─────────────────────────────────────

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

    const notificationContent = {
      title: `${emoji} ${title}`,
      body: description || `Reminder: ${title}`,
      sound: 'default' as const,
      data: { type: 'reminder', reminderId },
      ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
    };

    if (recurrence === 'none') {
      // One-time
      const dateObj = new Date(reminderDate);
      dateObj.setHours(hours, minutes, 0, 0);

      if (dateObj.getTime() > Date.now()) {
        await Notifications.scheduleNotificationAsync({
          content: notificationContent,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: dateObj,
          },
        });
      }
    } else if (recurrence === 'daily') {
      await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hours,
          minute: minutes,
        },
      });
    } else if (recurrence === 'weekly') {
      const dayOfWeek = new Date(reminderDate).getDay() + 1; // 1=Sun, 7=Sat
      await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: dayOfWeek,
          hour: hours,
          minute: minutes,
        },
      });
    } else if (recurrence === 'monthly') {
      // Monthly — schedule as one-time, re-schedule when marked done
      const dateObj = new Date(reminderDate);
      dateObj.setHours(hours, minutes, 0, 0);

      if (dateObj.getTime() > Date.now()) {
        await Notifications.scheduleNotificationAsync({
          content: notificationContent,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: dateObj,
          },
        });
      }
    } else if (recurrence === 'yearly') {
      // Yearly — schedule as one-time, re-schedule when marked done
      const dateObj = new Date(reminderDate);
      dateObj.setHours(hours, minutes, 0, 0);

      if (dateObj.getTime() > Date.now()) {
        await Notifications.scheduleNotificationAsync({
          content: notificationContent,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: dateObj,
          },
        });
      }
    }
  } catch (error) {
    console.error('Schedule reminder notification error:', error);
  }
}

// ── Cancel reminder notification ─────────────────────────────────────────

export async function cancelReminderNotification(reminderId: number): Promise<void> {
  try {
    const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of allNotifications) {
      if (
        notification.content.data?.type === 'reminder' &&
        notification.content.data?.reminderId === reminderId
      ) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  } catch (error) {
    console.error('Cancel reminder notification error:', error);
  }
}

// ── Cancel all notifications ─────────────────────────────────────────────

export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Cancel all notifications error:', error);
  }
}

// ── Get scheduled notifications count ────────────────────────────────────

export async function getScheduledCount(): Promise<number> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all.length;
  } catch {
    return 0;
  }
}