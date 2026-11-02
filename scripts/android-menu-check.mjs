import { chromium } from 'playwright-core';
import { withSubtitleTrack, subtitleTrackUrl } from '../src/menu-subtitles.js';

let browser;
try {
  browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = browser.contexts()[0].pages()[0];
  await page.locator('[data-play="cinebloom-155"]').first().waitFor({timeout:30000});
  const available = await page.evaluate(() => Boolean(window.Capacitor?.PluginHeaders?.some(p => p.name === 'MenuSubtitle')));
  if (!available) throw new Error('Native subtitle plugin not registered');
  const token = '0123456789abcdef0123456789abcdef';
  const text = 'WEBVTT\n\n00:00:00.000 --> 00:10:00.000\nسڵاو تاقیکردنەوە\n';
  await page.locator('[data-play="cinebloom-155"]').first().click();
  await page.evaluate(({token,text}) => window.Capacitor.nativePromise('MenuSubtitle','setTrack',{token,text}), {token,text});
  const src=withSubtitleTrack('https://vidlink.pro/movie/155',token);
  await page.locator('#player-modal iframe').evaluate((frame,src)=>frame.src=src,src);
  const locator = page.frameLocator('#player-modal iframe');
  await locator.locator('video').waitFor({timeout:60000});
  const frame = page.frames().find(f => f.url().startsWith('https://vidlink.pro/movie/'));
  if (!frame) throw Error('Player frame unavailable');
  const fetched = await frame.evaluate(async url => { const r=await fetch(url); return {status:r.status,text:await r.text()}; }, subtitleTrackUrl(token));
  if (fetched.status !== 200 || fetched.text !== text) throw Error(`Android interception failed: HTTP ${fetched.status}`);
  await page.waitForTimeout(5000);
  const hasMenu = await frame.locator('button').evaluateAll(nodes=>nodes.some(e=>/Captions.*کوردی سۆرانی/.test(e.innerText)));
  if (!hasMenu) throw Error('Sorani was not present in provider caption menu');
  console.log('::notice title=Android subtitle menu::Android WebView served the in-memory VTT and the player selected the Sorani menu option');
} catch(error) {
  console.log(`::error title=Android subtitle menu::${String(error.message).split('\n')[0]}`); process.exitCode=1;
} finally { await browser?.close(); }
