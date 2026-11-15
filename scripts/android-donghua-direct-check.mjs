// Test the installed app with live provider search, exact episode selection and real video advancement.
import {execFileSync} from 'node:child_process';
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8'});
let socket;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 const pages=await(await fetch('http://127.0.0.1:9222/json')).json(),page=pages.find(p=>p.type==='page'&&/localhost/.test(p.url));if(!page)throw Error('App WebView missing');
 const ws=new URL(page.webSocketDebuggerUrl);ws.host='127.0.0.1:9222';socket=new WebSocket(ws.href);await new Promise((ok,no)=>{socket.onopen=ok;socket.onerror=no});let seq=0,pending=new Map();socket.onmessage=e=>{const d=JSON.parse(e.data),p=pending.get(d.id);if(!p)return;pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result)};
 const evaluate=expression=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve:r=>r.exceptionDetails?reject(Error(r.exceptionDetails.text)):resolve(r.result.value),reject});socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true,userGesture:true}}))});
 const wait=async(name,fn,timeout=90000)=>{const end=Date.now()+timeout;while(Date.now()<end){try{const v=await fn();if(v)return v}catch{}await sleep(1000)}throw Error('Timeout: '+name+'; status='+await evaluate("document.querySelector('#lm-status')?.textContent||document.querySelector('#donghua-status')?.textContent||''"))};
 async function play({query,id,title,ep,translation=false}){
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
  if (translation) {
   const srt='1\n00:00:01,000 --> 00:00:04,000\nHola, amigo.\n\n2\n00:00:05,000 --> 00:00:08,000\nVamos a casa.\n\n3\n00:00:09,000 --> 00:00:12,000\nHasta mañana.\n';
   await evaluate(`{let f=document.querySelector('#subtitle-file'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(srt)}],'test.srt',{type:'text/plain'}));f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}));}`);
   await wait('sample subtitle loaded',()=>evaluate("document.querySelector('#subtitle-status')?.textContent.includes('3')"));
   await evaluate("document.querySelector('#language').value='ckb';document.querySelector('#translate').click()");
   await wait('Sorani translated track',()=>evaluate("Boolean(document.querySelector('track[data-external=translated]'))"),120000);
   const info=await evaluate("(()=>{let t=document.querySelector('track[data-external=translated]')?.track;return {lang:t?.language,cues:t?.cues?.length,first:t?.cues?.[0]?.text}})()");
   if(info.lang!=='ckb'||!/[\u0600-\u06ff]/.test(info.first||''))throw Error('Sorani sample translation missing');
   console.log('::notice title=Android sample translation::Uploaded Spanish test cues translated to a Sorani text track on the direct player; not a source subtitle accuracy test.');
   adb('logcat','-c');await evaluate("document.querySelector('[data-action=one-dm]').click()");
   await wait('1DM intent',()=>adb('logcat','-d','-s','OneDmFixture:I','*:S').includes('download=https://vd'),30000);
   adb('shell','input','keyevent','4');await sleep(2000);
   console.log('::notice title=Direct 1DM intent::Direct link handed to a fake 1DM fixture, not the real 1DM application.');
   await evaluate("document.querySelector('[data-action=download-current]').click()");
   const item=await wait('direct offline download',async()=>{const {items}=await evaluate("window.Capacitor.nativePromise('Offline','list',{})");const row=items[0];if(row?.state==='failed')throw Error('Offline download failed');return row?.state==='ready'?row:null},600000);
   // Check this exact item's export rather than relying on queue completion.
   const final=await wait('root export',async()=>{const row=await evaluate(`window.Capacitor.nativePromise('Offline','list',{}).then(x=>x.items.find(r=>r.id==='${item.id}'))`);return row?.export==='done'?row:null},600000);
   const base=`/sdcard/${final.exportName}`;const listing=adb('shell','ls','-l',`${base}.mp4`,`${base}.srt`);if(!listing.includes('.mp4')||!listing.includes('.srt'))throw Error('Export files missing');
   console.log('::notice title=Direct offline export::A real direct episode and a separate translated test subtitle exported to the storage root.');
   await evaluate(`window.Capacitor.nativePromise('Offline','remove',${JSON.stringify(item.id)})`);
  }
  await evaluate("document.querySelector('[data-action=close-player]')?.click();document.querySelector('[data-action=close]')?.click()");
 }
 await wait('catalog UI',()=>evaluate("Boolean(document.querySelector('#donghua-search'))"));
 await play({query:'Swallowed Star',id:117012,title:'Swallowed Star',ep:'Swallowed Star Episode 100',translation:true});
 await play({query:'Renegade Immortal',id:137653,title:'Renegade Immortal',ep:'Renegade Immortal Episode 01'});
 await play({query:'Soul Land',id:137683,title:'Soul Land 2: The Peerless Tang Clan',ep:'Soul Land 2: The Peerless Tang Clan Episode 01'});
 await play({query:'Battle Through the Heavens',id:137728,title:'Battle Through the Heavens Season 5',ep:'Battle Through the Heavens Season 5 Episode 01'});
}catch(e){console.log('::error title=Android direct Donghua::'+String(e.message).slice(0,400));process.exitCode=1}finally{socket?.close()}
