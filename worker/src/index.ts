// Spar API — the only place API keys live. Fronts Deepgram (speech in/out)
// and Sarvam 105B (the counterpart's brain + the coach that scores the round).

export interface Env {
  DEEPGRAM_API_KEY: string;
  SARVAM_API_KEY: string;
}

type Turn = { who: 'them' | 'you'; text: string };

type RoundSpec = {
  role: string;
  temperament: string;
  stakes: string;
  title?: string;
  brief?: string;
  pressure: number;
  history: Turn[];
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

const PRESSURE_NOTES = [
  'calm and cooperative; mild friction at most; willing to listen',
  'pushing back with defensive edges, but still professional',
  'openly defensive: deflecting, questioning fairness, comparing to others',
  'heated and personal; threatening to disengage; interrupting',
  'at breaking point: raw, escalating, may threaten to quit — but can be turned around by genuine skill',
];

const TEMPERAMENT_NOTES: Record<string, string> = {
  Defensive: 'hears every piece of feedback as an attack and defends first',
  'Goes quiet': 'answers hard questions with silence, one-word replies, or "fine"',
  Explosive: 'raises the volume fast when cornered; sharp, loud, then regretful',
  'Deflects with humor': 'jokes their way out of hard moments; sarcasm as armor',
};

function counterpartSystem(spec: RoundSpec): string {
  const pressure = Math.max(1, Math.min(5, spec.pressure));
  return [
    `You are role-playing a workplace conversation. You play the manager's ${spec.role.toLowerCase()}.`,
    `Your temperament: ${spec.temperament} — you ${TEMPERAMENT_NOTES[spec.temperament] ?? 'react in character'}.`,
    `Stakes for you: ${spec.stakes}.`,
    spec.title ? `Scenario: ${spec.title}.${spec.brief ? ' ' + spec.brief : ''}` : 'Scenario: the manager has asked to talk about a pattern in your work.',
    `Pressure level ${pressure}/5: you are ${PRESSURE_NOTES[pressure - 1]}.`,
    'The user is the manager. Stay fully in character. Speak like a real person in a real meeting: 1–3 short sentences, natural spoken English, contractions, no stage directions, no bullet points.',
    'Never break character, never mention being an AI, never coach the manager inside your line. React to what the manager actually said; if it was vague or empty, push on that.',
    'Also include "advice_to_manager": a whisper from a coach to the MANAGER (the user) about how THEY should reply to the line you just said. Address the manager as "you". Example: "Name the effort first, then restate the deadline in one sentence." Never describe what your character should do.',
    'Respond ONLY with strict JSON: {"line": "<what you say out loud>", "advice_to_manager": "<one sentence, second person, for the manager>"}.',
  ].join('\n');
}

function coachSystem(): string {
  return [
    'You are an executive coach reviewing a transcript of a manager rehearsing a difficult conversation with a direct report, peer, or their own manager.',
    'Score the MANAGER only. Be specific, warm, and blunt — like a great coach, not an HR memo.',
    'Respond ONLY with strict JSON in exactly this shape:',
    '{"overall": 0-100, "clarity": 0-100, "empathy": 0-100, "boundaries": 0-100, "verdict": "<one short sentence, max 8 words, second person>", "moments": [{"turn": <index of the manager line in the transcript, 0-based counting only manager lines>, "tag": "<2-3 WORD UPPERCASE LABEL>", "good": true|false, "quote": "<exact words the manager said, trimmed to one clause>", "note": "<one sentence of coaching, max 14 words>"}]}',
    'Give 2–3 moments, at least one good and one to work on when possible. Clarity = said the point plainly; Empathy = acknowledged the person; Boundaries = held the standard without caving or bullying.',
  ].join('\n');
}

async function sarvamChat(env: Env, messages: { role: string; content: string }[], temperature: number, model = 'sarvam-105b-conversations') {
  const r = await fetch('https://api.sarvam.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': env.SARVAM_API_KEY,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    }),
  });
  if (!r.ok) throw new Error(`sarvam ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = (await r.json()) as {
    choices?: { message?: { content?: string | null; reasoning_content?: string | null } }[];
  };
  const message = data.choices?.[0]?.message;
  // Thinking variants can exhaust the budget inside reasoning_content; fall back to it.
  return message?.content || message?.reasoning_content || '';
}

function extractJson<T>(text: string): T {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('no json in model output');
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

async function chatJson<T>(
  env: Env,
  messages: { role: string; content: string }[],
  temperature: number,
): Promise<{ parsed: T | null; raw: string }> {
  let raw = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const attemptMessages =
      attempt === 0
        ? messages
        : [...messages, { role: 'user', content: 'Output only the JSON object described above. No prose, no markdown.' }];
    raw = await sarvamChat(env, attemptMessages, attempt === 0 ? temperature : 0.4);
    try {
      return { parsed: extractJson<T>(raw), raw };
    } catch {
      // retry once with the stricter nudge
    }
  }
  return { parsed: null, raw };
}

function historyMessages(history: Turn[]) {
  return history.map((t) => ({
    role: t.who === 'them' ? 'assistant' : 'user',
    content: t.text,
  }));
}

async function reply(env: Env, spec: RoundSpec) {
  const messages = [{ role: 'system', content: counterpartSystem(spec) }, ...historyMessages(spec.history)];
  if (spec.history.length === 0) {
    messages.push({ role: 'user', content: '(The meeting starts. Open with your first line as the character.)' });
  } else if (spec.history[spec.history.length - 1].who === 'them') {
    messages.push({ role: 'user', content: '(The manager says nothing. Fill the silence in character.)' });
  }
  const { parsed, raw } = await chatJson<{ line?: string; hint?: string; advice_to_manager?: string }>(env, messages, 0.85);
  if (parsed?.line) return { line: String(parsed.line).trim(), hint: String(parsed.advice_to_manager ?? parsed.hint ?? '').trim() };
  // Never let formatting kill a round: treat whatever was said as the line.
  const text = raw.split('<think>').map((part, i) => (i === 0 ? part : part.slice(part.indexOf('</think>') + 8))).join('').trim();
  if (text) {
    return {
      line: text.replace(/^["“]|["”]$/g, '').slice(0, 300),
      hint: 'Hold your ground: one point, then one question.',
    };
  }
  throw new Error('model returned nothing');
}

async function score(env: Env, spec: RoundSpec) {
  const transcript = spec.history
    .map((t) => `${t.who === 'them' ? spec.role.toUpperCase() : 'MANAGER'}: ${t.text}`)
    .join('\n');
  const messages = [
    { role: 'system', content: coachSystem() },
    {
      role: 'user',
      content: `Scenario: ${spec.title ?? 'freestyle'} · counterpart: ${spec.temperament} ${spec.role} · pressure ${spec.pressure}/5\n\nTRANSCRIPT:\n${transcript}`,
    },
  ];
  const { parsed, raw } = await chatJson<Record<string, unknown>>(env, messages, 0.3);
  if (!parsed) throw new Error('no json in model output: ' + raw.slice(0, 120));
  return parsed;
}

function curveballSystem(): string {
  return [
    "You are an executive coach. A manager was hit with a difficult one-liner by a direct report and answered in one line.",
    "Judge the manager's single reply on composure, clarity, and holding a boundary without bullying or caving.",
    "Respond ONLY with strict JSON: {\"score\": 0-100, \"verdict\": \"<max 6 words, second person>\", \"note\": \"<one sentence of coaching, max 18 words>\", \"stronger\": \"<a stronger one-line reply the manager could have given, in natural spoken English>\"}",
  ].join(String.fromCharCode(10));
}

async function curveball(env: Env, body: { line?: string; response?: string }) {
  const line = String(body.line ?? '').trim();
  const response = String(body.response ?? '').trim();
  if (!line || !response) throw new Error('line and response are required');
  const messages = [
    { role: 'system', content: curveballSystem() },
    { role: 'user', content: `THE REPORT SAID: "${line}"
THE MANAGER REPLIED: "${response}"` },
  ];
  const { parsed, raw } = await chatJson<Record<string, unknown>>(env, messages, 0.4);
  if (!parsed) throw new Error('no json in model output: ' + raw.slice(0, 120));
  return parsed;
}

async function transcribe(env: Env, request: Request) {
  const contentType = request.headers.get('Content-Type') || 'audio/*';
  const r = await fetch('https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&language=en', {
    method: 'POST',
    headers: { Authorization: `Token ${env.DEEPGRAM_API_KEY}`, 'Content-Type': contentType },
    body: request.body,
  });
  if (!r.ok) throw new Error(`deepgram listen ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = (await r.json()) as {
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
  };
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
}

