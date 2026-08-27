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
  language?: string;
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
    'Speak in natural spoken English.',
    'The user is the manager. Stay fully in character. Speak like a real person in a real meeting: 1–3 short sentences, natural spoken English, contractions, no stage directions, no bullet points.',
    'Never break character, never mention being an AI, never coach the manager inside your line. React to what the manager actually said; if it was vague or empty, push on that.',
    'Respond ONLY with strict JSON: {"line": "<what you say out loud>"}.',
    spec.language === 'hi'
      ? 'LANGUAGE RULE, overrides everything above: the value of "line" MUST be Hinglish - Hindi and English mixed the way people actually talk in Indian offices - written in Roman (Latin) script only, never Devanagari and never plain English. Example of the register: "Sir, maine poori koshish ki thi, par timeline hi unrealistic tha."'
      : '',
  ].filter(Boolean).join('\n');
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

async function sarvamChat(
  env: Env,
  messages: { role: string; content: string }[],
  temperature: number,
  maxTokens = 1200,
  model = 'sarvam-105b-conversations',
) {
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
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });
  if (!r.ok) throw new Error(`sarvam ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = (await r.json()) as {
    choices?: {
      finish_reason?: string;
      message?: { content?: string | null; reasoning_content?: string | null };
    }[];
  };
  const choice = data.choices?.[0];
  const message = choice?.message;
  // Thinking variants can exhaust the budget inside reasoning_content; fall back to it.
  return {
    text: message?.content || message?.reasoning_content || '',
    finish: choice?.finish_reason ?? '',
  };
}

function extractJson<T>(text: string): T {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  const start = cleaned.indexOf('{');
  if (start < 0) throw new Error('no json in model output');
  const end = cleaned.lastIndexOf('}');
  if (end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    } catch {
      // fall through to the repair below
    }
  }
  // Sarvam opens a round with `{ "<the line>"` — a bare string where the key
  // belongs — and then, pinned to JSON grammar by response_format, pads
  // whitespace until max_tokens and never closes the brace. Keep what it said.
  const bare = /\{\s*("(?:[^"\\]|\\.)*")(?!\s*:)/.exec(cleaned.slice(start));
  if (bare) return JSON.parse(`{"line": ${bare[1]}}`) as T;
  throw new Error('no json in model output');
}

async function chatJson<T>(
  env: Env,
  messages: { role: string; content: string }[],
  temperature: number,
  maxTokens = 1200,
  attempts = 2,
): Promise<{ parsed: T | null; raw: string }> {
  let raw = '';
  for (let attempt = 0; attempt < attempts; attempt++) {
    const attemptMessages =
      attempt === 0
        ? messages
        : [...messages, { role: 'user', content: 'Output only the JSON object described above. No prose, no markdown.' }];
    const { text, finish } = await sarvamChat(
      env,
      attemptMessages,
      attempt === 0 ? temperature : 0.4,
      maxTokens,
    );
    raw = text;
    try {
      return { parsed: extractJson<T>(raw), raw };
    } catch {
      // A generation that hit the token ceiling will not come back shorter on a
      // second ask — retrying only doubles the wait.
      if (finish === 'length') break;
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
  // No trailing user turn on the opening line: with nothing from the assistant
  // yet, Sarvam answers a user turn with a keyless `{ "…"` and then burns the
  // whole token budget padding whitespace (~54s). System-only returns clean
  // JSON in under two seconds.
  if (spec.history.length > 0 && spec.history[spec.history.length - 1].who === 'them') {
    messages.push({ role: 'user', content: '(The manager says nothing. Fill the silence in character.)' });
  }
  const { parsed, raw } = await chatJson<{ line?: string; hint?: string; advice_to_manager?: string }>(
    env,
    messages,
    0.85,
    180,
    // One attempt only: extractJson repairs the keyless shape and the raw-text
    // fallback catches the rest, so a retry just doubles the wait on a slow turn.
    1,
  );
  if (parsed?.line) {
    return {
      line: endOnSentence(String(parsed.line).trim()),
      hint: String(parsed.advice_to_manager ?? parsed.hint ?? '').trim(),
    };
  }
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
  const { parsed, raw } = await chatJson<Record<string, unknown>>(env, messages, 0.3, 400);
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

// A spoken line that stops mid-word sounds broken. If the model ran into the
// token ceiling, fall back to the last sentence that actually finished.
function endOnSentence(line: string): string {
  if (/[.!?…”"']\s*$/.test(line)) return line;
  const lastStop = Math.max(line.lastIndexOf('. '), line.lastIndexOf('? '), line.lastIndexOf('! '));
  if (lastStop > line.length * 0.4) return line.slice(0, lastStop + 1);
  // One long unfinished sentence: cut at the last word so it does not end mid-word.
  const lastSpace = line.lastIndexOf(' ');
  return lastSpace > 0 ? line.slice(0, lastSpace).replace(/[,;:—-]$/, '') + '…' : line;
}

function trimToSentence(text: string, max: number): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  if (lastStop > max * 0.5) return cut.slice(0, lastStop + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[,;:]$/, '') + '…';
}

function hintSystem(): string {
  return [
    "You are a sharp, warm executive coach sitting beside a MANAGER who is rehearsing a hard conversation. You are on the manager's side.",
    "The manager's counterpart just spoke. Whisper the single best move the manager should make in reply: ONE sentence, at most 25 words, second person, concrete, no preamble. Never exceed one sentence.",
    "Good hints name a technique and apply it: acknowledge X then restate Y; ask one specific question; hold the boundary without apologizing; do not take the bait about Z.",
    "Respond ONLY with strict JSON: {\"hint\": \"<one sentence for the manager>\"}",
  ].join(String.fromCharCode(10));
}

async function hint(env: Env, spec: RoundSpec) {
  const lastThem = [...spec.history].reverse().find((t) => t.who === 'them')?.text ?? '';
  const recent = spec.history.slice(-6).map((t) => `${t.who === 'them' ? 'COUNTERPART' : 'MANAGER'}: ${t.text}`).join(String.fromCharCode(10));
  const messages = [
    { role: 'system', content: hintSystem() },
    {
      role: 'user',
      content: `Scenario: ${spec.title ?? 'freestyle'} · counterpart: ${spec.temperament} ${spec.role} · pressure ${spec.pressure}/5` + String.fromCharCode(10) + `Recent exchange:` + String.fromCharCode(10) + recent + String.fromCharCode(10) + `The counterpart just said: "${lastThem}"` + String.fromCharCode(10) + `What is the manager's best move right now?`,
    },
  ];
  const { parsed, raw } = await chatJson<{ hint?: string }>(env, messages, 0.5);
  const text = String(parsed?.hint ?? '').trim();
  return { hint: text ? trimToSentence(text, 240) : '' };
}

