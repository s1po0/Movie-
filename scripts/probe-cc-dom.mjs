import { chromium } from 'playwright-core';
import { withSubtitleTrack, subtitleTrackUrl } from '../src/menu-subtitles.js';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const p=await browser.newPage({viewport:{width:390,height:844}}); const token='0123456789abcdef0123456789abcdef';
try {
 await p.route(subtitleTrackUrl(token), r=>r.fulfill({status:200,contentType:'text/vtt',body:'WEBVTT\n\n00:00:00.000 --> 00:10:00.000\nسڵاو\n'}));
 await p.goto('http://127.0.0.1:5173/'); await p.locator('[data-play="cinebloom-155"]').first().click();
 await p.frameLocator('iframe').locator('video').waitFor({timeout:40000});
 await p.locator('iframe').evaluate((el,src)=>el.src=src,withSubtitleTrack('https://vidlink.pro/movie/155',token));
 const f=p.frameLocator('iframe'); await f.locator('video').waitFor({timeout:40000}); await p.waitForTimeout(8000);
 const frame=p.frames().find(f=>f.url().includes('sub_file='));
 const data=await frame.evaluate(()=>({
  cc:Array.from(document.querySelectorAll('button')).filter(e=>e.outerHTML.toLowerCase().includes('subtitle')||e.outerHTML.toLowerCase().includes('caption')).map(e=>e.outerHTML.slice(0,1400)).slice(0,12),
  sorani:Array.from(document.querySelectorAll('*')).filter(e=>e.children.length===0&&e.textContent.trim()==='کوردی سۆرانی').map(e=>e.parentElement?.outerHTML.slice(0,1800)).slice(0,6)
 }));
 console.log(`::notice title=CC DOM::${JSON.stringify(data)}`);
} catch(e){console.log(`::error title=CC probe::${String(e.message).split('\n')[0]}`);process.exitCode=1;} finally{await browser.close();}
