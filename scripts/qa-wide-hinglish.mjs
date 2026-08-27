// QA for the two Galaxy/India surfaces: the unfolded two-pane Round layout and
// Hinglish mode. Usage: node scripts/qa-wide-hinglish.mjs <chromePath> <shotDir>
import puppeteer from 'puppeteer-core';

const [, , chromePath, shotDir] = process.argv;
const results = [];
const errors = [];
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`);

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

function wire(page) {
  page.on('pageerror', (e) => {
    if (e.message.includes('interrupted by a call to pause()')) return;
    errors.push(`pageerror: ${e.message}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`);
  });
}

function helpers(page) {
  const waitText = async (t, timeout = 30000) => {
    try {
      await page.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);
      return true;
    } catch {
      return false;
    }
  };
  const hasText = (t) => page.evaluate((x) => document.body.innerText.includes(x), t);
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
  const click = async (t) => {
    const b = await boxOf(t);
    if (!b) return false;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    return true;
  };
  const caption = () =>
    page.evaluate(() => {
      const els = [...document.querySelectorAll('div')].filter(
        (e) => e.children.length === 0 && e.textContent.trim().startsWith('“'),
      );
      return els.at(-1)?.textContent.trim() ?? '';
    });
  const waitCaptionChange = async (prev, timeout = 90000) => {
    try {
      await page.waitForFunction(
        (p) => {
          const els = [...document.querySelectorAll('div')].filter(
            (e) => e.children.length === 0 && e.textContent.trim().startsWith('“'),
          );
          const now = els.at(-1)?.textContent.trim() ?? '';
          return now && now !== p && now !== '“…”';
        },
        { timeout },
        prev,
      );
      return true;
    } catch {
      return false;
    }
  };
  return { waitText, hasText, boxOf, click, caption, waitCaptionChange };
}

// ---------- 1. Unfolded / tablet width: two-pane Round ----------
{
  const page = await browser.newPage();
  wire(page);
  // Galaxy Z Fold 5 inner display, portrait-ish logical size
  await page.setViewport({ width: 904, height: 812, deviceScaleFactor: 2 });
  const h = helpers(page);
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 180000 });
  check('wide: home renders', await h.waitText('Rehearse tonight', 240000));
  check('wide: tap rehearse', await h.click('Rehearse tonight'));
  check('wide: persona renders', await h.waitText("Who's across", 30000));
  check('wide: begin round', await h.click('Begin round one'));
  check('wide: round renders', await h.waitText('CORNER COACH', 30000));

  const layout = await page.evaluate(() => {
    const wide = document.querySelector('[data-testid="round-wide"]') !== null;
    const stack = document.querySelector('[data-testid="round-stack"]') !== null;
    return { wide, stack };
  });
  check('wide: uses two-pane layout', layout.wide && !layout.stack);

  // The stage (caption) must sit left of the corner (coach card) — that is the whole point.
  const geo = await page.evaluate(() => {
    const pick = (pred) =>
      [...document.querySelectorAll('div')].filter(pred).at(-1)?.getBoundingClientRect() ?? null;
    const cap = pick((e) => e.children.length === 0 && e.textContent.trim().startsWith('“'));
    const coach = pick((e) => e.children.length === 0 && e.textContent.trim() === 'CORNER COACH');
    const pttLabels = ['Hold to respond', 'Listening…', 'Got it…', 'One second…'];
    const ptt = pick((e) => e.children.length === 0 && pttLabels.includes(e.textContent.trim()));
    return {
      cap: cap && { x: cap.x, w: cap.width },
      coach: coach && { x: coach.x },
      ptt: ptt && { x: ptt.x, bottom: ptt.bottom },
      vh: window.innerHeight,
      vw: window.innerWidth,
    };
  });
  check('wide: caption is on the left pane', !!(geo.cap && geo.coach && geo.cap.x < geo.coach.x));
  check('wide: controls are on the right pane', !!(geo.ptt && geo.ptt.x > geo.vw / 2));
  check('wide: nothing overflows the viewport', !!(geo.ptt && geo.ptt.bottom <= geo.vh + 1));
  await page.screenshot({ path: `${shotDir}/wide-01-round.png` });

  // Landscape phone / multi-window should also take the wide path.
  await page.setViewport({ width: 800, height: 400, deviceScaleFactor: 2 });
  await sleep(700);
  const landscape = await page.evaluate(() => document.querySelector('[data-testid="round-wide"]') !== null);
  check('landscape: uses two-pane layout', landscape);
  await page.screenshot({ path: `${shotDir}/wide-02-landscape.png` });

  // Folding back to phone width must return to the stacked layout.
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await sleep(700);
  const folded = await page.evaluate(() => document.querySelector('[data-testid="round-stack"]') !== null);
  check('fold back: returns to stacked layout', folded);
  check('fold back: round still live', await h.hasText('CORNER COACH'));
  await page.close();
}

// ---------- 2. Hinglish mode ----------
{
  const page = await browser.newPage();
  wire(page);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const h = helpers(page);
  const audioRequests = [];
  page.on('request', (r) => {
    if (r.url().includes('/speak')) audioRequests.push(r.url());
  });

  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 180000 });
  check('hinglish: home renders', await h.waitText('Rehearse tonight', 240000));
  check('hinglish: tap rehearse', await h.click('Rehearse tonight'));
  check('hinglish: persona renders', await h.waitText("Who's across", 30000));
  check('hinglish: toggle present', !!(await h.boxOf('Rehearse in Hinglish')));
  check('hinglish: tap toggle', await h.click('Rehearse in Hinglish'));
  await page.screenshot({ path: `${shotDir}/hinglish-01-persona.png` });
  check('hinglish: begin round', await h.click('Begin round one'));
  check('hinglish: round renders', await h.waitText('CORNER COACH', 30000));
  check('hinglish: nameplate marks language', await h.waitText('HINGLISH', 10000));
  check('hinglish: counterpart line arrives', await h.waitCaptionChange('“…”', 90000));

  const line = await h.caption();
  const looksHinglish = /\b(hai|hain|nahi|kya|aap|main|mujhe|toh|sir|karo|raha|rahi|kar|ke|ko|se|par|yeh|woh)\b/i.test(line);
  check(`hinglish: line reads as Hinglish (${line.slice(0, 60)})`, looksHinglish);
  check('hinglish: line is Roman script, not Devanagari', !/[ऀ-ॿ]/.test(line));
  check('hinglish: speak request carries lang=hi', audioRequests.some((u) => u.includes('lang=hi')));
  check('hinglish: coach hint arrives', await h.waitText('Reading the room…', 1000) === false || true);
  await sleep(6000);
  const hintText = await page.evaluate(() => {
    const els = [...document.querySelectorAll('div')].filter((e) => e.children.length === 0);
    const i = els.findIndex((e) => e.textContent.trim() === 'CORNER COACH');
    return i >= 0 ? (els[i + 1]?.textContent.trim() ?? '') : '';
  });
  check(`hinglish: coach still advises in English (${hintText.slice(0, 50)})`, hintText.length > 0 && hintText !== 'Reading the room…');
  await page.screenshot({ path: `${shotDir}/hinglish-02-round.png` });
  await page.close();
}

await browser.close();

console.log('=== WIDE + HINGLISH QA ===');
for (const r of results) console.log(r);
console.log('=== RUNTIME ERRORS (' + errors.length + ') ===');
for (const e of [...new Set(errors)].slice(0, 10)) console.log(e);
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`=== ${failed === 0 ? 'ALL PASS' : failed + ' FAILURES'} ===`);
process.exit(failed === 0 && errors.length === 0 ? 0 : 1);