// Sarvam accepts audio/x-m4a and audio/mp4 but rejects audio/m4a — the exact type the
// recorder sends — with "Invalid file type", which silently demoted every Hinglish
// turn to the Deepgram fallback.
function sarvamAudioType(contentType: string): string {
  const t = contentType.split(';')[0].trim().toLowerCase();
  if (t === 'audio/m4a' || t === 'audio/x-m4a' || t === 'audio/mp4') return 'audio/x-m4a';
  if (t === 'audio/wav' || t === 'audio/wave' || t === 'audio/x-wav') return 'audio/wav';
  if (t === 'audio/mpeg' || t === 'audio/mp3') return 'audio/mpeg';
  if (t === 'audio/webm' || t.startsWith('audio/webm')) return 'audio/webm';
  return 'audio/x-m4a';
}

async function sarvamTranscribe(env: Env, audio: ArrayBuffer, contentType: string) {
  const form = new FormData();
  const type = sarvamAudioType(contentType);
  const name = type === 'audio/wav' ? 'round.wav' : 'round.m4a';
  form.append('file', new Blob([audio], { type }), name);
  form.append('model', 'saarika:v2.5');
  form.append('language_code', 'hi-IN');
  const r = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: { 'api-subscription-key': env.SARVAM_API_KEY },
    body: form,
  });
  if (!r.ok) throw new Error(`sarvam stt ${r.status}`);
  const data = (await r.json()) as { transcript?: string };
  return (data.transcript ?? '').trim();
}

async function deepgramTranscribe(env: Env, audio: ArrayBuffer, contentType: string, language: string) {
  const r = await fetch(
    `https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&language=${language}`,
    {
      method: 'POST',
      headers: { Authorization: `Token ${env.DEEPGRAM_API_KEY}`, 'Content-Type': contentType },
      body: audio,
    },
  );
  if (!r.ok) throw new Error(`deepgram listen ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = (await r.json()) as {
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
  };
  return (data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '').trim();
}

async function transcribe(env: Env, request: Request, lang: string) {
  const contentType = request.headers.get('Content-Type') || 'audio/*';
  const audio = await request.arrayBuffer();
  if (lang === 'hi') {
    // Sarvam handles Hinglish best; Deepgram multi is the safety net.
    // (Deepgram with language=en returns an empty transcript for Hinglish speech.)
    try {
      const viaSarvam = await sarvamTranscribe(env, audio, contentType);
      if (viaSarvam) return viaSarvam;
    } catch {
      // fall through
    }
    return deepgramTranscribe(env, audio, contentType, 'multi');
  }
  return deepgramTranscribe(env, audio, contentType, 'en');
}

async function speakHinglish(env: Env, text: string) {
  const r = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-subscription-key': env.SARVAM_API_KEY },
    body: JSON.stringify({
      text: text.slice(0, 1400),
      target_language_code: 'hi-IN',
      speaker: 'anushka',
      model: 'bulbul:v2',
    }),
  });
  if (!r.ok) throw new Error(`sarvam tts ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = (await r.json()) as { audios?: string[] };
  const b64 = data.audios?.[0];
  if (!b64) throw new Error('sarvam tts returned no audio');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let n = 0; n < binary.length; n++) bytes[n] = binary.charCodeAt(n);
  return new Response(bytes, {
    headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store', ...CORS },
  });
}

async function speak(env: Env, text: string, voice: string, lang: string) {
  if (lang === 'hi') return speakHinglish(env, text);
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
        return await speak(env, text, url.searchParams.get('voice') || '', url.searchParams.get('lang') || 'en');
      }

      if (url.pathname === '/transcribe' && request.method === 'POST') {
        return json({ text: await transcribe(env, request, url.searchParams.get('lang') || 'en') });
      }

      if (url.pathname === '/reply' && request.method === 'POST') {
        const spec = (await request.json()) as RoundSpec;
        return json(await reply(env, { ...spec, history: spec.history ?? [] }));
      }

      if (url.pathname === '/hint' && request.method === 'POST') {
        const hintSpec = (await request.json()) as RoundSpec;
        return json(await hint(env, { ...hintSpec, history: hintSpec.history ?? [] }));
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
