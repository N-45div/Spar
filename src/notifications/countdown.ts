// The run-up to a real conversation: a rehearsal nudge the evening before and a
// last-look two hours out. Local notifications keep this working offline and with
// no account; OneSignal layers remote campaigns on top of the same moments.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Upcoming } from '../store/upcoming';

const TAG = 'conversation-countdown';
const CHANNEL = 'countdown';

const supported = Platform.OS !== 'web';

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Conversation countdown',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#E4572E',
  });
}

export async function cancelCountdown(): Promise<void> {
  if (!supported) return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((n) => n.content.data?.tag === TAG)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // nothing scheduled
  }
}

/** Returns how many reminders were actually scheduled (past moments are skipped). */
export async function scheduleCountdown(upcoming: Upcoming): Promise<number> {
  if (!supported) return 0;
  try {
    const granted = (await Notifications.getPermissionsAsync()).granted
      ? true
      : (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return 0;
  } catch {
    return 0;
  }

  await ensureChannel();
  await cancelCountdown();

  const target = new Date(upcoming.at).getTime();
  const eveningBefore = new Date(target - 24 * 3600000);
  eveningBefore.setHours(20, 0, 0, 0);

  const moments = [
    {
      when: eveningBefore.getTime(),
      title: 'Tomorrow: ' + upcoming.title,
      body: `One rehearsal tonight and you walk in ready. ${upcoming.temperament} ${upcoming.role.toLowerCase()}.`,
    },
    {
      when: target - 2 * 3600000,
      title: 'Two hours out',
      body: `${upcoming.title}. Run it once more while it still costs you nothing.`,
    },
  ];

  let scheduled = 0;
  for (const moment of moments) {
    const seconds = Math.round((moment.when - Date.now()) / 1000);
    if (seconds < 60) continue;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: moment.title,
          body: moment.body,
          data: { tag: TAG },
          ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
      });
      scheduled += 1;
    } catch {
      // skip this one
    }
  }
  return scheduled;
}
