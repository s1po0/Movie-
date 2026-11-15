import { chromium } from 'playwright-core';
import http from 'node:http';
const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html');res.end('<!doctype html><title>player test</title><main></main>')});
await new Promise(r=>server.listen(5179,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const candidates=[
 ['Link Click animeembed','https://aniembed.se/e/126403/1'],
 ['Link Click vidlink','https://vidlink.pro/tv/123542/1/1'],
 ['Link Click megavid','https://megavid.buzz/ani/126403/1/sub'],
 ['Mo Dao Zu Shi animeembed','https://aniembed.se/e/101922/1'],
 ['Hei movie animeembed','https://aniembed.se/e/112023/1'],
 ['Tomb animeembed','https://aniembed.se/e/142751/1']
];
try {
 await Promise.all(candidates.map(async ([name,url])=>{
  const page=await browser.newPage({viewport:{width:800,height:650}});let errors=[];
  page.on('requestfailed',r=>{const host=new URL(r.url()).hostname;if(errors.length<8)errors.push(`${host}:${r.failure()?.errorText}`)});
  try {
   await page.goto('http://127.0.0.1:5179/');
   await page.evaluate(url=>{const f=document.createElement('iframe');f.src=url;f.width=750;f.height=450;f.allow='autoplay; fullscreen';document.querySelector('main').append(f)},url);
   await page.waitForTimeout(22000);
   let frames=page.frames().filter(f=>f!==page.mainFrame());
   for(const f of frames){try{await f.evaluate(()=>{for(const v of document.querySelectorAll('video')){v.muted=true;v.play().catch(()=>{})}})}catch{}}
   await page.waitForTimeout(12000);
   frames=page.frames().filter(f=>f!==page.mainFrame());let rows=[];
   for(const frame of frames){try {const info=await frame.evaluate(()=>({host:location.hostname,text:document.body?.innerText?.replace(/\s+/g,' ').slice(0,300), videos:[...document.querySelectorAll('video')].map(v=>({time:v.currentTime,duration:v.duration,ready:v.readyState,paused:v.paused,error:v.error?.code, tracks:v.textTracks.length,width:v.videoWidth,height:v.videoHeight}))}));rows.push(info)}catch{}}
   console.log(`::notice title=${name}::${JSON.stringify({frames:rows,errors}).replace(/%/g,'%25').slice(0,1400)}`);
  }catch(e){console.log(`::notice title=${name}::Error ${String(e.message).slice(0,100)}`)} finally{await page.close()}
 }));
}finally{await browser.close();server.close()}
