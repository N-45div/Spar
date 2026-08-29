import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'spar.upcoming.v1';

export type Upcoming = {
  title: string;
  at: string; // ISO
  role: string;
  temperament: string;
  stakes: string;
};

export async function loadUpcoming(): Promise<Upcoming | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Upcoming;
    // A conversation that has already happened is no longer upcoming.
    if (new Date(value.at).getTime() < Date.now() - 2 * 60 * 60 * 1000) {
      await AsyncStorage.removeItem(KEY);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export async function saveUpcoming(value: Upcoming): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // best effort
  }
}

export async function clearUpcoming(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // best effort
  }
}

/** "in 3 days", "tomorrow", "in 4 hours" — how far off the real thing is. */
export function countdownLabel(at: string, now = new Date()): string {
  const ms = new Date(at).getTime() - now.getTime();
  if (ms <= 0) return 'TODAY';
  const hours = Math.round(ms / 3600000);
  if (hours < 1) return 'WITHIN THE HOUR';
  if (hours < 20) return `IN ${hours} HOUR${hours === 1 ? '' : 'S'}`;
  const days = Math.round(hours / 24);
  if (days <= 1) return 'TOMORROW';
  return `IN ${days} DAYS`;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Monday, 10:00" */
export function whenLabel(at: string): string {
  const d = new Date(at);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${DAYS[d.getDay()]}, ${hh}:${mm}`;
}
