// Screenshots every non-round screen at Galaxy Z Fold inner-display size, to
// check nothing is stretched or stranded when unfolded.
// Usage: node scripts/fold-audit.mjs <chromePath> <outDir>
import puppeteer from 'puppeteer-core';

const [, , chromePath, outDir] = process.argv;

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 904, height: 812, deviceScaleFactor: 2 });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitText = (t, timeout = 60000) =>
  page.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);

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

// Seed history so Home/Progress have content.
await page.evaluateOnNewDocument(() => {
  const day = (o) => new Date(Date.now() - o * 86400000).toISOString();
  localStorage.setItem(
    'spar.rounds.v1',
    JSON.stringify([
      { id: 'f2', at: day(0), title: 'Peer review gone sideways', role: 'Direct report', temperament: 'Defensive', stakes: 'High', pressure: 3, overall: 74, clarity: 78, empathy: 62, boundaries: 85, durationSec: 272 },
      { id: 'f1', at: day(1), title: 'Declining the transfer request', role: 'Direct report', temperament: 'Goes quiet', stakes: 'High', pressure: 2, overall: 81, clarity: 84, empathy: 79, boundaries: 80, durationSec: 198 },
    ]),
  );
});

await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 180000 });
await waitText('Rehearse tonight', 240000);
await sleep(800);

// Measure how much of the width the content actually uses.
async function widthReport(name) {
  const r = await page.evaluate(() => {
    const vw = window.innerWidth;
    let maxRight = 0;
    let minLeft = vw;
    for (const el of document.querySelectorAll('div')) {
      if (el.children.length !== 0) continue;
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      maxRight = Math.max(maxRight, b.right);
      minLeft = Math.min(minLeft, b.left);
    }
    return { vw, minLeft, maxRight, scrollW: document.documentElement.scrollWidth };
  });
  const used = ((r.maxRight - r.minLeft) / r.vw) * 100;
  console.log(
    `${name}: viewport ${r.vw}px | content ${Math.round(r.minLeft)}-${Math.round(r.maxRight)} (${used.toFixed(0)}% of width) | h-scroll ${r.scrollW > r.vw ? 'YES (bad)' : 'no'}`,
  );
}

await page.screenshot({ path: `${outDir}/fold-01-home.png` });
await widthReport('home');

await tap('GYM');
await waitText('Scenario packs');
await sleep(500);
await page.screenshot({ path: `${outDir}/fold-02-gym.png` });
await widthReport('gym');

await tap('PROGRESS');
await waitText('Your form over time');
await sleep(500);
await page.screenshot({ path: `${outDir}/fold-03-progress.png` });
await widthReport('progress');

try {
  await tap('GYM');
  await waitText('Scenario packs');
  await tap('Letting someone go');
  await waitText('prepared.', 25000);
  await sleep(500);
  await page.screenshot({ path: outDir + '/fold-04-paywall.png' });
  await widthReport('paywall');
} catch (e) {
  console.log('paywall step skipped:', e.message.split(String.fromCharCode(10))[0]);
}

await browser.close();
console.log('done');
