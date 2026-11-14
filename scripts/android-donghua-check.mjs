// Live integration diagnostic. Never print source, token or signed manifest URLs.
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
let socket;
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8' });
try {
  const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
  const page = targets.find(t => t.type === 'page' && /localhost/.test(t.url));
  if (!page) throw Error('WebView unavailable');
  const ws = new URL(page.webSocketDebuggerUrl); ws.host = '127.0.0.1:9222'; socket = new WebSocket(ws.href);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let seq = 0; const pending = new Map();
  socket.onmessage = event => { const d = JSON.parse(event.data), p = pending.get(d.id); if (!p) return; pending.delete(d.id); d.error ? p.reject(Error(d.error.message)) : p.resolve(d.result); };
  const evaluate = expression => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve: r => r.exceptionDetails ? reject(Error(r.exceptionDetails.text)) : resolve(r.result.value), reject });
    socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  });
  const wait = async (name, fn, timeout = 60000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) { const value = await fn(); if (value) return value; await new Promise(r => setTimeout(r, 1000)); }
    throw Error(`Timed out: ${name}`);
  };
  await wait('Tomb catalog entry', () => evaluate("Boolean(document.querySelector('[data-play=series-tomb-of-fallen-gods]'))"));
  await evaluate("document.querySelector('[data-play=series-tomb-of-fallen-gods]').click()");
  await wait('season selector', () => evaluate("Boolean(document.querySelector('select#episode-season'))"));
  await evaluate("{ const s=document.querySelector('#episode-season'); s.value='3'; s.dispatchEvent(new Event('change',{bubbles:true})); document.querySelector('#episode-number').value='25'; document.querySelector('[data-action=play-episode]').click(); }");
  const source = await wait('DonghuaStream source', () => evaluate("document.querySelector('#subtitle-file') ? 'ready' : (!document.querySelector('.toast')?.classList.contains('hidden') && document.querySelector('.toast')?.textContent.includes('نەدۆزرایەوە')) ? 'failed' : ''"));
  if (source !== 'ready') throw Error('DonghuaStream or Dailymotion source unavailable');
  await wait('real source subtitle', () => evaluate("document.querySelector('#subtitle-status')?.textContent.includes('بارکرا')"), 90000);
  const qualities = await evaluate("Array.from(document.querySelector('#offline-quality').options).map(x=>x.value)");
  const quality = Number(qualities[0]);
  if (!Number.isInteger(quality) || quality < 1 || quality > 4320) throw Error('Actual manifest quality unavailable');
  await evaluate(`document.querySelector('#offline-quality').value='${quality}'`);
  // Do not inject or confirm a fabricated subtitle: the app must translate the real source.
  await evaluate("document.querySelector('[data-action=download-current]').click()");
  await wait('download queued', () => evaluate("Boolean(document.querySelector('#offline-list'))"), 120000);
  const id = await wait('DonghuaStream download', async () => {
    const {items} = await evaluate("window.Capacitor.nativePromise('Offline','list',{})");
    const row = items[0];
    if (row?.state === 'failed') throw Error('DonghuaStream HLS download failed');
    return row?.state === 'ready' && row.id;
  }, 600000);
  const exported = await wait('automatic separate export', async () => {
    const row = await evaluate(`window.Capacitor.nativePromise('Offline','list',{}).then(x=>x.items.find(r=>r.id==='${id}'))`);
    if (row?.export === 'failed') throw Error('Automatic export failed');
    return row?.export === 'done' ? row : null;
  }, 600000);
  const base = `/sdcard/Movies/Kurd Movie/${exported.exportName}`;
  adb('pull', `${base}.mp4`, '/tmp/animecube-export.mp4');
  adb('pull', `${base}.srt`, '/tmp/animecube-export.srt');
  const srt = readFileSync('/tmp/animecube-export.srt','utf8');
  if (!/[\u0600-\u06ff]/.test(srt) || (srt.match(/ --> /g) || []).length < 10) throw Error('Public SRT missing Sorani cues');
  const metadata = JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json','/tmp/animecube-export.mp4'],{encoding:'utf8'}));
  if (!metadata.streams?.some(s=>s.codec_type==='video') || Number(metadata.format?.duration) < 10) throw Error('Public MP4 invalid');
  const stream = metadata.streams.find(s=>s.codec_type==='video');
  console.log(`::notice title=Real exported video::Episode 25 duration ${metadata.format.duration}s; requested up to ${quality}p; exported ${stream.width}x${stream.height}`);
  unlinkSync('/tmp/animecube-export.mp4'); unlinkSync('/tmp/animecube-export.srt');
  console.log('::notice title=Real public files::DonghuaStream episode 25 public MP4 and separate Sorani SRT verified');
  const saved = adb('shell','run-as','app.dimo.movies','cat',`files/offline-${id}.vtt`);
  if (!saved.startsWith('WEBVTT') || !/[\u0600-\u06ff]/.test(saved) || (saved.match(/ --> /g) || []).length < 10) throw Error('Real translated Sorani subtitle was not saved');
  adb('shell','svc','wifi','disable'); adb('shell','svc','data','disable'); adb('logcat','-c');
  await evaluate(`window.Capacitor.nativePromise('Offline','open',${JSON.stringify({id})})`);
  await wait('offline player and selected Sorani track', () => { const logs = adb('logcat','-d','-s','HlsOfflineCheck:I','*:S'); return logs.includes('ready') && logs.includes('sorani-track'); }, 45000);
  console.log('::notice title=DonghuaStream Android test::Season 3 episode 25 downloaded with its real translated subtitle; stored Sorani VTT and selected track verified offline.');
  adb('shell','input','keyevent','4');
  await evaluate(`window.Capacitor.nativePromise('Offline','remove',${JSON.stringify({id})})`);
} catch (error) { console.log(`::error title=DonghuaStream Android test::${String(error.message).split('\n')[0]}`); try { for (const line of adb('logcat','-d','-s','SeparateExportDebug:E','*:S').split('\n').filter(line => /SeparateExportDebug/.test(line)).slice(-20)) console.log(`::error title=Export diagnostic::${line.slice(0,300)}`); } catch {} process.exitCode = 1; }
finally { try { adb('shell','svc','wifi','enable'); adb('shell','svc','data','enable'); } catch {} socket?.close(); }
