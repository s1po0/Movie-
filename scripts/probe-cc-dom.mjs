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
 const data=await frame.evaluate(()=>({buttons:Array.from(document.querySelectorAll('button')).slice(0,15).map(e=>({aria:e.getAttribute('aria-label'),title:e.title,tip:e.getAttribute('data-media-tooltip'),text:e.innerText,role:e.getAttribute('role'),id:e.id,cls:e.className,markup:e.outerHTML.slice(0,250)}))}));
 console.log(`::notice title=CC DOM::${JSON.stringify(data)}`);
} catch(e){console.log(`::error title=CC probe::${String(e.message).split('\n')[0]}`);process.exitCode=1;} finally{await browser.close();}
