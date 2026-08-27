// Measures time from "Begin round one" to the counterpart's first spoken line,
// simulating a user who spends a few seconds choosing before starting.
// Usage: node scripts/measure-opener.mjs <chromePath> <dwellMs> <runs>
import puppeteer from 'puppeteer-core';

const [, , chromePath, dwellArg, runsArg] = process.argv;
const dwell = Number(dwellArg ?? 4000);
const runs = Number(runsArg ?? 5);

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

for (let run = 0; run < runs; run++) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });

  const waitText = (t, timeout = 240000) =>
    page.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);
  const boxOf = (t) =>
    page.evaluate((x) => {
      const els = [...document.querySelectorAll('div')].filter(
        (e) => e.textContent.trim() === x && e.children.length === 0 && e.getClientRects().length > 0,
      );
      const el = els.at(-1);
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }, t);
  const tap = async (t) => {
    const b = await boxOf(t);
    if (!b) throw new Error('not found: ' + t);
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  };

  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 180000 });
  await waitText('Rehearse tonight');
  await tap('Rehearse tonight');
  await waitText("Who's across");

  // The user reads the options and picks — this is when the prefetch runs.
  await sleep(dwell);

  const t0 = Date.now();
  await tap('Begin round one');
  await page.waitForFunction(
    () => {
      if (!document.body.innerText.includes('CORNER COACH')) return false;
      const els = [...document.querySelectorAll('div')].filter(
        (e) => e.children.length === 0 && e.textContent.trim().startsWith('“'),
      );
      const now = els.at(-1)?.textContent.trim() ?? '';
      return now && now !== '“…”';
    },
    { timeout: 120000 },
  );
  const ms = Date.now() - t0;
  const line = await page.evaluate(() => {
    const els = [...document.querySelectorAll('div')].filter(
      (e) => e.children.length === 0 && e.textContent.trim().startsWith('“'),
    );
    return els.at(-1)?.textContent.trim() ?? '';
  });
  results.push(ms);
  console.log(`run ${run + 1}: ${ms}ms | ${line.slice(0, 60)}`);
  await page.close();
}

await browser.close();
const sorted = [...results].sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)];
console.log(
  `dwell=${dwell}ms n=${runs} | min=${sorted[0]} median=${median} max=${sorted[sorted.length - 1]}`,
);
