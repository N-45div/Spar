// Scripted counterpart until the LLM engine lands — same shape the real engine will return.

export type ScriptTurn = {
  line: string;
  hint: string;
};

export type Moment = {
  time: string;
  tag: string;
  good: boolean;
  quote: string;
  note: string;
};

const CALM: ScriptTurn[] = [
  {
    line: "You wanted to talk? I've got a lot on my plate today.",
    hint: 'Open with the point in one sentence. No runway.',
  },
  {
    line: "I stayed late every night this month, and this is the first I'm hearing that it's not enough.",
    hint: 'Name the effort first. Then hold the standard — one sentence each.',
  },
  {
    line: "Okay. So what exactly do you want from me?",
    hint: 'Be concrete: one behavior, one deadline, one check-in.',
  },
  {
    line: "I can try. But the timelines you set aren't realistic.",
    hint: "Don't defend the timeline — ask what's blocking them.",
  },
  {
    line: "Fine. If I get you a plan by Friday, are we good?",
    hint: 'Close it clean: confirm, appreciate, stop talking.',
  },
];

const HEATED: ScriptTurn[] = [
  {
    line: "Let me guess — this is about the deadline again.",
    hint: "Don't take the bait. State the pattern, not the incident.",
  },
  {
    line: "So you're saying my work isn't valued here?",
    hint: "That's a distortion — restate what you actually said.",
  },
  {
    line: "Everyone misses deadlines. Why am I the only one in this room?",
    hint: 'Stay on this conversation. Comparisons are a trapdoor.',
  },
  {
    line: "Honestly, maybe I'm just not a fit for how you run things.",
    hint: "Don't flinch, don't chase. Ask what they want to be true.",
  },
  {
    line: "…Okay. That's fairer than I expected. What happens now?",
    hint: 'They just opened the door. Walk through it gently.',
  },
];

const HOT: ScriptTurn[] = [
  {
    line: "You know what? I don't even want to hear it.",
    hint: 'Low and slow. Match calm against heat, not volume.',
  },
  {
    line: "Maybe I should just quit. Is that what you want?",
    hint: "Don't answer the threat — name the feeling under it.",
  },
  {
    line: "You have no idea what this job actually takes.",
    hint: 'One acknowledgment, then back to the one thing you need.',
  },
  {
    line: "…I'm listening. But I need you to actually mean it this time.",
    hint: 'Make one promise you can keep. Only one.',
  },
  {
    line: "Alright. Friday. Don't make me regret this conversation.",
    hint: 'Take the win. Confirm and end the round.',
  },
];

const TEMPERAMENT_OPENERS: Record<string, string> = {
  'Goes quiet': '…',
  'Deflects with humor': "Uh oh, closed-door meeting. Should I have brought a lawyer?",
  Explosive: "If this is another lecture, I'd rather skip it.",
};

export function buildScript(temperament: string, pressure: number): ScriptTurn[] {
  const base = pressure <= 2 ? CALM : pressure === 3 ? HEATED : HOT;
  const opener = TEMPERAMENT_OPENERS[temperament];
  if (!opener) return base;
  return [{ line: opener, hint: base[0].hint }, ...base.slice(1)];
}

// Placeholder analysis until the LLM scores real transcripts.
export const MOMENTS: Moment[] = [
  {
    time: '00:41',
    tag: 'OVER-APOLOGIZING',
    good: false,
    quote: "Sorry, I know this is awkward…",
    note: 'Apologized before the point — state it clean.',
  },
  {
    time: '01:12',
    tag: 'CLEAN BOUNDARY',
    good: true,
    quote: "The deadline stands. Let's solve what's blocking you.",
    note: 'Firm and kind in the same breath. Keep it.',
  },
  {
    time: '03:58',
    tag: 'MINIMIZING',
    good: false,
    quote: "It's honestly not a big deal…",
    note: "Don't shrink the ask — it's why you're here.",
  },
];

export const PRESSURE_NAMES = ['Calm', 'Pushback', 'Defensive', 'Heated', 'Breaking point'];

export const PRESSURE_HEAT = [0.3, 0.5, 0.68, 0.85, 1];
