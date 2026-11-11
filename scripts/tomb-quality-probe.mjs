import { chromium } from 'playwright-core';
import { seriesSourceUrl } from '../src/vidlink.js';

const headers = { 'User-Agent':'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', Referer:'https://vidlink.pro/tv/206343/2/1', Origin:'https://vidlink.pro', Accept:'*/*' };
const browser = await chromium.launch({ executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
try {
  for (const [season, episode] of [[1,1],[2,1],[2,2],[2,10],[3,1]]) {
    try {
      const res = await fetch(seriesSourceUrl('206343',season,episode), { headers,signal:AbortSignal.timeout(30000) });
      if (!res.ok) { console.log(`::notice title=Quality S${season}E${episode}::API HTTP ${res.status}`); continue; }
      const data = await res.json(), stream = data.stream || {};
      const qualities = Object.entries(stream.qualities || {}).map(([k,v])=>({quality:k,type:v?.type,codec:v?.codecName,proxy:!!v?.requiresProxy}));
      let playlist = {present:!!stream.playlist};
      if (stream.playlist) {
        try {
          const m = await fetch(stream.playlist,{headers,signal:AbortSignal.timeout(20000)});
          const text = m.ok ? await m.text() : '';
          playlist = { status:m.status, resolutions:[...text.matchAll(/RESOLUTION=(\d+x\d+)/g)].map(x=>x[1]), variants:(text.match(/#EXT-X-STREAM-INF/g)||[]).length, isHls:text.startsWith('#EXTM3U') };
        } catch { playlist = {present:true,fetch:'unavailable'}; }
      }
      console.log(`::notice title=Quality S${season}E${episode}::${JSON.stringify({qualities,playlist})}`);
    } catch { console.log(`::notice title=Quality S${season}E${episode}::API unavailable`); }
  }
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await page.goto('https://vidlink.pro/tv/206343/2/1',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('video').waitFor({timeout:45000});
  await page.locator('video').evaluate(v=>v.play().catch(()=>{}));
  await page.waitForTimeout(25000);
  const result = await page.evaluate(() => ({
    video:[...document.querySelectorAll('video')].map(v=>({width:v.videoWidth,height:v.videoHeight,time:v.currentTime,error:v.error?.code||null})),
    buttons:[...document.querySelectorAll('button')].slice(0,60).map(b=>({label:b.getAttribute('aria-label'),title:b.getAttribute('title'),text:b.innerText?.trim().slice(0,60)})),
    text:document.body.innerText.slice(0,1500)
  }));
  console.log(`::notice title=Season 2 player controls::${JSON.stringify(result).replace(/%/g,'%25')}`);
  await page.close();
} finally { await browser.close(); }
