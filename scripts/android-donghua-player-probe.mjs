const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket;
try{
 const pages=await(await fetch('http://127.0.0.1:9222/json')).json(),page=pages.find(x=>x.type==='page'&&/localhost/.test(x.url));if(!page)throw Error('WebView missing');
 const ws=new URL(page.webSocketDebuggerUrl);ws.host='127.0.0.1:9222';socket=new WebSocket(ws.href);await new Promise((ok,no)=>{socket.onopen=ok;socket.onerror=no});let seq=0,pending=new Map(),contexts=new Map();
 socket.onmessage=e=>{const d=JSON.parse(e.data);if(d.method==='Runtime.executionContextCreated')contexts.set(d.params.context.id,d.params.context);else if(d.method==='Runtime.executionContextDestroyed')contexts.delete(d.params.executionContextId);const p=pending.get(d.id);if(!p)return;pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result)};
 const call=(method,params={})=>new Promise((resolve,reject)=>{let id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))});
 const evalAt=async(expression,contextId)=>{const out=await call('Runtime.evaluate',{expression,contextId,awaitPromise:true,returnByValue:true,userGesture:true});if(out.exceptionDetails)throw Error(out.exceptionDetails.text);return out.result.value};
 await call('Runtime.enable');await call('Page.enable');
 await evalAt(`{let f=document.createElement('iframe');f.id='probe-donghua';f.style='position:fixed;z-index:9999;top:20px;left:0;width:100%;height:300px';f.allow='autoplay; fullscreen';f.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');f.src='https://megavid.buzz/ani/126403/1/sub';document.body.append(f)}`);
 await sleep(25000);
 console.log('::notice title=Android iframe contexts::'+JSON.stringify([...contexts.values()].map(c=>({id:c.id,origin:c.origin,frame:c.auxData?.frameId}))));
 for(const c of contexts.values())if(c.origin?.includes('megavid'))try{console.log('::notice title=Android player start::'+JSON.stringify(await evalAt(`(async()=>{let v=document.querySelector('video');if(!v)return {text:document.body.innerText.slice(0,180)};v.muted=true;try{await v.play()}catch(e){return {err:String(e),ready:v.readyState}}return {ready:v.readyState,paused:v.paused}})()`,c.id)))}catch(e){console.log('::notice title=Android player context::'+e.message)}
 await sleep(15000);
 let success=false;for(const c of contexts.values())if(c.origin?.includes('megavid'))try{let v=await evalAt(`(()=>{let v=document.querySelector('video');return v?{time:v.currentTime,ready:v.readyState,paused:v.paused,width:v.videoWidth,height:v.videoHeight,duration:v.duration,error:v.error?.code,text:document.body.innerText.slice(0,180)}:{text:document.body.innerText.slice(0,180)}})()`,c.id);console.log('::notice title=Android real video::'+JSON.stringify(v).replace(/%/g,'%25'));if(v.time>2&&v.width>0)success=true}catch(e){console.log('::notice title=Android video error::'+e.message)}
 if(!success)throw Error('Android video did not advance');
}catch(e){console.log('::error title=Android Donghua playback probe::'+String(e.message).split('\n')[0]);process.exitCode=1}finally{socket?.close()}
