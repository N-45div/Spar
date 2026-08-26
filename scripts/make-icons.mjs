// Renders the Spar icon set from the app's own visual language (the orb).
// Usage: node scripts/make-icons.mjs <chromePath>
import puppeteer from 'puppeteer-core';

const [, , chromePath] = process.argv;
const OUT = 'assets';

const EMBER = '#E4572E';
const BG = '#171310';
const WAVE = '#FF9A6E';

function orb({ size, scale = 1, background, mono = false }) {
  const s = size;
  const core = 0.58 * s * scale;
  const ring1 = 0.8 * s * scale;
  const ring2 = 0.94 * s * scale;
  const bars = [0.10, 0.19, 0.25, 0.16, 0.09].map((h) => h * s * scale);
  const barW = 0.032 * s * scale;
  const gap = 0.036 * s * scale;
  const total = bars.length * barW + (bars.length - 1) * gap;
  const stroke = mono ? '#FFFFFF' : EMBER;
  const fill = mono ? '#FFFFFF' : WAVE;
  const coreFill = mono
    ? 'none'
    : `<radialGradient id="c" cx="42%" cy="36%" r="70%"><stop offset="0%" stop-color="#3A2314"/><stop offset="100%" stop-color="#1A110B"/></radialGradient>`;
  const glow = mono
    ? ''
    : `<radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${EMBER}" stop-opacity="0.34"/><stop offset="70%" stop-color="${EMBER}" stop-opacity="0"/></radialGradient><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" fill="url(#g)"/>`;
  const barsSvg = bars
    .map((h, i) => {
      const x = s / 2 - total / 2 + i * (barW + gap);
      return `<rect x="${x}" y="${s / 2 - h / 2}" width="${barW}" height="${h}" rx="${barW / 2}" fill="${fill}"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <defs>${coreFill}</defs>
    ${background ? `<rect width="${s}" height="${s}" fill="${background}"/>` : ''}
    ${glow}
    <circle cx="${s / 2}" cy="${s / 2}" r="${ring2 / 2}" fill="none" stroke="${stroke}" stroke-opacity="${mono ? 0.45 : 0.18}" stroke-width="${0.006 * s}"/>
    <circle cx="${s / 2}" cy="${s / 2}" r="${ring1 / 2}" fill="none" stroke="${stroke}" stroke-opacity="${mono ? 0.7 : 0.3}" stroke-width="${0.007 * s}"/>
    <circle cx="${s / 2}" cy="${s / 2}" r="${core / 2}" fill="${mono ? 'none' : 'url(#c)'}" stroke="${stroke}" stroke-opacity="${mono ? 1 : 0.75}" stroke-width="${0.012 * s}"/>
    ${barsSvg}
  </svg>`;
}

const browser = await puppeteer.launch({ executablePath: chromePath, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();

async function render(file, svg, size, transparent) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(
    `<html><body style="margin:0;background:${transparent ? 'transparent' : BG}">${svg}</body></html>`,
  );
  await page.screenshot({ path: `${OUT}/${file}`, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', file);
}

await render('icon.png', orb({ size: 1024, scale: 0.86, background: BG }), 1024, false);
await render('android-icon-background.png', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${BG}"/></svg>`, 1024, false);
await render('android-icon-foreground.png', orb({ size: 1024, scale: 0.6 }), 1024, true);
await render('android-icon-monochrome.png', orb({ size: 1024, scale: 0.6, mono: true }), 1024, true);
await render('splash-icon.png', orb({ size: 1024, scale: 0.7 }), 1024, true);
await render('favicon.png', orb({ size: 96, scale: 0.9, background: BG }), 96, false);

await browser.close();
