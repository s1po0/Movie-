import { chromium } from 'playwright-core';
const manifests = [
 ['S2E1','https://tyyszywvod.com/videos/202601/22/69706ee851e70a99a2683e3e/bfgf31/index.m3u8'],
 ['S2E10','https://tyyszywvod.com/videos/202601/22/69706ef351e70a99a2683e41/09107a/index.m3u8'],
 ['S2E27','https://tyyszywvod.com/videos/202601/22/69706f1351e70a99a2683e50/9ce548/index.m3u8']
];
for (const [name,url] of manifests) {
 try {
  const r=await fetch(url,{signal:AbortSignal.timeout(15000)}); const text=await r.text();
  const match=text.match(/RESOLUTION=(\d+x\d+)/g)||[];
  console.log(`::notice title=${name} HLS::${JSON.stringify({status:r.status,valid:text.startsWith('#EXTM3U'),encryption:/#EXT-X-KEY/.test(text),master:/#EXT-X-STREAM-INF/.test(text),cors:r.headers.get('access-control-allow-origin'),resolutions:match.slice(0,10)})}`);
 } catch(e) { console.log(`::notice title=${name} HLS::Unavailable (${e.name})`); }
}
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
try {
 await Promise.all([1,10,27].map(async ep=>{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  try {
   const response=await page.goto(`https://tyyszy4.com/index.php/vod/play/id/2287/sid/1/nid/${ep}.html`,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForTimeout(10000);if(await page.locator('video').count())await page.locator('video').first().evaluate(v=>{v.muted=true;v.play().catch(()=>{})});await page.waitForTimeout(15000);
   const state=await page.evaluate(()=>({videos:[...document.querySelectorAll('video')].map(v=>({width:v.videoWidth,height:v.videoHeight,time:v.currentTime,ready:v.readyState,error:v.error?.code||null}))}));
   console.log(`::notice title=Chinese page S2E${ep}::${JSON.stringify({http:response?.status(),...state})}`);
  } catch(e) {console.log(`::notice title=Chinese page S2E${ep}::Unavailable (${e.name})`);}finally{await page.close();}
 }));
} finally {await browser.close();}
