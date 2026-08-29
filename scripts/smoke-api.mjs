// Hits every Spar API endpoint and reports what is actually working.
// Sarvam retires models without warning (sarvam-m, then bulbul:v2), and the app
// degrades so gracefully that a dead endpoint is invisible from the UI — run this
// before recording anything or shipping a build.
// Usage: node scripts/smoke-api.mjs [apiBase]
const API = (process.argv[2] || 'https://spar-api.spar-api.workers.dev').replace(/\/$/, '');

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function timed(fn) {
  const t0 = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - t0 };
}

async function postJson(path, body, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not json */
    }
    return { status: r.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

// health
{
  const { value } = await timed(() => fetch(API + '/health').then((r) => r.json()).catch(() => null));
  record('health', value?.ok === true, JSON.stringify(value));
}

// reply, English
{
  const { value, ms } = await timed(() =>
    postJson('/reply', {
      role: 'Direct report',
      temperament: 'Defensive',
      stakes: 'High',
      pressure: 2,
      history: [],
    }),
  );
  const line = value.json?.line ?? '';
  const clean = /[.!?…]\s*$/.test(line);
  record(
    'reply (english opener)',
    value.status === 200 && line.length > 12 && line !== 'line',
    `${ms}ms, ends-clean=${clean}, "${line.slice(0, 60)}"`,
  );
}

// reply, Hinglish — catches both a dead model and a silent drift back to English
{
  const { value, ms } = await timed(() =>
    postJson('/reply', {
      role: 'Direct report',
      temperament: 'Defensive',
      stakes: 'High',
      language: 'hi',
      pressure: 3,
      history: [],
    }),
  );
  const line = value.json?.line ?? '';
  const hinglish = /\b(hai|hain|nahi|kya|aap|main|mujhe|toh|sir|raha|rahi|kar|yeh|woh|hoon)\b/i.test(line);
  const devanagari = /[ऀ-ॿ]/.test(line);
  record(
    'reply (hinglish)',
    value.status === 200 && hinglish && !devanagari,
    `${ms}ms, "${line.slice(0, 60)}"`,
  );
}

// hint — must coach the manager, never echo raw model output
{
  const { value, ms } = await timed(() =>
    postJson('/hint', {
      role: 'Direct report',
      temperament: 'Defensive',
      stakes: 'High',
      pressure: 3,
      history: [
        { who: 'them', text: 'So this is about the deadline again.' },
        { who: 'you', text: 'It is. Three in a row now.' },
        { who: 'them', text: 'Why am I the only one being singled out?' },
      ],
    }),
  );
  const hint = value.json?.hint ?? '';
  const looksRaw = hint.trim().startsWith('{') || hint.includes('"hint"');
  record('hint', value.status === 200 && hint.length > 10 && !looksRaw, `${ms}ms, "${hint.slice(0, 70)}"`);
}

// score
{
  const { value, ms } = await timed(() =>
    postJson('/score', {
      role: 'Direct report',
      temperament: 'Defensive',
      stakes: 'High',
      pressure: 2,
      history: [
        { who: 'them', text: 'You wanted to talk?' },
        { who: 'you', text: 'Yes. Three deadlines slipped. I need a plan by Friday.' },
        { who: 'them', text: 'I have been here late every night.' },
        { who: 'you', text: 'I see the hours, and I mean it. The deadline still stands.' },
      ],
    }),
  );
  const j = value.json ?? {};
  record(
    'score',
    value.status === 200 && typeof j.overall === 'number' && Array.isArray(j.moments),
    `${ms}ms, overall=${j.overall}, moments=${(j.moments || []).length}`,
  );
}

// curveball
{
  const { value, ms } = await timed(() =>
    postJson('/curveball', {
      line: 'Everyone else gets away with it. Why me?',
      response: 'Because this is your work and mine to fix. Let us talk about what is in the way.',
    }),
  );
  const j = value.json ?? {};
  record('curveball', value.status === 200 && typeof j.score === 'number' && !!j.stronger, `${ms}ms, score=${j.score}`);
}

// speak, English (Deepgram) and Hinglish (Sarvam)
for (const [name, qs, expectType] of [
  ['speak (english)', 'text=Testing%20one%20two.', 'audio/mpeg'],
  ['speak (hinglish)', 'lang=hi&text=Sir%2C%20maine%20poori%20koshish%20ki%20thi.', 'audio/wav'],
]) {
  const { value, ms } = await timed(async () => {
    const r = await fetch(`${API}/speak?${qs}`);
    const buf = await r.arrayBuffer();
    return { status: r.status, type: r.headers.get('content-type') || '', bytes: buf.byteLength };
  });
  record(
    name,
    value.status === 200 && value.bytes > 4000 && value.type.startsWith(expectType.split('/')[0]),
    `${ms}ms, ${value.status}, ${value.type}, ${value.bytes}B`,
  );
}

const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? 'API SMOKE: ALL PASS' : `API SMOKE: ${failed} FAILING`);
process.exit(failed === 0 ? 0 : 1);
