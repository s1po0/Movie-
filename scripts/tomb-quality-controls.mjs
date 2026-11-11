import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath:'/usr/bin/google-chrome', headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  try {
    await page.goto('https://vidlink.pro/tv/206343/2/10',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForTimeout(15000);
    const details = await page.evaluate(() => ({title:document.title,text:document.body.innerText.slice(0,2200),video:[...document.querySelectorAll('video')].map(v=>({width:v.videoWidth,height:v.videoHeight,ready:v.readyState,time:v.currentTime,error:v.error?.code||null})),buttons:[...document.querySelectorAll('button')].slice(0,80).map(b=>({label:b.getAttribute('aria-label'),title:b.getAttribute('title'),text:b.innerText?.trim().slice(0,50)}))}));
    console.log(`::notice title=Provider player::${JSON.stringify(details).replace(/%/g,'%25')}`);
    const settings = await page.evaluate(() => { const quality=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Quality')); return quality ? {button:quality.outerHTML.slice(0,1200), parent:quality.parentElement?.outerHTML.slice(0,2200)} : null; });
    console.log(`::notice title=Quality DOM::${JSON.stringify(settings).replace(/%/g,'%25')}`);
    if (await page.locator('video').count()) {
      await page.locator('video').first().evaluate(v=>v.play().catch(()=>{})); await page.waitForTimeout(10000);
      const video = await page.locator('video').first().evaluate(v=>({width:v.videoWidth,height:v.videoHeight,time:v.currentTime,ready:v.readyState,error:v.error?.code||null}));
      console.log(`::notice title=Actual playback::${JSON.stringify(video)}`);
    }
  } catch(e) { console.log(`::notice title=Provider player::Unavailable (${e.name})`); }
  await page.close();
} finally { await browser.close(); }
