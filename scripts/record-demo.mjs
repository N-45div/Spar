// Records a phone-sized demo video of the full rehearsal loop.
// Usage: node scripts/record-demo.mjs <chromePath> <outDir>
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import puppeteer from 'puppeteer-core';

const [, , chromePath, outDir] = process.argv;
const webm = `${outDir}/spar-demo.webm`;
const mp4 = `${outDir}/spar-demo.mp4`;

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=2'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitText(text, timeout = 60000) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
}

async function boxOf(text) {
  return await page.evaluate((t) => {
    const els = [...document.querySelectorAll('div')].filter(
      (e) => e.textContent.trim() === t && e.children.length === 0,
    );
    const el = els[els.length - 1];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, text);
}

async function tap(text) {
  const b = await boxOf(text);
  if (!b) throw new Error(`not found: ${text}`);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

async function holdMic(ms) {
  const b = await boxOf('Hold to respond');
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await sleep(ms);
  await page.mouse.up();
}

// Load fully before recording starts
await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 180000 });
await waitText('Rehearse tonight', 240000);
await sleep(1200);

const recorder = await page.screencast({ path: webm, ffmpegPath });

// Home
await sleep(2800);

// Persona
await tap('Rehearse tonight');
await waitText("Who's across");
await sleep(1300);
await tap('Explosive');
await sleep(1500);
await tap('Career-defining');
await sleep(1700);

// Round — opener
await tap('Begin round one');
await waitText('CORNER COACH');
await sleep(3600);

// First exchange
await holdMic(1300);
await waitText('I stayed late every night', 15000);
await sleep(2800);

// Pressure to breaking point
const label = await boxOf('PRESSURE');
await page.mouse.click(334, label.y + label.height + 14);
await waitText('BREAKING POINT', 10000);
await sleep(2700);

// One exchange at full heat
await holdMic(1200);
await sleep(2700);

// End round via flag (top-right icon button)
await page.mouse.click(390 - 24 - 22, 54 + 22);
await waitText('FORM SCORE', 15000);
await sleep(2600);
await page.mouse.wheel({ deltaY: 260 });
await sleep(2400);

await recorder.stop();
await browser.close();

const conv = spawnSync(ffmpegPath, [
  '-y',
  '-i', webm,
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  '-r', '30',
  '-crf', '20',
  mp4,
], { stdio: 'inherit' });
if (conv.status !== 0) {
  console.error('mp4 conversion failed');
  process.exit(1);
}
console.log('done: ' + mp4);
