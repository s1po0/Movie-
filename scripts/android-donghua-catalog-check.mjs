import { DONGHUA_QUERY, donghuaVariables } from '../src/donghua-catalog.js';
let socket, evaluate;
try {
 const pages=await(await fetch('http://127.0.0.1:9222/json')).json(); const pg=pages.find(x=>x.type==='page'&&/localhost/.test(x.url));if(!pg)throw Error('No WebView');
 const ws=new URL(pg.webSocketDebuggerUrl);ws.host='127.0.0.1:9222';socket=new WebSocket(ws.href);await new Promise((ok,no)=>{socket.onopen=ok;socket.onerror=no});let seq=0;const pending=new Map();socket.onmessage=e=>{const d=JSON.parse(e.data),p=pending.get(d.id);if(!p)return;pending.delete(d.id);d.error?p.reject(Error(d.error.message)):d.result.exceptionDetails?p.reject(Error(d.result.exceptionDetails.text)):p.resolve(d.result.result.value)};
 evaluate=expression=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}))});
 const wait=async(name,fn,ms=90000)=>{const until=Date.now()+ms;while(Date.now()<until){const x=await fn();if(x)return x;await new Promise(r=>setTimeout(r,1000))}throw Error('Timed out: '+name)};
 const count=await wait('catalog',()=>evaluate("document.querySelectorAll('#donghua-cards .catalog-card').length"));
 if(count<10)throw Error('Catalog returned fewer than 10 titles');
 await evaluate("document.querySelector('#donghua-more').click()");await wait('page 2',()=>evaluate(`document.querySelectorAll('#donghua-cards .catalog-card').length > ${count}`));
 await evaluate("document.querySelector('#donghua-cards [data-play=donghua-126403]').click()");
 await wait('mapped Link Click player',()=>evaluate("Boolean(document.querySelector('#player-modal iframe[src*=\"/tv/123542/1/1\"]'))"));
 const subtitle=await wait('subtitle attempt',()=>evaluate("document.querySelector('#embedded-subtitle-status')?.textContent || ''"));
 console.log(`::notice title=Android Donghua catalog::Live pages and Link Click mapped player opened. A player frame is not a playback or subtitle quality test; subtitle status ${subtitle.slice(0,80)}.`);
}catch(e){console.log('::error title=Android Donghua catalog::'+e.message.split('\n')[0]);try{console.log('::notice title=Android catalog state::'+JSON.stringify(await evaluate("({status:document.querySelector('#donghua-status')?.textContent, count:document.querySelectorAll('#donghua-cards .catalog-card').length})")))}catch{};try {const opts={url:'https://graphql.anilist.co',headers:{'Content-Type':'application/json'},data:{query:DONGHUA_QUERY,variables:donghuaVariables(1)},responseType:'json',connectTimeout:15000,readTimeout:20000}; console.log('::notice title=Android catalog HTTP::'+JSON.stringify(await evaluate(`window.Capacitor.nativePromise('CapacitorHttp','post',${JSON.stringify(opts)}).then(x=>({status:x.status,errors:x.data?.errors,count:x.data?.data?.Page?.media?.length})).catch(e=>({error:String(e)}))`)))}catch{};process.exitCode=1}finally{socket?.close()}
