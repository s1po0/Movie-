import { chromium } from 'playwright-core';
import { withSubtitleTrack, subtitleTrackUrl } from '../src/menu-subtitles.js';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const p=await browser.newPage({viewport:{width:390,height:844}}); const token='0123456789abcdef0123456789abcdef';
p.on('console', msg => { if (msg.text().startsWith('DIMO_AD_ORIGIN')) console.log('::notice title=Overlay origin::' + msg.text().replace(/\n/g,' | ').slice(0,1800)); });
await p.addInitScript(() => {
 const descriptor=Object.getOwnPropertyDescriptor(Element.prototype,'id');
 Object.defineProperty(Element.prototype,'id',{...descriptor,set(value){if(value==='dontfoid') console.log('DIMO_AD_ORIGIN id '+new Error().stack); return descriptor.set.call(this,value);}});
 const set=Element.prototype.setAttribute;
 Element.prototype.setAttribute=function(name,value){if(name==='id'&&value==='dontfoid') console.log('DIMO_AD_ORIGIN attribute '+new Error().stack); return set.call(this,name,value)};
 const append=Node.prototype.appendChild;
 Node.prototype.appendChild=function(node){if(node.id==='dontfoid') console.log('DIMO_AD_ORIGIN append '+new Error().stack); return append.call(this,node)};
});
try {
 await p.route(subtitleTrackUrl(token), r=>r.fulfill({status:200,contentType:'text/vtt',body:'WEBVTT\n\n00:00:00.000 --> 00:10:00.000\nسڵاو\n'}));
 await p.goto('http://127.0.0.1:5173/'); await p.locator('[data-play="cinebloom-155"]').first().click();
 await p.frameLocator('iframe').locator('video').waitFor({timeout:40000});
 await p.locator('iframe').evaluate((el,src)=>el.src=src,withSubtitleTrack('https://vidlink.pro/movie/155',token));
 const f=p.frameLocator('iframe'); await f.locator('video').waitFor({timeout:40000}); await p.waitForTimeout(8000);
 const frame=p.frames().find(f=>f.url().includes('sub_file='));
 await frame.evaluate(() => document.querySelector('#dontfoid')?.remove());
 // The provider can initialize with the menu already open; avoid toggling it shut.
 const sorani=f.locator('[role="menuitemradio"]:visible').filter({hasText:'کوردی سۆرانی'}).first();
 if (!await sorani.isVisible()) { await f.locator('#media-menu-button-1').focus(); await p.keyboard.press('Enter'); }
 await sorani.waitFor({state:'visible',timeout:10000});
 await sorani.click({timeout:10000});
 const checked=await sorani.getAttribute('aria-checked');
 if(checked!=='true') throw Error(`Sorani selection did not apply: ${checked}`);
 console.log('::notice title=Player caption selection::Selected Sorani in the CC menu after removing the provider ad for this test');
} catch(e){console.log(`::error title=CC probe::${String(e.message).replace(/\n/g,' | ').slice(0,1200)}`);process.exitCode=1;} finally{await browser.close();}
