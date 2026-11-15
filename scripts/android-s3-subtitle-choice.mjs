// Live check: switch two tracks from the same real episode and translate the second.
let socket;
try {
 const pages=await(await fetch('http://127.0.0.1:9222/json')).json();const page=pages.find(x=>x.type==='page'&&/localhost/.test(x.url));if(!page)throw Error('No WebView');
 const ws=new URL(page.webSocketDebuggerUrl);ws.host='127.0.0.1:9222';socket=new WebSocket(ws.href);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});
 let seq=0;const pending=new Map();socket.onmessage=e=>{const d=JSON.parse(e.data),p=pending.get(d.id);if(p){pending.delete(d.id);d.error?p.reject(Error(d.error.message)):d.result.exceptionDetails?p.reject(Error(d.result.exceptionDetails.text)):p.resolve(d.result.result.value)}};
 const evaluate=expression=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}))});
 const wait=async(label,fn,ms=90000)=>{const until=Date.now()+ms;while(Date.now()<until){const result=await fn();if(result)return result;await new Promise(r=>setTimeout(r,1000))}throw Error('Timed out '+label)};
 await wait('catalog',()=>evaluate("Boolean(document.querySelector('[data-play=series-tomb-of-fallen-gods]'))"));
 await evaluate("document.querySelector('[data-play=series-tomb-of-fallen-gods]').click()");
 await wait('season selector',()=>evaluate("Boolean(document.querySelector('select#episode-season'))"));
 await evaluate("{const s=document.querySelector('#episode-season');s.value='3';s.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#episode-number').value='25';document.querySelector('[data-action=play-episode]').click()}");
 await wait('player',()=>evaluate("Boolean(document.querySelector('#subtitle-source'))"));
 await wait('default subtitle',()=>evaluate("document.querySelector('#subtitle-status')?.textContent.includes('بارکرا')"));
 const info=await evaluate("Array.from(document.querySelector('#subtitle-source').options).filter(x=>x.value).map(x=>x.textContent)");
 if(info.length<2)throw Error('Less than two independent language tracks available');
 const before = await evaluate("document.querySelector('track[data-external=original]').src");
 await evaluate("{const s=document.querySelector('#subtitle-source');s.value=s.options[2].value;s.dispatchEvent(new Event('change',{bubbles:true}));}");
 await wait('alternate subtitle',()=>evaluate(`document.querySelector('track[data-external=original]')?.src !== ${JSON.stringify(before)}`));
 // Confirm the loaded track is translated, rather than silently using the first track.
 const original=await evaluate("fetch(document.querySelector('track[data-external=original]').src).then(r=>r.text())");
 if(!original.includes('-->'))throw Error('Alternate track missing cues');
 await evaluate("document.querySelector('#language').value='ckb'; document.querySelector('#translate').click()");
 await wait('translation',()=>evaluate("Boolean(document.querySelector('track[data-external=translated]'))"),240000);
 const translated=await evaluate("fetch(document.querySelector('track[data-external=translated]').src).then(r=>r.text())");
 if(!/[\u0600-\u06ff]/.test(translated)||!translated.includes('-->'))throw Error('Sorani cues unavailable');
 console.log(`::notice title=S3 subtitles::Episode 25 exposed ${info.length} source-language tracks; alternate selected and translated to Sorani. Quality is not evaluated.`);
} catch(e){console.log('::error title=S3 subtitle choices::'+e.message.split('\n')[0]);process.exitCode=1}finally{socket?.close()}
