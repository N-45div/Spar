// Scripted counterpart until the LLM engine lands — same shape the real engine will return.

export type ScriptTurn = {
  line: string;
  hint: string;
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

// Hinglish fallback, so a slow or unreachable API never switches languages mid-round.
const HI_CALM: ScriptTurn[] = [
  {
    line: 'Haan boliye, kya baat hai? Thoda busy hoon aaj.',
    hint: 'Open with the point in one sentence. No runway.',
  },
  {
    line: 'Sir, main har raat late ruki hoon is mahine, aur ab aap keh rahe ho ki kaafi nahi hai?',
    hint: 'Name the effort first. Then hold the standard - one sentence each.',
  },
  {
    line: 'Theek hai. Toh aap chahte kya ho mujhse, exactly?',
    hint: 'Be concrete: one behavior, one deadline, one check-in.',
  },
  {
    line: 'Try karungi. Par jo timelines aap dete ho woh realistic nahi hain.',
    hint: "Do not defend the timeline - ask what is blocking them.",
  },
  {
    line: 'Chalo, Friday tak plan de deti hoon. Phir theek hai na?',
    hint: 'Close it clean: confirm, appreciate, stop talking.',
  },
];

const HI_HEATED: ScriptTurn[] = [
  {
    line: 'Samajh gayi, phir se deadline ki baat hai na.',
    hint: 'Do not take the bait. State the pattern, not the incident.',
  },
  {
    line: 'Matlab aap keh rahe ho mera kaam yahan value hi nahi karta?',
    hint: 'That is a distortion - restate what you actually said.',
  },
  {
    line: 'Sir, Sharma bhi toh late deta hai. Sirf mujhe kyun bol rahe ho?',
    hint: 'Stay on this conversation. Comparisons are a trapdoor.',
  },
  {
    line: 'Honestly, shayad main is team ke liye fit hi nahi hoon.',
    hint: 'Do not flinch, do not chase. Ask what they want to be true.',
  },
  {
    line: 'Hmm. Yeh sunke thoda better lag raha hai. Ab aage kya?',
    hint: 'They just opened the door. Walk through it gently.',
  },
];

const HI_HOT: ScriptTurn[] = [
  {
    line: 'Rehne dijiye sir, mujhe sunna hi nahi hai abhi.',
    hint: 'Low and slow. Match calm against heat, not volume.',
  },
  {
    line: 'Toh main resign kar doon? Yehi chahte ho aap?',
    hint: 'Do not answer the threat - name the feeling under it.',
  },
  {
    line: 'Aapko andaaza bhi nahi hai is job mein kitna lagta hai.',
    hint: 'One acknowledgment, then back to the one thing you need.',
  },
  {
    line: 'Theek hai, sun rahi hoon. Par is baar seriously bol rahe ho na?',
    hint: 'Make one promise you can keep. Only one.',
  },
  {
    line: 'Chalo. Friday. Mujhe pachtana na pade is baat ka.',
    hint: 'Take the win. Confirm and end the round.',
  },
];

const HI_TEMPERAMENT_OPENERS: Record<string, string> = {
  'Goes quiet': '…',
  'Deflects with humor': 'Closed-door meeting? Lawyer laana chahiye tha kya?',
  Explosive: 'Agar phir se lecture hai toh rehne hi dijiye.',
};
export function buildScript(temperament: string, pressure: number, language = 'en'): ScriptTurn[] {
  const hindi = language === 'hi';
  let base: ScriptTurn[];
  if (pressure <= 2) base = hindi ? HI_CALM : CALM;
  else if (pressure === 3) base = hindi ? HI_HEATED : HEATED;
  else base = hindi ? HI_HOT : HOT;
  const openers = hindi ? HI_TEMPERAMENT_OPENERS : TEMPERAMENT_OPENERS;
  const opener = openers[temperament];
  if (!opener) return base;
  return [{ line: opener, hint: base[0].hint }, ...base.slice(1)];
}

export const PRESSURE_NAMES = ['Calm', 'Pushback', 'Defensive', 'Heated', 'Breaking point'];

export const PRESSURE_HEAT = [0.3, 0.5, 0.68, 0.85, 1];
