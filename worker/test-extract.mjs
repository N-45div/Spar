// Checks the extractJson repair against the shapes Sarvam actually produces.
// Run: node test-extract.mjs
import fs from 'node:fs';

const src = fs.readFileSync('src/index.ts', 'utf8');
const start = src.indexOf('function stripThinking');
const end = src.indexOf('\n}', src.indexOf('function extractJson')) + 2;
const body = src
  .slice(start, end)
  .replace('function extractJson<T>(text: string): T {', 'function extractJson(text) {')
  .replace('function stripThinking(text: string): string {', 'function stripThinking(text) {')
  .replace(/ as T/g, '')
  .replace(/<T>/g, '');
const extractJson = new Function(`${body}; return extractJson;`)();

const cases = [
  {
    name: 'healthy object parses',
    input: '{"line": "You wanted to talk?"}',
    expect: (r) => r.line === 'You wanted to talk?',
  },
  {
    name: 'keyless runaway recovers the real line',
    input: '{\n"What do you mean I have missed deadlines? The team is swamped."\n   \n   \n',
    expect: (r) => r.line === 'What do you mean I have missed deadlines? The team is swamped.',
  },
  {
    name: 'truncated valid object recovers the value, never the key',
    input: '{"line": "Well, the payments ticket was not even my fault, that was blocked by QA and',
    expect: (r) => r.line.startsWith('Well, the payments ticket') && r.line !== 'line',
  },
  {
    name: 'truncated coach JSON does NOT return "overall" as a line',
    input: '{"overall": 72, "clarity": 80, "verdict": "You held the',
    expect: 'throws',
  },
  {
    name: 'spaced key recovers its value',
    input: '{ "line" : "half a sentence',
    expect: (r) => r.line === 'half a sentence',
  },
  {
    name: 'keyless with escaped quotes survives',
    input: '{\n"She said \\"fine\\" and walked out."\n  ',
    expect: (r) => r.line === 'She said "fine" and walked out.',
  },
  {
    name: 'unclosed think block never becomes a line',
    input: '<think>the manager seems upset so I should',
    expect: 'throws',
  },
  {
    name: 'think-tags are stripped before parsing',
    input: '<think>hmm</think>{"line": "Okay."}',
    expect: (r) => r.line === 'Okay.',
  },
];

let failed = 0;
for (const c of cases) {
  let got, threw = false;
  try {
    got = extractJson(c.input);
  } catch {
    threw = true;
  }
  let ok;
  if (c.expect === 'throws') ok = threw;
  else ok = !threw && c.expect(got);
  if (!ok) failed++;
  const detail = threw ? 'threw' : JSON.stringify(got).slice(0, 80);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${c.name} -> ${detail}`);
}
console.log(failed === 0 ? 'ALL PASS' : `${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
