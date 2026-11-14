// Verify that root access settings open only on request, and denial/grant return to the app.
import { execFileSync } from 'node:child_process';
let socket;
const adb = (...args) => execFileSync('adb', args, {encoding:'utf8'});
const wait = async (label, fn, ms = 30000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { const result = await fn(); if (result) return result; await new Promise(r => setTimeout(r,500)); }
  throw Error('Timed out: ' + label);
};
try {
  const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
  const page = targets.find(t => t.type === 'page' && /localhost/.test(t.url));
  if (!page) throw Error('WebView not found');
  const ws = new URL(page.webSocketDebuggerUrl); ws.host = '127.0.0.1:9222'; socket = new WebSocket(ws.href);
  await new Promise((resolve, reject) => { socket.onopen=resolve; socket.onerror=reject; });
  let seq=0; const pending = new Map();
  socket.onmessage=e=>{const d=JSON.parse(e.data),p=pending.get(d.id);if(!p)return;pending.delete(d.id); d.error ? p.reject(Error(d.error.message)) : p.resolve(d.result);};
  const evaluate=expression=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve:r=>r.exceptionDetails?reject(Error(r.exceptionDetails.text)):resolve(r.result.value),reject});socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));});
  await wait('plugin ready',()=>evaluate("Boolean(window.Capacitor?.isPluginAvailable('Offline'))"));
  adb('shell','appops','set','app.dimo.movies','MANAGE_EXTERNAL_STORAGE','ignore');
  async function requestAndReturn(grant) {
    await evaluate("window.__rootResult='waiting'; window.Capacitor.nativePromise('Offline','ensureRootAccess',{}).then(()=>window.__rootResult='allowed',()=>window.__rootResult='denied'); 'started'");
    await wait('storage settings visible',()=>/com\.android\.settings/.test(adb('shell','dumpsys','activity','activities').split('\n').filter(x=>/mResumedActivity|topResumedActivity/.test(x)).join(' ')));
    if (grant) adb('shell','appops','set','app.dimo.movies','MANAGE_EXTERNAL_STORAGE','allow');
    adb('shell','input','keyevent','4');
    return wait('permission callback',()=>evaluate("window.__rootResult==='waiting' ? '' : window.__rootResult"));
  }
  if(await requestAndReturn(false)!=='denied') throw Error('Declined permission was accepted');
  if(await requestAndReturn(true)!=='allowed') throw Error('Granted permission was not accepted');
  console.log('::notice title=Root storage permission::Android settings opened on request; denial and grant callbacks both verified.');
} catch(error) { console.log('::error title=Root storage permission::'+String(error.message).split('\n')[0]);process.exitCode=1; }
finally {socket?.close();}
