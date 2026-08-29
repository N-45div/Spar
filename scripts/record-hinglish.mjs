// Records a short Hinglish-mode demo with the counterpart's voice on the track.
// Usage: node scripts/record-hinglish.mjs <chromePath> <outDir> [apiBase]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import ffmpegPath from 'ffmpeg-static';
import puppeteer from 'puppeteer-core';

const [, , chromePath, outDir, apiBaseArg] = process.argv;
const apiBase = (apiBaseArg || 'https://spar-api.spar-api.workers.dev').replace(/\/$/, '');
const webm = `${outDir}/spar-hinglish.webm`;
const mp4 = `${outDir}/spar-hinglish.mp4`;
const AUDIO_OFFSET_MS = 450;

const MANAGER_LINES = [
  'Dekhiye, main aapki mehnat dekh raha hoon. Par teen deadlines miss hui hain, aur mujhe Friday tak ek plan chahiye.',
];

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--force-device-scale-factor=2',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitText = (t, timeout = 90000) =>
  page.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);

async function caption() {
  return page.evaluate(() => {
    const text = document.body.innerText;
    if (!text.includes('CORNER COACH') || text.includes('FORM SCORE')) return '';
    const els = [...document.querySelectorAll('div')].filter(
      (e) => e.children.length === 0 && e.textContent.trim().startsWith('“'),
    );
    return els.at(-1)?.textContent.trim() ?? '';
  });
}
const waitCaptionChange = (prev, timeout = 90000) =>
  page.waitForFunction(
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

await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 180000 });
await waitText('Rehearse tonight', 240000);
await sleep(1000);

const spoken = [];
let last = '';
const recorder = await page.screencast({ path: webm, ffmpegPath });
const t0 = Date.now();
const poller = setInterval(async () => {
  try {
    const now = await caption();
    if (now && now !== last && now !== '“…”') {
      last = now;
      spoken.push({ at: Date.now() - t0, text: now.replace(/^“|”$/g, '') });
    }
  } catch {
    /* navigating */
  }
}, 100);

try {
  await sleep(1600);
  await tap('Rehearse tonight');
  await waitText("Who's across");
  await sleep(1400);
  await tap('Rehearse in Hinglish');
  await sleep(2200);
  await tap('Begin round one');
  await waitText('CORNER COACH');
  await waitCaptionChange('“…”');
  await waitText('Hold to respond');
  await sleep(5200);

  const before = await caption();
  await page.evaluate((t) => globalThis.__sparSetUtterance?.(t), MANAGER_LINES[0]);
  const b = await boxOf('Hold to respond');
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await sleep(1700);
  await page.mouse.up();
  await waitCaptionChange(before);
  await waitText('Hold to respond');
  await sleep(6200);
} finally {
  clearInterval(poller);
  await recorder.stop();
  await browser.close();
}

const audio = [];
for (let i = 0; i < spoken.length; i++) {
  const res = await fetch(`${apiBase}/speak?lang=hi&text=${encodeURIComponent(spoken[i].text)}`);
  if (!res.ok) continue;
  const file = `${outDir}/hi-line-${i}.wav`;
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  audio.push({ file, delay: spoken[i].at + AUDIO_OFFSET_MS });
}

const args = ['-y', '-i', webm];
for (const a of audio) args.push('-i', a.file);
if (audio.length > 0) {
  const delayed = audio.map((a, i) => `[${i + 1}:a]adelay=${a.delay}|${a.delay}[a${i}]`).join(';');
  const mix = audio.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${audio.length}:normalize=0[a]`;
  args.push('-filter_complex', `${delayed};${mix}`, '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '128k');
}
args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-crf', '20', '-movflags', '+faststart', mp4);

const conv = spawnSync(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
if (conv.status !== 0) {
  console.error(String(conv.stderr).slice(-1200));
  process.exit(1);
}
for (const a of audio) fs.rmSync(a.file, { force: true });
for (const line of spoken) console.log(`  ${(line.at / 1000).toFixed(1)}s  ${line.text}`);
console.log('done: ' + mp4);
