// End-to-end QA: drives the web build through the full product loop.
// Works against the live Worker when it is running (LLM lines are non-deterministic),
// and against the scripted fallback when it is not.
// Usage: node scripts/qa-e2e.mjs <chromePath> <screenshotDir>
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
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
page.on('pageerror', (e) => {
  // Web audio raises this when a new line interrupts the previous one — intended.
  if (e.message.includes('interrupted by a call to pause()')) return;
  errors.push(`pageerror: ${e.message}`);
});
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitText(text, timeout = 30000) {
  try {
    await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
    return true;
  } catch {
    return false;
  }
}

async function waitGone(text, timeout = 60000) {
  try {
    await page.waitForFunction((t) => !document.body.innerText.includes(t), { timeout }, text);
    return true;
  } catch {
    return false;
  }
}

async function hasText(text) {
  return page.evaluate((t) => document.body.innerText.includes(t), text);
}

async function caption() {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll('div')].filter(
      (e) => e.children.length === 0 && e.textContent.trim().startsWith('“'),
    );
    return els.at(-1)?.textContent.trim() ?? '';
  });
}

async function waitCaptionChange(previous, timeout = 60000) {
  try {
    await page.waitForFunction(
      (prev) => {
        const els = [...document.querySelectorAll('div')].filter(
          (e) => e.children.length === 0 && e.textContent.trim().startsWith('“'),
        );
        const now = els.at(-1)?.textContent.trim() ?? '';
        return now && now !== prev && now !== '“…”';
      },
      { timeout },
      previous,
    );
    return true;
  } catch {
    return false;
  }
}

async function boxOf(text) {
  return await page.evaluate((t) => {
    const els = [...document.querySelectorAll('div')].filter(
      (e) => e.textContent.trim() === t && e.children.length === 0,
    );
    const el = els.at(-1);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, text);
}

async function clickText(text) {
  const b = await boxOf(text);
  if (!b) return false;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  return true;
}

async function holdRelease(text, ms = 700) {
  const b = await boxOf(text);
  if (!b) return false;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await sleep(ms);
  await page.mouse.up();
  return true;
}

const shot = (name) => page.screenshot({ path: `${shotDir}/${name}.png` });

// 1. Home (fresh install)
await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 180000 });
check('home renders', await waitText('Rehearse tonight', 240000));
check('home empty state', await waitText('The first round', 5000));
// The curveball rotates daily, so assert the section and a quoted line, not one day's text.
check('home curveball section', await waitText("TODAY'S CURVEBALL", 5000));
const curveballLine = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div')].filter((e) => e.children.length === 0 && e.textContent.trim().startsWith('“'));
  return els[0]?.textContent.trim() ?? '';
});
check(`home curveball line present (${curveballLine.slice(0, 40)})`, curveballLine.length > 4);
await shot('01-home');

// 1b. Curveball — type a one-liner, the coach scores it inline
const curveballInput = await page.$('textarea[placeholder^="Type your one-line"], input[placeholder^="Type your one-line"]');
check('curveball input present', !!curveballInput);
if (curveballInput) {
  await curveballInput.type("You're right, I haven't. That's exactly why I need you to walk me through what's blocking you.");
  check('tap score it', await clickText('Score it'));
  check('curveball scored (stronger line shown)', await waitText('STRONGER', 60000));
  await shot('01b-curveball-scored');
}

