// API 28: export a video and SRT to ordinary shared storage after permission is granted.
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8' });
let socket;
try {
  const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
  const page = targets.find(t => t.type === 'page' && /localhost/.test(t.url));
  if (!page) throw Error('WebView not found');
  const ws = new URL(page.webSocketDebuggerUrl); ws.host = '127.0.0.1:9222'; socket = new WebSocket(ws.href);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let seq = 0; const pending = new Map();
  socket.onclose = () => { for (const p of pending.values()) p.reject(Error('WebView connection closed')); pending.clear(); };
  socket.onmessage = event => { const d = JSON.parse(event.data), p = pending.get(d.id); if (!p) return; pending.delete(d.id); d.error ? p.reject(Error(d.error.message)) : p.resolve(d.result); };
  const evalJS = expression => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve: r => r.exceptionDetails ? reject(Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)) : resolve(r.result.value), reject });
    socket.send(JSON.stringify({ id, method:'Runtime.evaluate', params:{ expression, awaitPromise:true, returnByValue:true } }));
  });
  const wait = async (name, fn, timeout=120000) => {
    const end=Date.now()+timeout; while(Date.now()<end) { const value=await fn(); if(value) return value; await new Promise(r=>setTimeout(r,1000)); } throw Error(`Timed out: ${name}`);
  };
  const url='https://raw.githubusercontent.com/androidx/media/1.5.1/libraries/test_data/src/test/assets/media/hls/cea608/manifest.m3u8';
  const subtitle='WEBVTT\n\n00:00:00.000 --> 00:00:02.300\nسڵاو جیهان\n';
  const item=await evalJS(`window.Capacitor.nativePromise('Offline','start',${JSON.stringify({title:'Legacy export',url,subtitle,maxHeight:360})})`);
  await wait('download',async()=>{
    const row=await evalJS(`window.Capacitor.nativePromise('Offline','list',{}).then(x=>x.items.find(r=>r.id===${JSON.stringify(item.id)}))`);
    if(row?.state==='failed') throw Error('Download failed'); return row?.state==='ready';
  });
  const result=await evalJS(`window.Capacitor.nativePromise('Offline','exportFiles',${JSON.stringify({id:item.id})})`);
  if (!result?.saved || !result?.name) throw Error('Legacy export failed');
  const base=`/sdcard/Movies/Kurd Movie/${result.name}`;
  adb('pull',`${base}.mp4`,'/tmp/legacy-video.mp4'); adb('pull',`${base}.srt`,'/tmp/legacy-subtitle.srt');
  if(!readFileSync('/tmp/legacy-subtitle.srt','utf8').includes('سڵاو جیهان')) throw Error('Legacy SRT incorrect');
  const meta=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,codec_name','-of','json','/tmp/legacy-video.mp4'],{encoding:'utf8'}));
  if(!meta.streams?.some(s=>s.codec_type==='video')||Number(meta.format?.duration)<1) throw Error('Legacy MP4 invalid');
  unlinkSync('/tmp/legacy-video.mp4'); unlinkSync('/tmp/legacy-subtitle.srt');
  console.log('::notice title=Legacy shared export::Android 9 saved separate MP4 and SRT in public Movies with storage permission.');
} catch(error) { console.log(`::error title=Legacy shared export::${String(error.message).split('\n')[0]}`); try { for (const line of adb('logcat','-d','-s','SeparateExportDebug:E','*:S').split('\n')) if (line.includes('SeparateExportDebug') || line.includes('Exception') || line.includes('SharedFileExport')) console.log(`::error title=Legacy export log::${line}`); } catch {} process.exitCode=1; }
finally { socket?.close(); }
