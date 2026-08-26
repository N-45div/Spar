import AsyncStorage from '@react-native-async-storage/async-storage';
import { CurveballResult } from '../round/engine';

const PREFIX = 'spar.curveball.v1.';

export type CurveballRecord = CurveballResult & { response: string; line: string };

export async function loadCurveball(dayKey: string): Promise<CurveballRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + dayKey);
    return raw ? (JSON.parse(raw) as CurveballRecord) : null;
  } catch {
    return null;
  }
}

export async function saveCurveball(dayKey: string, record: CurveballRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + dayKey, JSON.stringify(record));
  } catch {
    // best effort
  }
}
