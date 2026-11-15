// Opens real catalog entries in the app and verifies actual Android video advancement.
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket;
try{
 const pages=await(await fetch('http://127.0.0.1:9222/json')).json(),page=pages.find(x=>x.type==='page'&&/localhost/.test(x.url));if(!page)throw Error('WebView missing');
 const ws=new URL(page.webSocketDebuggerUrl);ws.host='127.0.0.1:9222';socket=new WebSocket(ws.href);await new Promise((ok,no)=>{socket.onopen=ok;socket.onerror=no});let seq=0,pending=new Map(),contexts=new Map();
 socket.onmessage=e=>{const d=JSON.parse(e.data);if(d.method==='Runtime.executionContextCreated')contexts.set(d.params.context.id,d.params.context);else if(d.method==='Runtime.executionContextDestroyed')contexts.delete(d.params.executionContextId);const p=pending.get(d.id);if(!p)return;pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result)};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))});
 const evaluate=async(expression,contextId)=>{const o=await call('Runtime.evaluate',{expression,contextId,awaitPromise:true,returnByValue:true,userGesture:true});if(o.exceptionDetails)throw Error(o.exceptionDetails.text);return o.result.value};
 const wait=async(name,fn,ms=90000)=>{const until=Date.now()+ms;let value;while(Date.now()<until){try{value=await fn();if(value)return value}catch{}await sleep(1000)}throw Error('Timed out: '+name)};
 await call('Runtime.enable');await call('Page.enable');
 const ctxFor=async(id,episode)=>{for(const c of contexts.values())if(c.origin==='https://megavid.buzz')try{if(await evaluate('location.pathname',c.id)===`/ani/${id}/${episode}/sub`)return c.id}catch{}return 0};
 const testPlayback=async(id)=>{
   const ctx=await wait('player frame '+id,()=>ctxFor(id,1));
   await wait('video element '+id,()=>evaluate("Boolean(document.querySelector('video'))",ctx));
   await evaluate("{let v=document.querySelector('video');v.muted=true;v.play().catch(()=>{})}",ctx);
   const info=await wait('video plays '+id,()=>evaluate("(()=>{let v=document.querySelector('video');return v&&v.currentTime>2&&v.videoWidth>0?{time:v.currentTime,width:v.videoWidth,height:v.videoHeight,duration:v.duration}:null})()",ctx),120000);
   console.log(`::notice title=Android actual Donghua video::AniList ${id}, advancing video ${Math.round(info.time)}s, ${info.width}x${info.height}, duration ${Math.round(info.duration)}s.`);
 };
 await wait('catalog',()=>evaluate("Boolean(document.querySelector('#donghua-cards [data-play=\"donghua-126403\"]'))"));
 await evaluate("document.querySelector('#donghua-cards [data-play=\"donghua-126403\"]').click()");
 await testPlayback(126403);
 await evaluate("document.querySelector('[data-episode-step=\"1\"]').click();document.querySelector('[data-action=donghua-anime-play]').click()");
 await wait('episode 2',()=>evaluate("Boolean(document.querySelector('#player-modal iframe[src=\"https://megavid.buzz/ani/126403/2/sub\"]'))"));
 await evaluate("document.querySelector('[data-action=close-player]').click();let k=document.querySelector('#donghua-kind');k.value='movie';k.dispatchEvent(new Event('change',{bubbles:true}));let s=document.querySelector('#donghua-search');s.value='The Legend of Hei';s.dispatchEvent(new Event('input',{bubbles:true}))");
 await wait('movie result',()=>evaluate("Boolean(document.querySelector('#donghua-cards [data-play=\"donghua-112023\"]'))"));
 await evaluate("document.querySelector('#donghua-cards [data-play=\"donghua-112023\"]').click()");
 await testPlayback(112023);
}catch(e){console.log('::error title=Android Donghua playback::'+String(e.message).split('\n')[0]);process.exitCode=1}finally{socket?.close()}
