// Test the installed app with live provider search, exact episode selection and real video advancement.
let socket;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 const pages=await(await fetch('http://127.0.0.1:9222/json')).json(),page=pages.find(p=>p.type==='page'&&/localhost/.test(p.url));if(!page)throw Error('App WebView missing');
 const ws=new URL(page.webSocketDebuggerUrl);ws.host='127.0.0.1:9222';socket=new WebSocket(ws.href);await new Promise((ok,no)=>{socket.onopen=ok;socket.onerror=no});let seq=0,pending=new Map();socket.onmessage=e=>{const d=JSON.parse(e.data),p=pending.get(d.id);if(!p)return;pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result)};
 const evaluate=expression=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve:r=>r.exceptionDetails?reject(Error(r.exceptionDetails.text)):resolve(r.result.value),reject});socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true,userGesture:true}}))});
 const wait=async(name,fn,timeout=90000)=>{const end=Date.now()+timeout;while(Date.now()<end){try{const v=await fn();if(v)return v}catch{}await sleep(1000)}throw Error('Timeout: '+name+'; status='+await evaluate("document.querySelector('#lm-status')?.textContent||document.querySelector('#donghua-status')?.textContent||''"))};
 async function play({query,id,title,ep}){
  await evaluate(`{const s=document.querySelector('#donghua-search');s.value=${JSON.stringify(query)};s.dispatchEvent(new Event('input',{bubbles:true}));}`);
  await wait('AniList result '+id,()=>evaluate(`Boolean(document.querySelector('[data-play="donghua-${id}"]'))`));await evaluate(`document.querySelector('[data-play="donghua-${id}"]').click(); document.querySelector('#lm-panel').open=true; document.querySelector('#lm-search').value=${JSON.stringify(query)}; document.querySelector('[data-action="lm-search"]').click()`);
  await wait('LM search '+title,()=>evaluate(`Array.from(document.querySelector('#lm-series').options).some(o=>o.textContent===${JSON.stringify(title)})`));
  await evaluate(`{let s=document.querySelector('#lm-series');s.value=Array.from(s.options).find(o=>o.textContent===${JSON.stringify(title)}).value;document.querySelector('[data-action="lm-series"]').click()}`);
  await wait('LM episode '+ep,()=>evaluate(`Array.from(document.querySelector('#lm-episode').options).some(o=>o.textContent===${JSON.stringify(ep)})`));
  await evaluate(`{let s=document.querySelector('#lm-episode');s.value=Array.from(s.options).find(o=>o.textContent===${JSON.stringify(ep)}).value;document.querySelector('[data-action="lm-play"]').click()}`);
  await wait('direct player '+ep,()=>evaluate('Boolean(document.querySelector("#video"))'),120000);
  await evaluate("{let v=document.querySelector('#video');v.muted=true;v.play().catch(()=>{})}");
  const video=await wait('direct video advances '+ep,()=>evaluate("(()=>{let v=document.querySelector('#video');return v&&v.currentTime>2&&v.videoWidth>0?{time:v.currentTime,width:v.videoWidth,height:v.videoHeight,duration:v.duration}:null})()"),120000);
  console.log(`::notice title=Android direct Donghua::${ep} advanced ${Math.round(video.time)}s ${video.width}x${video.height}, duration ${Math.round(video.duration)}s.`);
  await evaluate("document.querySelector('[data-action=close-player]').click()");
 }
 await wait('catalog UI',()=>evaluate("Boolean(document.querySelector('#donghua-search'))"));
 await play({query:'Swallowed Star',id:117012,title:'Swallowed Star',ep:'Swallowed Star Episode 100'});
 await play({query:'Renegade Immortal',id:137653,title:'Renegade Immortal',ep:'Renegade Immortal Episode 01'});
}catch(e){console.log('::error title=Android direct Donghua::'+String(e.message).slice(0,400));process.exitCode=1}finally{socket?.close()}
