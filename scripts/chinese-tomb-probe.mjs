import { chromium } from 'playwright-core';
const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
try {
 for (const ep of [1,10]) {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  try {
   const response=await page.goto(`https://www.nivod.cc/vodplay/202421913/ep${ep}`,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForTimeout(8000);
   if(await page.locator('video').count()) await page.locator('video').first().evaluate(v=>{v.muted=true;v.play().catch(()=>{});});
   await page.waitForTimeout(20000);
   const state=await page.evaluate(()=>({videos:[...document.querySelectorAll('video')].map(v=>({width:v.videoWidth,height:v.videoHeight,time:v.currentTime,ready:v.readyState,error:v.error?.code||null})),failed:/Video load failed|播放失败|播放出错/.test(document.body.innerText)}));
   console.log(`::notice title=Chinese source episode ${ep}::${JSON.stringify({http:response?.status(),...state})}`);
  } catch(e){console.log(`::notice title=Chinese source episode ${ep}::Unavailable (${e.name})`);}
  await page.close();
 }
} finally {await browser.close();}