// 1c. The real conversation: set a countdown, Home reflects it, rehearsing opens that persona
check('countdown entry point', await waitText('Count it down', 5000));
check('tap countdown link', await clickText('Have a real one coming up? Count it down →'));
check('upcoming screen renders', await waitText("What's coming", 15000));
const upcomingInput = await page.$('textarea[placeholder^="The raise conversation"], input[placeholder^="The raise conversation"]');
check('upcoming has a title field', !!upcomingInput);
if (upcomingInput) {
  await upcomingInput.type('The raise conversation with Priya');
  check('pick when', await clickText('In three days'));
  check('pick who', await clickText('Goes quiet'));
  check('preview shows the plan', await waitText('The raise conversation with Priya —', 8000));
  check('save countdown', await clickText('Count me down'));
  check('back on home', await waitText('Rehearse tonight', 15000));
  check('home shows the countdown', await waitText('IN 3 DAYS', 8000));
  check('home hero names the conversation', await waitText('The raise conversation with Priya', 5000));
  check('home names the counterpart', await waitText('Goes quiet direct report', 5000));
  await shot('01c-home-countdown');
  check('rehearsing opens the real persona', await clickText('Rehearse tonight'));
  check('persona is prefilled from the countdown', await waitText('THE RAISE CONVERSATION WITH PRIYA', 15000));
  check('countdown brief shown', await waitText('This one is real', 5000));
  await page.mouse.click(46, 30);
  check('back on home after peeking', await waitText('Rehearse tonight', 10000));
  check('countdown can be edited', await clickText('Change the real conversation'));
  check('edit screen offers removal', await waitText('Remove this conversation', 10000));
  check('remove the countdown', await clickText('Remove this conversation'));
  check('home returns to its default card', await waitText('Count it down', 15000));
}

// 2. Freestyle persona
check('tap rehearse', await clickText('Rehearse tonight'));
check('persona renders', await waitText("Who's across", 30000));
check('tap Explosive', await clickText('Explosive'));
check('tap Career-defining', await clickText('Career-defining'));
check('file line grammar (An explosive)', await waitText('An explosive direct report', 5000));
await shot('02-persona');

// 3. Round — counterpart opens, we answer, pressure changes the band
check('begin round', await clickText('Begin round one'));
check('round renders (coach)', await waitText('CORNER COACH', 30000));
check('counterpart opening line arrives', await waitCaptionChange('“…”', 90000));
check('round ready for your move', await waitText('Hold to respond', 60000));

// A tap too quick to record, and a turn that heard nothing, must not spend an
// exchange or make her answer silence.
const captionNow = () =>
  page.evaluate(() => {
    const els = [...document.querySelectorAll('div')].filter(
      (e) => e.children.length === 0 && e.textContent.trim().startsWith('“'),
    );
    return els.at(-1)?.textContent.trim() ?? '';
  });
const lineBeforeMiss = await captionNow();
check('quick tap: press and release instantly', await holdRelease('Hold to respond', 20));
check('quick tap: button comes back', await waitText('Hold to respond', 30000));
await sleep(1500);
check('quick tap: she did not answer silence', (await captionNow()) === lineBeforeMiss);
await page.evaluate(() => globalThis.__sparSetUtterance?.(''));
check('empty turn: hold and release with nothing said', await holdRelease('Hold to respond', 400));
check('empty turn: told it will not count', await waitText('this one won’t count', 15000));
check('empty turn: button comes back', await waitText('Hold to respond', 30000));
await sleep(1200);
check('empty turn: she did not answer', (await captionNow()) === lineBeforeMiss);

check('pressure label default', await waitText('PUSHBACK', 5000));
await shot('03-round');
const opener = await caption();
// A real turn needs real words. Before the empty-turn fix this step "passed" only
// because she used to answer silence.
await page.evaluate(() =>
  globalThis.__sparSetUtterance?.("I hear that it's been a hard month. Three deadlines still slipped, and I need a plan by Friday."),
);
check('hold/release 1', await holdRelease('Hold to respond'));
check('counterpart replies after your turn', await waitCaptionChange(opener, 90000));
check('ready again after reply', await waitText('Hold to respond', 60000));
const label = await boxOf('PRESSURE');
if (label) await page.mouse.click(334, label.y + label.height + 14);
check('pressure label breaking point', await waitText('BREAKING POINT', 10000));
await shot('04-round-p5');
const beforeHot = await caption();
await page.evaluate(() =>
  globalThis.__sparSetUtterance?.("I'm not comparing you to anyone. One acknowledgment from you, then we fix the blocker together."),
);
check('hold/release at pressure 5', await holdRelease('Hold to respond'));
check('counterpart replies at pressure 5', await waitCaptionChange(beforeHot, 90000));

