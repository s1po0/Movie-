// 1DM is proprietary and not bundled. This test fixture verifies the documented intent contract,
// not actual 1DM downloads or availability of third-party media.
import {execFileSync} from 'node:child_process';
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8'});
let socket, seq=0;const pending=new Map();
const wait=async (label,fn,ms=30000)=>{const end=Date.now()+ms;while(Date.now()<end){try{const r=await fn();if(r)return r;}catch{}await new Promise(r=>setTimeout(r,500));}throw Error('Timed out: '+label);};
async function connect(){
  const page=await wait('WebView',async()=>{try{return (await(await fetch('http://127.0.0.1:9222/json')).json()).find(x=>x.type==='page'&&/localhost/.test(x.url));}catch{return null;}});
  const url=new URL(page.webSocketDebuggerUrl);url.host='127.0.0.1:9222';socket=new WebSocket(url.href);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});
  socket.onmessage=e=>{const d=JSON.parse(e.data),p=pending.get(d.id);if(!p)return;pending.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result.result.value)};
}
const evaluate=expression=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));});
try {
  await connect();
  const absent=await evaluate("window.Capacitor.nativePromise('Offline','openOneDm',{url:'https://example.com/v.mp4',page:false}).then(()=>false,()=>true)");
  if(!absent) throw Error('Missing 1DM did not report an error');
  adb('install','/tmp/one-dm-fixture.apk');
  async function send(payload, expected) {
    adb('logcat','-c');
    socket.send(JSON.stringify({id:++seq,method:'Runtime.evaluate',params:{expression:`window.Capacitor.nativePromise('Offline','openOneDm',${JSON.stringify(payload)}).catch(()=>{}); 'started'`}}));
    await wait('1DM fixture intent',()=>adb('logcat','-d','-s','OneDmFixture:I','*:S').includes(expected));
    adb('shell','input','keyevent','4');socket.close();await connect();
  }
  await send({url:'https://vidlink.pro/tv/123/1/3',page:true,title:'Test'},'page=https://vidlink.pro/tv/123/1/3');
  await send({url:'https://example.com/video.m3u8?test=1',page:false,title:'Sample Movie'},'download=https://example.com/video.m3u8?test=1 filename=Sample Movie editor=true');
  const unsafe=await evaluate("window.Capacitor.nativePromise('Offline','openOneDm',{url:'file:///data/local/tmp/a',page:true}).then(()=>false,()=>true)");
  if(!unsafe) throw Error('Non HTTPS URL accepted');
  console.log('::notice title=1DM intent test::Absent app, browser page and direct-download intents tested against a fixture; no real 1DM download was claimed.');
} catch(e) {console.log('::error title=1DM intent test::'+String(e.message).split('\n')[0]);process.exitCode=1;}
finally {socket?.close();}
