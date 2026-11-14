// Exercise the actual settings activity and callback. Log output is debug-only.
import { execFileSync } from 'node:child_process';
const adb = (...args) => execFileSync('adb', args, {encoding:'utf8'});
const wait = async (label, fn, ms=30000) => {
  const end=Date.now()+ms; while(Date.now()<end) {const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,500));} throw Error('Timed out: '+label);
};
let socket;
try {
  adb('shell','appops','set','app.dimo.movies','MANAGE_EXTERNAL_STORAGE','ignore');
  async function connect() {
    const page = await wait('WebView endpoint', async () => {
      try { return (await (await fetch('http://127.0.0.1:9222/json')).json()).find(x=>x.type==='page' && /localhost/.test(x.url)); } catch { return null; }
    });
    const ws=new URL(page.webSocketDebuggerUrl);ws.host='127.0.0.1:9222';socket=new WebSocket(ws.href);
    await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});
  }
  async function request(grant) {
    adb('logcat','-c'); console.log(`::notice title=Root permission phase::connecting grant=${grant}`); await connect();
    // The WebView debugging socket may detach as the app goes into background.
    socket.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:"window.Capacitor.nativePromise('Offline','ensureRootAccess',{}).catch(()=>{}); 'started'"}}));
    await wait('storage settings visible',()=>/com\.android\.settings/.test(adb('shell','dumpsys','activity','activities').split('\n').filter(x=>/mResumedActivity|topResumedActivity/.test(x)).join(' ')));
    console.log('::notice title=Root permission phase::settings displayed');
    if(grant) adb('shell','appops','set','app.dimo.movies','MANAGE_EXTERNAL_STORAGE','allow');
    adb('shell','input','keyevent','4');
    const expected=grant?'granted':'denied';
    await wait('native permission '+expected,()=>adb('logcat','-d','-s','RootPermissionCheck:I','*:S').includes(expected));
    console.log(`::notice title=Root permission phase::callback ${expected}`);
    socket.close();
  }
  await request(false); await request(true);
  console.log('::notice title=Root storage permission::Settings opened on user request; denied and granted results verified.');
} catch(error) {console.log('::error title=Root storage permission::'+String(error.message).split('\n')[0]);try{console.log('::notice title=Permission process::'+adb('shell','pidof','app.dimo.movies').trim())}catch{console.log('::notice title=Permission process::Not running')};process.exitCode=1;}
finally {socket?.close();}
