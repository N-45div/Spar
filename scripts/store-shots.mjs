// Store/Devpost screenshots at exactly 1179×2556 (393×852 @3x), no device frame.
// Usage: node scripts/store-shots.mjs <chromePath> <outDir>
import puppeteer from 'puppeteer-core';

const [, , chromePath, outDir] = process.argv;

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const page = await browser.newPage();
await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 3 });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitText = (t, timeout = 60000) =>
  page.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);
const waitGone = (t, timeout = 90000) =>
  page.waitForFunction((x) => !document.body.innerText.includes(x), { timeout }, t);

async function boxOf(text) {
  return await page.evaluate((t) => {
    const els = [...document.querySelectorAll('div')].filter(
      (e) => e.textContent.trim() === t && e.children.length === 0 && e.getClientRects().length > 0,
    );
    const el = els.at(-1);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, text);
}
async function tap(text) {
  const b = await boxOf(text);
  if (!b) throw new Error('not found: ' + text);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
const shot = (name) => page.screenshot({ path: `${outDir}/${name}.png` });

// Seed two rounds (under the free limit) so Home and Progress look lived-in; the recorded round makes it three and triggers the paywall.
await page.evaluateOnNewDocument(() => {
  const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString();
  const rounds = [
    { id: 'r3', at: day(0), title: 'Peer review gone sideways', role: 'Direct report', temperament: 'Defensive', stakes: 'High', pressure: 3, overall: 74, clarity: 78, empathy: 62, boundaries: 85, durationSec: 272 },
    { id: 'r2', at: day(1), title: 'Declining the transfer request', role: 'Direct report', temperament: 'Goes quiet', stakes: 'High', pressure: 2, overall: 81, clarity: 84, empathy: 79, boundaries: 80, durationSec: 198 },
  ];
  localStorage.setItem('spar.rounds.v1', JSON.stringify(rounds));
});

await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 180000 });
await waitText('Rehearse tonight', 240000);
await sleep(800);
await shot('01-home');

await tap('GYM');
await waitText('Scenario packs');
await sleep(500);
await shot('02-gym');

await tap('Missed deadlines, third time');
await waitText('MISSED DEADLINES');
await sleep(500);
await shot('03-persona');

await tap('Begin round one');
await waitText('CORNER COACH');
await page.waitForFunction(() => !document.body.innerText.includes('“…”'), { timeout: 90000 });
await waitText('Hold to respond', 60000);
await sleep(1500);
await shot('04-round');

// pressure 4 for a hotter frame
const label = await boxOf('PRESSURE');
await page.mouse.click(268, label.y + label.height + 14);
await sleep(600);
await page.evaluate((t) => globalThis.__sparSetUtterance?.(t), "I hear you, and I mean that. But three deadlines in a row is a pattern, and I need a plan by Friday.");
const b = await boxOf('Hold to respond');
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
await page.mouse.down();
await sleep(1200);
await page.mouse.up();
await page.waitForFunction(() => document.body.innerText.includes('YOU SAID'), { timeout: 90000 });
await waitText('Hold to respond', 90000);
await sleep(800);
await shot('05-round-heated');

await page.mouse.click(393 - 24 - 22, 54 + 22);
await waitText('FORM SCORE', 30000);
await waitGone('Coach is watching the tape');
await sleep(600);
await shot('06-scorecard');

await tap('Done for tonight');
await waitText('Rehearse tonight', 15000);
await tap('Rehearse tonight');
await waitText('prepared.', 15000);
await sleep(500);
await shot('07-paywall');

await tap('Start free — 3 rounds on us');
await waitText('Rehearse tonight', 15000);
await tap('PROGRESS');
await waitText('Your form over time', 15000);
await sleep(500);
await shot('08-progress');

await browser.close();
console.log('done');
