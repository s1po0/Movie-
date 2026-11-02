import { chromium } from 'playwright-core';
const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome', headless:true,args:['--no-sandbox']});
const page = await browser.newPage({viewport:{width:390,height:844}});
let subtitleRequests = 0;
try {
  await page.route('https://vidlink.pro/dimo-sorani.vtt', route => { subtitleRequests++; route.fulfill({status:200,contentType:'text/vtt',headers:{'Access-Control-Allow-Origin':'*'},body:'WEBVTT\n\n00:00:00.000 --> 00:10:00.000\nسڵاو تاقیکردنەوە\n'}); });
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-play="cinebloom-155"]').first().click();
  await page.locator('#player-modal iframe').evaluate(el => { const u = new URL(el.src); u.searchParams.set('sub_file','https://vidlink.pro/dimo-sorani.vtt'); u.searchParams.set('sub_label','کوردی سۆرانی'); el.src=u.toString(); });
  const frame = page.frameLocator('#player-modal iframe');
  await frame.locator('video').waitFor({timeout:40000});
  await page.waitForTimeout(6000);
  const f=page.frames().find(f=>f.url().startsWith('https://vidlink.pro/movie/'));
  const controls=await f.locator('button').evaluateAll(nodes => nodes.map(e=>({text:e.innerText,aria:e.getAttribute('aria-label'),title:e.getAttribute('title')})).filter(x=>x.aria||x.title||x.text).slice(0,50));
  console.log(`::notice title=Provider controls::${JSON.stringify(controls)}`);
  console.log(`::notice title=Provider page text::${(await f.locator('body').innerText()).replace(/\s+/g,' ').slice(0,1400)}`);
  console.log(`::notice title=Subtitle requests::${subtitleRequests}`);
  const subtitles=f.getByRole('button',{name:/subtitles/i}).first();
  if(await subtitles.count()) { await subtitles.click(); await page.waitForTimeout(1500); console.log(`::notice title=Subtitle menu::${(await f.locator('body').innerText()).replace(/\s+/g,' ').slice(0,1400)}`); }
  console.log(`::notice title=Final subtitle requests::${subtitleRequests}`);
} catch(e) { console.log(`::warning title=Menu probe::${String(e.message).split('\n')[0]}`); }
finally {await browser.close();}
