import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'spar.rounds.v1';

export type RoundRecord = {
  id: string;
  at: string;
  title: string;
  role: string;
  temperament: string;
  stakes: string;
  pressure: number;
  overall: number;
  clarity: number;
  empathy: number;
  boundaries: number;
  durationSec: number;
};

export async function loadRounds(): Promise<RoundRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RoundRecord[]) : [];
  } catch {
    return [];
  }
}

export async function appendRound(record: RoundRecord): Promise<void> {
  const all = await loadRounds();
  all.unshift(record);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(all.slice(0, 200)));
  } catch {
    // storage full or unavailable — training continues, history just won't persist
  }
}

export async function roundCount(): Promise<number> {
  return (await loadRounds()).length;
}

export function bestScore(rounds: RoundRecord[]): number | null {
  return rounds.length ? Math.max(...rounds.map((r) => r.overall)) : null;
}

export function trainingDays(rounds: RoundRecord[]): number {
  return new Set(rounds.map((r) => r.at.slice(0, 10))).size;
}
