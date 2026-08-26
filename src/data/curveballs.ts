export type Curveball = {
  line: string;
  tests: string;
};

export const CURVEBALLS: Curveball[] = [
  { line: "With respect — you've never actually done my job.", tests: 'authority without defensiveness' },
  { line: 'Everyone else gets away with it. Why me?', tests: 'fairness deflection' },
  { line: "If you're unhappy with my work, maybe say so to HR.", tests: 'escalation threat' },
  { line: "I'm not paid enough to care about this.", tests: 'disengagement' },
  { line: 'You said this was fine last month.', tests: 'consistency challenge' },
  { line: "Can we do this some other time? I'm slammed.", tests: 'avoidance' },
  { line: 'Honestly, the whole team thinks the deadline is a joke.', tests: 'coalition pressure' },
  { line: 'So is this a warning? Should I be worried?', tests: 'fear in the room' },
  { line: "I'll fix it. Can we drop it now?", tests: 'shutting the door' },
  { line: "You're only saying this because leadership is on your back.", tests: 'motive attack' },
  { line: 'Fine. Whatever you want.', tests: 'silent compliance' },
  { line: "I've got another offer. Just so you know.", tests: 'leverage play' },
  { line: "Why wasn't I told about this earlier?", tests: 'blame shift' },
  { line: "Do you actually think I'm bad at this?", tests: 'vulnerability' },
];

export function dayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

export function curveballFor(date = new Date()): Curveball {
  return CURVEBALLS[dayOfYear(date) % CURVEBALLS.length];
}

export function tomorrowsCurveball(): Curveball {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return curveballFor(tomorrow);
}
