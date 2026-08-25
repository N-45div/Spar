// The counterpart's brain. Talks to the Spar API when one is configured and
// falls back to the scripted counterpart when it is not (web preview, offline).
import Constants from 'expo-constants';
import { buildScript } from './script';

export type Turn = { who: 'them' | 'you'; text: string };

export type CounterpartTurn = { line: string; hint: string };

export type RoundSpec = {
  role: string;
  temperament: string;
  stakes: string;
  title?: string;
  brief?: string;
  pressure: number;
};

export type Moment = {
  turn: number;
  tag: string;
  good: boolean;
  quote: string;
  note: string;
};

export type ScoreResult = {
  overall: number;
  clarity: number;
  empathy: number;
  boundaries: number;
  verdict: string;
  moments: Moment[];
};

export function apiBase(): string | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const url = extra.apiBaseUrl;
  return typeof url === 'string' && url.length > 0 ? url.replace(/\/$/, '') : null;
}

async function post<T>(path: string, body: unknown, timeoutMs = 20000): Promise<T | null> {
  const base = apiBase();
  if (!base) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function nextLine(spec: RoundSpec, history: Turn[]): Promise<CounterpartTurn> {
  const remote = await post<{ line?: string; hint?: string }>('/reply', { ...spec, history });
  if (remote?.line) return { line: remote.line, hint: remote.hint ?? '' };
  const script = buildScript(spec.temperament, spec.pressure);
  const index = Math.min(history.filter((t) => t.who === 'them').length, script.length - 1);
  return script[index];
}

export function speakUrl(text: string): string | null {
  const base = apiBase();
  return base ? `${base}/speak?text=${encodeURIComponent(text)}` : null;
}

export async function transcribe(uri: string, mimeType?: string): Promise<string> {
  const base = apiBase();
  if (!base) return '';
  try {
    const blob = await (await fetch(uri)).blob();
    const r = await fetch(base + '/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': mimeType || blob.type || 'audio/m4a' },
      body: blob,
    });
    if (!r.ok) return '';
    const data = (await r.json()) as { text?: string };
    return (data.text ?? '').trim();
  } catch {
    return '';
  }
}

export async function scoreRound(spec: RoundSpec, history: Turn[]): Promise<ScoreResult | null> {
  const result = await post<Partial<ScoreResult>>('/score', { ...spec, history }, 30000);
  if (!result || typeof result.overall !== 'number') return null;
  const clamp = (v: unknown) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
  return {
    overall: clamp(result.overall),
    clarity: clamp(result.clarity),
    empathy: clamp(result.empathy),
    boundaries: clamp(result.boundaries),
    verdict: String(result.verdict ?? 'Round complete.'),
    moments: Array.isArray(result.moments)
      ? result.moments.slice(0, 3).map((m) => ({
          turn: Number(m.turn) || 0,
          tag: String(m.tag ?? 'MOMENT').toUpperCase(),
          good: Boolean(m.good),
          quote: String(m.quote ?? ''),
          note: String(m.note ?? ''),
        }))
      : [],
  };
}
