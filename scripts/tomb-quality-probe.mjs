import { chromium } from 'playwright-core';
import { seriesSourceUrl } from '../src/vidlink.js';
const browserHeaders = { 'User-Agent':'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', Referer:'https://vidlink.pro/tv/206343/2/1', Origin:'https://vidlink.pro', Accept:'*/*' };
const browser = await chromium.launch({ executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
try {
  for (const [season, episode] of [[2,1],[2,2],[2,10],[3,1]]) {
    try {
      const res = await fetch(seriesSourceUrl('206343',season,episode), { headers:browserHeaders,signal:AbortSignal.timeout(45000) });
      if (!res.ok) { console.log(`::notice title=Quality S${season}E${episode}::API HTTP ${res.status}`); continue; }
      const data = await res.json(), stream = data.stream || {};
      const entries = Object.entries(stream.qualities || {}), qualities = [];
      for (const [k,v] of entries) {
        let url; try { url = new URL(v?.url); } catch { continue; }
        let check = {};
        try {
          const r = await fetch(url.href, { headers:{...browserHeaders,Range:'bytes=0-127'}, signal:AbortSignal.timeout(15000),redirect:'follow' });
          check = {status:r.status, mime:r.headers.get('content-type'), ranges:r.headers.get('accept-ranges'), contentRange:!!r.headers.get('content-range'), cors:r.headers.get('access-control-allow-origin')};
          await r.body?.cancel();
        } catch(e) { check = {error:e.name}; }
        qualities.push({quality:k,type:v.type,codec:v.codecName,proxy:!!v.requiresProxy,host:url.hostname,check});
      }
      console.log(`::notice title=Quality S${season}E${episode}::${JSON.stringify({qualities,playlist:!!stream.playlist})}`);
    } catch(e) { console.log(`::notice title=Quality S${season}E${episode}::API unavailable (${e.name})`); }
  }
  const page = await browser.newPage({viewport:{width:390,height:844}});
  try {
    await page.goto('https://vidlink.pro/tv/206343/2/1',{waitUntil:'domcontentloaded',timeout:45000});
    await page.locator('video').waitFor({timeout:60000});
    await page.locator('video').evaluate(v=>v.play().catch(()=>{})); await page.waitForTimeout(12000);
    const result = await page.evaluate(() => ({video:[...document.querySelectorAll('video')].map(v=>({width:v.videoWidth,height:v.videoHeight,time:v.currentTime,error:v.error?.code||null})), buttons:[...document.querySelectorAll('button')].slice(0,60).map(b=>({label:b.getAttribute('aria-label'),title:b.getAttribute('title'),text:b.innerText?.trim().slice(0,60)})),text:document.body.innerText.slice(0,1500)}));
    console.log(`::notice title=Season 2 player controls::${JSON.stringify(result).replace(/%/g,'%25')}`);
  } catch(e) { console.log(`::notice title=Season 2 player controls::Unavailable (${e.name})`); }
  await page.close();
} finally { await browser.close(); }
