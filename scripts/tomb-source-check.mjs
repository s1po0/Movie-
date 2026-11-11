import { chromium } from 'playwright-core';
const urls=[
 ['WMDM-1-1','https://www.wmdm.cc/html/31-1-1.html'],['WMDM-2-1','https://www.wmdm.cc/html/31-2-1.html'],['WMDM-3-1','https://www.wmdm.cc/html/31-3-1.html'],['WMDM-4-1','https://www.wmdm.cc/html/31-4-1.html'],
 ['Donghua-1','https://donghuastream.org/tomb-of-fallen-gods-season-2-episode-1-17-multiple-subtitles/'],
 ['Donghua-10','https://donghuastream.org/tomb-of-fallen-gods-season-2-episode-10-26-multiple-subtitles/'],
 ['Donghua-27','https://donghuastream.org/tomb-of-fallen-gods-season-2-episode-27-43-multiple-subtitles/'],
 ['Aidianying-1','https://www.7ighz2.com/vod/play/122700/1/1026670'],
 ['Lucifer-1','https://luciferdonghua.org/tomb-of-fallen-gods-season-2-episode-1-english-subtitles/']
];
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
async function probe([name,url]) {
 const page=await browser.newPage({viewport:{width:390,height:844}}); const failures=[];
 page.on('requestfailed',req=>{try {let h=new URL(req.url()).hostname;if(failures.length<8&&!failures.includes(h))failures.push(h)} catch{}});
 try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(10000);
  for(const f of page.frames()) { try{await f.evaluate(()=>document.querySelectorAll('video').forEach(v=>{v.muted=true;v.play().catch(()=>{})}))}catch{} }
  await page.waitForTimeout(25000);
  const frames=[];
  for(const f of page.frames()) { try {const info=await f.evaluate(()=>({videos:[...document.querySelectorAll('video')].map(v=>({width:v.videoWidth,height:v.videoHeight,time:Math.round(v.currentTime),duration:Math.round(v.duration)||0,ready:v.readyState,error:v.error?.code||null})),hasError:/Video load failed|not available in your area/i.test(document.body?.innerText||'')}));if(info.videos.length||info.hasError)frames.push({host:new URL(f.url()).hostname,...info});}catch{} }
  console.log(`::notice title=${name}::${JSON.stringify({http:response?.status(),frames,failures})}`);
 } catch(e){console.log(`::notice title=${name}::${e.name}`)}finally{await page.close()}
}
try { for(let i=0;i<urls.length;i+=3) await Promise.all(urls.slice(i,i+3).map(probe)); }finally{await browser.close()}
