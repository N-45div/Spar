// Records a phone-sized demo of a live round, with the counterpart's voice on the
// audio track. Video comes from a headless screencast; audio is reconstructed by
// fetching the exact lines she spoke from the API and placing them on the
// timeline at the moment each appeared on screen. No user-side audio is captured.
//
// Usage: node scripts/record-demo.mjs <chromePath> <outDir> [apiBase]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import ffmpegPath from 'ffmpeg-static';
import puppeteer from 'puppeteer-core';

const [, , chromePath, outDir, apiBaseArg] = process.argv;
const apiBase = (apiBaseArg || 'https://spar-api.spar-api.workers.dev').replace(/\/$/, '');
const webm = `${outDir}/spar-demo.webm`;
const mp4 = `${outDir}/spar-demo-voice.mp4`;
const AUDIO_OFFSET_MS = 450; // the browser fetches the mp3 before playback starts

const MANAGER_LINES = [
  "I hear that you've been putting in the hours, and I mean that. But three deadlines in a row is a pattern, and I need a plan by Friday.",
  "I'm not comparing you to anyone. I'm asking what's actually getting in the way, and how I can help clear it.",
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

async function waitText(text, timeout = 60000) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
}

async function waitGone(text, timeout = 90000) {
  await page.waitForFunction((t) => !document.body.innerText.includes(t), { timeout }, text);
}

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

async function waitCaptionChange(previous, timeout = 90000) {
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

async function tap(text) {
  const b = await boxOf(text);
  if (!b) throw new Error(`not found: ${text}`);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

async function sayAndHold(line, ms) {
  await page.evaluate((t) => globalThis.__sparSetUtterance?.(t), line);
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

const spoken = [];
let lastCaption = '';
const recorder = await page.screencast({ path: webm, ffmpegPath });
const t0 = Date.now();
const poller = setInterval(async () => {
  try {
    const now = await caption();
    if (now && now !== lastCaption && now !== '“…”') {
      lastCaption = now;
      spoken.push({ at: Date.now() - t0, text: now.replace(/^“|”$/g, '') });
    }
  } catch {
    // page navigating
  }
}, 100);

try {
  // Home → Gym → scenario → persona
  await sleep(2200);
  await tap('GYM');
  await waitText('Scenario packs');
  await sleep(1600);
  await tap('Missed deadlines, third time');
  await waitText('MISSED DEADLINES');
  await sleep(1800);

  // Round — she opens
  await tap('Begin round one');
  await waitText('CORNER COACH');
  await waitCaptionChange('“…”');
  await waitText('Hold to respond');
  await sleep(5200);

  // Manager line 1
  let before = await caption();
  await sayAndHold(MANAGER_LINES[0], 1800);
  await waitCaptionChange(before);
  await waitText('Hold to respond');
  await sleep(5600);

  // Pressure up to 4
  const label = await boxOf('PRESSURE');
  await page.mouse.click(265, label.y + label.height + 14);
  await sleep(1800);

  // Manager line 2
  before = await caption();
  await sayAndHold(MANAGER_LINES[1], 1800);
  await waitCaptionChange(before);
  await waitText('Hold to respond');
  await sleep(6000);

  // Flag → scorecard with real coaching
  await page.mouse.click(390 - 24 - 22, 54 + 22);
  await waitText('FORM SCORE', 30000);
  await waitGone('Coach is watching the tape');
  await sleep(3000);
  await page.mouse.wheel({ deltaY: 260 });
  await sleep(2600);
} finally {
  clearInterval(poller);
  await recorder.stop();
  await browser.close();
}

// Reconstruct her voice track from the lines that appeared on screen.
const audioInputs = [];
for (let i = 0; i < spoken.length; i++) {
  const { at, text } = spoken[i];
  const res = await fetch(`${apiBase}/speak?text=${encodeURIComponent(text)}`);
  if (!res.ok) continue;
  const file = `${outDir}/line-${i}.mp3`;
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  audioInputs.push({ file, delay: at + AUDIO_OFFSET_MS });
}

const args = ['-y', '-i', webm];
for (const a of audioInputs) args.push('-i', a.file);
let filter = '';
if (audioInputs.length > 0) {
  const delayed = audioInputs.map((a, i) => `[${i + 1}:a]adelay=${a.delay}|${a.delay}[a${i}]`).join(';');
  const mix = audioInputs.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${audioInputs.length}:normalize=0[a]`;
  filter = `${delayed};${mix}`;
  args.push('-filter_complex', filter, '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '128k');
}
args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-crf', '20', '-movflags', '+faststart', mp4);

const conv = spawnSync(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
if (conv.status !== 0) {
  console.error(String(conv.stderr).slice(-1500));
  process.exit(1);
}
for (const a of audioInputs) fs.rmSync(a.file, { force: true });
console.log(`lines spoken: ${spoken.length}`);
for (const s of spoken) console.log(`  ${(s.at / 1000).toFixed(1)}s  ${s.text}`);
console.log('done: ' + mp4);
