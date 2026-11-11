import http from 'node:http';
import { chromium } from 'playwright-core';
const server = http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end(`<!doctype html><meta name="viewport" content="width=device-width"><iframe allow="autoplay; fullscreen" style="width:390px;height:220px" src="https://embed.vidrift.net/embed/tv/206343/2/10?autoplay=0"></iframe><script>window.states=[]; addEventListener('message',e=>{if(e.origin==='https://embed.vidrift.net' && e.source===document.querySelector('iframe').contentWindow && ['vidrift:state','vidrift:command-error'].includes(e.data?.type))states.push(e.data)});</script>`);});
await new Promise(r=>server.listen(4176,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto('http://127.0.0.1:4176/');
 const iframe=page.locator('iframe'); await iframe.waitFor(); await page.waitForTimeout(10000);
 await page.evaluate(()=>document.querySelector('iframe').contentWindow.postMessage({type:'vidrift:get-state'},'https://embed.vidrift.net'));
 await page.waitForTimeout(40000);
 let values=await page.evaluate(()=>window.states.filter(s=>s.type==='vidrift:state').map(s=>({qualities:s.qualities,quality:s.quality,servers:s.servers,paused:s.paused,currentTime:s.currentTime})).slice(-1));
 const frame=page.frameLocator('iframe');const count=await frame.locator('video').count();let video={};if(count){video=await frame.locator('video').first().evaluate(v=>({width:v.videoWidth,height:v.videoHeight,paused:v.paused,time:v.currentTime,ready:v.readyState}));}
 const text=await frame.locator('body').innerText().catch(()=> 'unavailable');
 console.log(`::notice title=Alternative source::${JSON.stringify({states:values,video,failed:/won.t play|Every source|failed to respond/i.test(text)})}`);
} catch(e){console.log(`::notice title=Alternative source::Unavailable (${e.name})`);} finally {await browser.close();await new Promise(r=>server.close(r));}
