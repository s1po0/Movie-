import {chromium} from 'playwright-core';
import {DONGHUA_API,DONGHUA_QUERY,donghuaVariables,donghuaCatalog} from '../src/donghua-catalog.js';
import http from 'node:http';
const get=async kind=>{const r=await fetch(DONGHUA_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:DONGHUA_QUERY,variables:donghuaVariables(1,'',kind)})});if(!r.ok)throw Error('AniList '+r.status);return donghuaCatalog(await r.json()).movies};
const series=await get('series'),movies=await get('movie');const list=[...series.slice(0,8),...movies.slice(0,3)];
const server=http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end('<!doctype html><main></main>')});await new Promise(r=>server.listen(5179,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
try{await Promise.all(list.map(async item=>{const page=await browser.newPage({viewport:{width:800,height:650}});try{
 await page.goto('http://127.0.0.1:5179/');await page.evaluate(id=>{const f=document.createElement('iframe');f.src=`https://megavid.buzz/ani/${id}/1/sub`;f.width=750;f.height=450;f.allow='autoplay; fullscreen';f.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');document.querySelector('main').append(f)},item.anilistId);
 await page.waitForTimeout(22000);let frames=page.frames().filter(f=>f!==page.mainFrame());for(const f of frames)try{await f.evaluate(()=>{for(const v of document.querySelectorAll('video')){v.muted=true;v.play().catch(()=>{})}})}catch{}
 await page.waitForTimeout(9000);frames=page.frames().filter(f=>f!==page.mainFrame());let rows=[];for(const f of frames)try{rows.push(await f.evaluate(()=>({host:location.hostname,text:document.body?.innerText?.replace(/\s+/g,' ').slice(0,140),videos:[...document.querySelectorAll('video')].map(v=>({time:v.currentTime,duration:v.duration,ready:v.readyState,paused:v.paused,error:v.error?.code,width:v.videoWidth,height:v.videoHeight,tracks:[...v.textTracks].map(t=>({language:t.language,label:t.label,mode:t.mode}))}))})))}catch{}
 console.log(`::notice title=${item.title} (${item.anilistId})::${JSON.stringify(rows).replace(/%/g,'%25').slice(0,1000)}`);
}catch(e){console.log(`::notice title=${item.title}::${String(e.message).slice(0,100)}`)}finally{await page.close()}}));}finally{await browser.close();server.close()}
