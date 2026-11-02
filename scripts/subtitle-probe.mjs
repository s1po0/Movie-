import { chromium } from 'playwright-core';
import { movieSourceUrl } from '../src/vidlink.js';
import { translationUrl } from '../src/translate.js';

const api = movieSourceUrl('155');
let english;
try {
  const r = await fetch(api, { signal: AbortSignal.timeout(25000) });
  const data = await r.json();
  english = data.stream?.captions?.find(c => c.language === 'English')?.url;
  console.log(`::notice title=Subtitle API server::HTTP ${r.status}, English subtitle ${!!english}`);
  if (english) {
    const sub = await fetch(english, { signal: AbortSignal.timeout(25000) });
    console.log(`::notice title=Subtitle server::HTTP ${sub.status}, bytes ${(await sub.text()).length}`);
  }
} catch (e) { console.log(`::warning title=Subtitle API server::${e.message}`); }
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  for (const [name, url] of [['API', api], ['Subtitle', english], ['Google', translationUrl('Hello, how are you?', 'ckb')]]) {
    if (!url) continue;
    const result = await page.evaluate(async url => {
      try { const r = await fetch(url); const text = await r.text(); return `HTTP ${r.status}, bytes ${text.length}`; }
      catch (e) { return `failed: ${e.message}`; }
    }, url);
    console.log(`::notice title=Browser ${name}::${result}`);
  }
} finally { await browser.close(); }
