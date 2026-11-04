import { chromium } from 'playwright-core';
import { findMovieSubtitles } from '../src/subtitle-discovery.js';
import { translateMenuSubtitles, subtitleTrackUrl, withSubtitleTrack } from '../src/menu-subtitles.js';
import { translationUrl, translatedText } from '../src/translate.js';
import { parseSubtitles } from '../src/subtitles.js';

const fetchOk = async url => { const r = await fetch(url, { signal: AbortSignal.timeout(25000) }); if (!r.ok) throw Error(`HTTP ${r.status}`); return r; };
let vtt;
try {
  const source = await findMovieSubtitles('tt0468569', { json: async url => (await fetchOk(url)).json(), text: async url => (await fetchOk(url)).text() });
  const start = Date.now();
  vtt = await translateMenuSubtitles(source, async (text, target) => translatedText(await (await fetchOk(translationUrl(text, target))).json()), {
    onProgress(done, total) { if (done % 20 === 0 || done === total) console.log(`::notice title=Translation progress::${done}/${total}`); },
  });
  const cues = parseSubtitles(vtt);
  if (!cues.length || !cues.some(c => /[\u0600-\u06ff]/.test(c.text))) throw Error('No Sorani text');
  console.log(`::notice title=Full Sorani translation::${cues.length} cues translated in ${((Date.now() - start) / 1000).toFixed(1)} seconds`);
} catch (error) {
  console.log(`::warning title=Full Sorani translation::${error.message}`);
  process.exitCode = 1;
  throw error;
}
const token='abcdef0123456789abcdef0123456789';
const trackUrl=subtitleTrackUrl(token);
const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome', headless:true,args:['--no-sandbox']});
const page = await browser.newPage({viewport:{width:390,height:844}});
let subtitleRequests = 0;
try {
  await page.route(trackUrl, route => { subtitleRequests++; route.fulfill({status:200,contentType:'text/vtt',headers:{'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'},body:vtt}); });
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-play="cinebloom-155"]').first().click();
  await page.locator('#player-modal iframe').evaluate((el, url) => { el.src=url; }, withSubtitleTrack('https://vidlink.pro/movie/155', token, 100));
  const frame = page.frameLocator('#player-modal iframe');
  await frame.locator('video').waitFor({timeout:40000});
  const f=page.frames().find(f=>f.url().startsWith('https://vidlink.pro/movie/'));
  await page.waitForTimeout(5000);
  const hasMenu = await f.locator('button').evaluateAll(nodes => nodes.some(e => /Captions.*کوردی سۆرانی/.test(e.innerText)));
  if (!hasMenu || !subtitleRequests) throw Error(`Sorani menu=${hasMenu}, requests=${subtitleRequests}`);
  console.log(`::notice title=Player subtitle menu::Sorani Google translation appeared in the player's own captions menu; VTT fetched ${subtitleRequests} times`);
} catch(e) { console.log(`::error title=Menu probe::${String(e.message).split('\n')[0]}`); process.exitCode=1; }
finally {await browser.close();}