// Play out to the scorecard (flag ends the round early; max 8 exchanges otherwise)
await waitText('Hold to respond', 60000);
await page.mouse.click(390 - 24 - 22, 54 + 22);
check('scorecard renders', await waitText('FORM SCORE', 30000));
check('coach finishes scoring', await waitGone('Coach is watching the tape', 90000));
const gotMoments = await hasText('KEY MOMENTS');
const gotEstimateNote = await hasText("couldn't review this round");
check('scorecard shows real moments or says they are estimates', gotMoments || gotEstimateNote);
check('no run-again at pressure 5', !(await hasText('Run it again')));
await shot('05-scorecard');

// 4. Persistence
check('tap done', await clickText('Done for tonight'));
check('back on home', await waitText('Rehearse tonight', 15000));
check('round persisted to history', await waitText('Explosive direct report', 10000));
check('hero flips to returning state', await waitText('Ready for the next', 5000));
await shot('06-home-history');

// 5. Gym — free scenario prefills persona and titles the round
check('tap GYM tab', await clickText('GYM'));
check('gym renders', await waitText('Scenario packs', 15000));
check('gym shows pro pack', await waitText('The hardest ones', 5000));
await shot('07-gym');
check('tap free scenario', await clickText('Missed deadlines, third time'));
check('persona prefilled title', await waitText('MISSED DEADLINES', 15000));
check('persona shows brief', await waitText('The pattern is real', 5000));
check('begin scenario round', await clickText('Begin round one'));
check('round nameplate carries scenario', await waitText('MISSED DEADLINES', 15000));
check('scenario opens at coach hint', await waitText('CORNER COACH', 5000));
await page.mouse.click(46, 76);
check('round X returns to persona', await waitText("Who's across", 10000));
await page.mouse.click(46, 30);
check('persona back returns to gym', await waitText('Scenario packs', 10000));

// 6. Gym — pro scenario hits the paywall
check('tap pro scenario', await clickText('Letting someone go'));
check('pro pack opens paywall', await waitText('prepared.', 15000));
check('paywall cta closes in preview', await clickText('Start free — 3 rounds on us'));
check('back on gym after paywall', await waitText('Scenario packs', 10000));

// 7. Progress
check('tap PROGRESS tab', await clickText('PROGRESS'));
check('progress renders', await waitText('Your form over time', 15000));
check('progress history has round', await waitText('Explosive direct report', 5000));
check('progress stats', await waitText('ROUNDS', 5000));
await shot('08-progress');

// 8. Free-tier gate — seed 3 rounds, expect the paywall from Home
await page.evaluate(() => {
  const key = Object.keys(localStorage).find((k) => k.includes('spar.rounds'));
  if (!key) return;
  const rounds = JSON.parse(localStorage.getItem(key));
  while (rounds.length < 3) rounds.push({ ...rounds[0], id: rounds[0].id + String(rounds.length) });
  localStorage.setItem(key, JSON.stringify(rounds));
});
await page.reload({ waitUntil: 'networkidle2' });
check('home reloads after seed', await waitText('Rehearse tonight', 60000));
check('tap rehearse (gated)', await clickText('Rehearse tonight'));
check('paywall shows after 3 free rounds', await waitText('prepared.', 15000));
check('paywall plans render', await waitText('4 MONTHS FREE', 5000));
await shot('09-paywall');
check('paywall cta closes', await clickText('Start free — 3 rounds on us'));
check('back home after paywall', await waitText('Rehearse tonight', 10000));

await browser.close();

console.log('=== QA RESULTS ===');
for (const r of results) console.log(r);
console.log('=== RUNTIME ERRORS (' + errors.length + ') ===');
for (const e of [...new Set(errors)].slice(0, 15)) console.log(e);
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`=== ${failed === 0 ? 'ALL PASS' : failed + ' FAILURES'} ===`);
process.exit(failed === 0 && errors.length === 0 ? 0 : 1);
