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
  language?: string;
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

const DEFAULT_API_BASE = 'https://spar-api.spar-api.workers.dev';

export function apiBase(): string | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const url = extra.apiBaseUrl;
  if (url === 'none') return null;
  const chosen = typeof url === 'string' && url.length > 0 ? url : DEFAULT_API_BASE;
  return chosen.endsWith('/') ? chosen.slice(0, -1) : chosen;
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

export function scriptedHint(spec: RoundSpec, history: Turn[]): string {
  const script = buildScript(spec.temperament, spec.pressure, spec.language);
  const index = Math.min(history.filter((t) => t.who === 'them').length, script.length - 1);
  return script[Math.max(0, index)].hint;
}

function openerKey(spec: RoundSpec): string {
  return [
    spec.role,
    spec.temperament,
    spec.stakes,
    spec.title ?? '',
    spec.language ?? 'en',
    spec.pressure,
  ].join('|');
}

let opener: { key: string; promise: Promise<CounterpartTurn> } | null = null;

// The opening line depends only on the persona, not on anything said in the round,
// so it can be fetched while the user is still choosing. By the time they tap
// "Begin round one" it is usually already waiting.
export function prefetchOpener(spec: RoundSpec): void {
  if (!apiBase()) return;
  const key = openerKey(spec);
  if (opener?.key === key) return;
  const promise = fetchLine(spec, []);
  promise.catch(() => undefined);
  opener = { key, promise };
}

async function fetchLine(spec: RoundSpec, history: Turn[]): Promise<CounterpartTurn> {
  const remote = await post<{ line?: string; hint?: string }>('/reply', { ...spec, history });
  if (remote?.line) {
    // The counterpart no longer writes coaching; /hint does. Until it lands, show
    // the scripted hint for this beat rather than an empty card.
    return { line: remote.line, hint: remote.hint || scriptedHint(spec, history) };
  }
  const script = buildScript(spec.temperament, spec.pressure, spec.language);
  const index = Math.min(history.filter((t) => t.who === 'them').length, script.length - 1);
  return script[index];
}

export async function nextLine(spec: RoundSpec, history: Turn[]): Promise<CounterpartTurn> {
  if (history.length === 0 && opener?.key === openerKey(spec)) {
    const pending = opener.promise;
    opener = null;
    try {
      const ready = await pending;
      if (ready?.line) return ready;
    } catch {
      // fall through and fetch it normally
    }
  }
  return fetchLine(spec, history);
}

export function speakUrl(text: string, language = 'en'): string | null {
  const base = apiBase();
  if (!base) return null;
  const lang = language === 'hi' ? '&lang=hi' : '';
  return `${base}/speak?text=${encodeURIComponent(text)}${lang}`;
}

export async function transcribe(uri: string, mimeType?: string, language = 'en'): Promise<string> {
  const base = apiBase();
  if (!base) return '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const blob = await (await fetch(uri)).blob();
    const path = language === 'hi' ? '/transcribe?lang=hi' : '/transcribe';
    const r = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': mimeType || blob.type || 'audio/m4a' },
      body: blob,
      signal: controller.signal,
    });
    if (!r.ok) return '';
    const data = (await r.json()) as { text?: string };
    return (data.text ?? '').trim();
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
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

export type CurveballResult = {
  score: number;
  verdict: string;
  note: string;
  stronger: string;
};

export async function scoreCurveball(line: string, response: string): Promise<CurveballResult | null> {
  const result = await post<Partial<CurveballResult>>('/curveball', { line, response }, 30000);
  if (!result || typeof result.score !== 'number') return null;
  return {
    score: Math.max(0, Math.min(100, Math.round(result.score))),
    verdict: String(result.verdict ?? 'Scored.'),
    note: String(result.note ?? ''),
    stronger: String(result.stronger ?? ''),
  };
}

export async function fetchHint(spec: RoundSpec, history: Turn[]): Promise<string> {
  const result = await post<{ hint?: string }>('/hint', { ...spec, history }, 20000);
  return String(result?.hint ?? '').trim();
}
