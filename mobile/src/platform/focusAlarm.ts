/**
 * Aparelho no modo foco: tela acesa enquanto o cronômetro aparece e uma notificação
 * local no fim (para quem saiu do app). Tudo é opcional: se o módulo nativo faltar
 * (web, teste), o foco funciona igual, só sem esses extras.
 */

const KEEP_AWAKE_TAG = 'questlog-focus';

export async function keepScreenOn(on: boolean): Promise<void> {
  try {
    const KeepAwake = await import('expo-keep-awake');
    if (on) await KeepAwake.activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    else await KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TAG);
  } catch {
    // Sem tela acesa: o cronômetro segue pelo relógio, não pelo app aberto.
  }
}

async function cancelFocusNotifications(): Promise<void> {
  const Notifications = await import('expo-notifications');
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.content.data?.questlog === 'focus')
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

/** Agenda o aviso de fim do foco (ou só limpa, com `endsAtMs` null). */
export async function syncFocusAlarm(questTitle: string, endsAtMs: number | null): Promise<void> {
  try {
    await cancelFocusNotifications();
    if (endsAtMs == null || endsAtMs <= Date.now()) return;
    const Notifications = await import('expo-notifications');
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Foco concluído',
        body: `${questTitle}: hora de marcar como feita.`,
        data: { questlog: 'focus' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(endsAtMs),
      },
    });
  } catch {
    // Sem notificação: a tela do foco mostra o fim quando o app abrir.
  }
}
