// Daily curveball reminder as a local notification. OneSignal layers on top of
// this later for remote campaigns; the local schedule keeps the ritual working
// offline and without an account.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { tomorrowsCurveball } from '../data/curveballs';

const CHANNEL = 'curveball';
const TAG = 'daily-curveball';
export const REMINDER_HOUR = 20;

const supported = Platform.OS !== 'web';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Daily curveball',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#E4572E',
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!supported) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

export async function isDailyCurveballScheduled(): Promise<boolean> {
  if (!supported) return false;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all.some((n) => n.content.data?.tag === TAG);
  } catch {
    return false;
  }
}

export async function cancelDailyCurveball(): Promise<void> {
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

export async function scheduleDailyCurveball(): Promise<boolean> {
  if (!supported) return false;
  if (!(await requestNotificationPermission())) return false;
  await ensureChannel();
  await cancelDailyCurveball();
  const next = tomorrowsCurveball();
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Today's curveball",
        body: `Your report says: “${next.line}” — answer in one line.`,
        data: { tag: TAG },
        ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: REMINDER_HOUR,
        minute: 0,
      },
    });
    return true;
  } catch {
    return false;
  }
}
