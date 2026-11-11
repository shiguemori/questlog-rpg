import type { ReminderTime } from '../domain/types';

export type ReminderSync = 'SCHEDULED' | 'CLEARED' | 'UNAVAILABLE';

const BODY = 'Uma quest fecha a meta de hoje. Sem pressa, sem spam.';

/**
 * Um lembrete local por dia, no horário escolhido. Sem backend.
 * Se o Expo Go não entregar a notificação, a preferência continua salva.
 */
export async function syncDailyReminder(reminder: ReminderTime | null): Promise<ReminderSync> {
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((item) => item.content.data?.questlog === 'daily')
        .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
    );
    if (!reminder) return 'CLEARED';

    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return 'UNAVAILABLE';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'QuestLog',
        body: BODY,
        data: { questlog: 'daily' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: reminder.hour,
        minute: reminder.minute,
      },
    });
    return 'SCHEDULED';
  } catch {
    return reminder ? 'UNAVAILABLE' : 'CLEARED';
  }
}