async function speak(env: Env, text: string, voice: string) {
  const model = /^aura-2-[a-z]+-en$/.test(voice) ? voice : 'aura-2-thalia-en';
  const r = await fetch(`https://api.deepgram.com/v1/speak?model=${model}&encoding=mp3`, {
    method: 'POST',
    headers: { Authorization: `Token ${env.DEEPGRAM_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!r.ok) throw new Error(`deepgram speak ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return new Response(r.body, {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', ...CORS },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    try {
      if (url.pathname === '/health') return json({ ok: true });

      if (url.pathname === '/speak' && request.method === 'GET') {
        const text = (url.searchParams.get('text') || '').slice(0, 600);
        if (!text) return json({ error: 'text required' }, 400);
        return await speak(env, text, url.searchParams.get('voice') || '');
      }

      if (url.pathname === '/transcribe' && request.method === 'POST') {
        return json({ text: await transcribe(env, request) });
      }

      if (url.pathname === '/reply' && request.method === 'POST') {
        const spec = (await request.json()) as RoundSpec;
        return json(await reply(env, { ...spec, history: spec.history ?? [] }));
      }

      if (url.pathname === '/curveball' && request.method === 'POST') {
        return json(await curveball(env, (await request.json()) as { line?: string; response?: string }));
      }
      if (url.pathname === '/score' && request.method === 'POST') {
        const spec = (await request.json()) as RoundSpec;
        return json(await score(env, { ...spec, history: spec.history ?? [] }));
      }

      return json({ error: 'not found' }, 404);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'unknown error' }, 502);
    }
  },
};
