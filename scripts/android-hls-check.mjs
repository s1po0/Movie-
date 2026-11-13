// Finite, unprotected AndroidX test stream with a separate Kurdish VTT.
// Verify the native player is READY and renders a cue with networking disabled.
import { execFileSync } from 'node:child_process';
import { unlinkSync } from 'node:fs';
let socket;
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8' });
try {
  const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
  const page = targets.find(t => t.type === 'page' && /localhost/.test(t.url));
  if (!page) throw Error('WebView not found');
  const ws = new URL(page.webSocketDebuggerUrl); ws.host = '127.0.0.1:9222'; socket = new WebSocket(ws.href);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let seq = 0; const pending = new Map();
  socket.onclose = () => { for (const p of pending.values()) p.reject(Error('WebView debugging connection closed')); pending.clear(); };
  socket.onmessage = event => { const d = JSON.parse(event.data), p = pending.get(d.id); if (!p) return; pending.delete(d.id); d.error ? p.reject(Error(d.error.message)) : p.resolve(d.result); };
  const evaluate = expression => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve: result => result.exceptionDetails ? reject(Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)) : resolve(result.result.value), reject });
    socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  });
  const wait = async (name, fn, timeout = 120000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) { const value = await fn(); if (value) return value; await new Promise(r => setTimeout(r, 1000)); }
    throw Error(`Timed out: ${name}`);
  };
  const url = 'https://raw.githubusercontent.com/androidx/media/1.5.1/libraries/test_data/src/test/assets/media/hls/cea608/manifest.m3u8';
  const subtitle = 'WEBVTT\n\n00:00:00.000 --> 00:00:02.300\nKURD TEST\nسڵاو جیهان\n';
  const item = await evaluate(`window.Capacitor.nativePromise('Offline','start',${JSON.stringify({ title: 'HLS offline test', url, subtitle, maxHeight: 360 })})`);
  await wait('HLS download completed', async () => {
    const { items } = await evaluate("window.Capacitor.nativePromise('Offline','list',{})");
    const row = items.find(row => row.id === item.id);
    if (row?.state === 'failed') throw Error('HLS download failed');
    return row?.state === 'ready';
  });
  // Repair an existing English download without downloading its video again.
  const english = 'WEBVTT\n\n00:00:00.000 --> 00:00:02.300\nHello my friend\n';
  await evaluate(`window.Capacitor.nativePromise('Offline','updateSubtitle',${JSON.stringify({ id: item.id, subtitle: english })})`);
  await evaluate("document.querySelector('[data-action=offline]').click()");
  await wait('existing download translation button', () => evaluate(`Boolean(document.querySelector('[data-offline-translate="${item.id}"]'))`));
  await evaluate(`document.querySelector('[data-offline-translate="${item.id}"]').click()`);
  await wait('existing English subtitle translated and replaced', async () => {
    const data = await evaluate(`window.Capacitor.nativePromise('Offline','getSubtitle',${JSON.stringify({ id: item.id })})`);
    return /[\u0600-\u06ff]/.test(data.subtitle);
  }, 90000);
  // Restore a known cue for deterministic visual checking of the exported MP4.
  await evaluate(`window.Capacitor.nativePromise('Offline','updateSubtitle',${JSON.stringify({ id: item.id, subtitle })})`);
  adb('shell', 'svc', 'wifi', 'disable'); adb('shell', 'svc', 'data', 'disable'); adb('logcat', '-c');
  await new Promise(resolve => setTimeout(resolve, 3000));
  const opened = await evaluate(`window.Capacitor.nativePromise('Offline','open',${JSON.stringify({ id: item.id })})`);
  if (!opened.nativePlayer) throw Error('Native HLS player was not opened');
  await wait('offline playback and subtitle cue', () => {
    const log = adb('logcat', '-d', '-s', 'HlsOfflineCheck:I', '*:S');
    return log.includes('ready') && log.includes('cues');
  }, 30000);
  adb('shell', 'input', 'keyevent', '4');
  // Convert the cached stream offline and publish a real, playable MediaStore MP4.
  const result = await evaluate(`window.Capacitor.nativePromise('Offline','exportGallery',${JSON.stringify({ id: item.id })})`);
  if (!result?.saved) throw Error('Gallery export was not reported as saved');
  const published = adb('shell', 'content', 'query', '--uri', 'content://media/external/video/media', '--projection', '_display_name:_size');
  if (!published.includes('HLS offline test.mp4')) throw Error('MediaStore gallery item is missing');
  adb('pull', '/sdcard/Movies/Kurd Movie/HLS offline test.mp4', '/tmp/kurd-hls-gallery-test.mp4');
  const meta = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_entries','format=duration:stream=codec_type,codec_name,height','-of','json','/tmp/kurd-hls-gallery-test.mp4'], {encoding:'utf8'}));
  if (!meta.streams?.some(stream => stream.codec_type === 'video' && stream.codec_name === 'h264' && stream.height <= 360) || Number(meta.format?.duration) < 1) throw Error('Gallery video is not a playable MP4');
  execFileSync('ffmpeg', ['-y','-v','error','-ss','0.5','-i','/tmp/kurd-hls-gallery-test.mp4','-frames:v','1','-vf','scale=1920:-1','/tmp/kurd-hls-frame.png']);
  const ocr = execFileSync('tesseract', ['/tmp/kurd-hls-frame.png','stdout','--psm','6'], {encoding:'utf8', stdio:['ignore','pipe','ignore']});
  if (!/KURD\s+TEST/i.test(ocr)) throw Error('Burned-in test subtitle not detected in gallery video');
  unlinkSync('/tmp/kurd-hls-frame.png'); unlinkSync('/tmp/kurd-hls-gallery-test.mp4');
  console.log('::notice title=Separate export stage::Gallery export and burned subtitle verified');
  // Independent files share their base name and stay available outside the app.
  const shared = await evaluate(`window.Capacitor.nativePromise('Offline','exportFiles',${JSON.stringify({ id: item.id })})`);
  if (!shared?.saved || !shared.name) throw Error('Separate file export failed');
  console.log('::notice title=Separate export stage::Native export completed');
  const base = `/sdcard/Movies/Kurd Movie/${shared.name}`;
  adb('pull', `${base}.mp4`, '/tmp/separate-video.mp4'); adb('pull', `${base}.srt`, '/tmp/separate-subtitle.srt');
  const { readFileSync } = await import('node:fs');
  const srt = readFileSync('/tmp/separate-subtitle.srt', 'utf8');
  if (!srt.includes('00:00:00,000 --> 00:00:02,300') || !srt.includes('سڵاو جیهان')) throw Error('Separate SRT text/timing incorrect');
  const separateMeta = JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,codec_name','-of','json','/tmp/separate-video.mp4'],{encoding:'utf8'}));
  if (!separateMeta.streams?.some(s=>s.codec_type==='video' && s.codec_name==='h264') || Number(separateMeta.format?.duration)<1) throw Error('Separate MP4 invalid');
  execFileSync('ffmpeg',['-y','-v','error','-ss','0.5','-i','/tmp/separate-video.mp4','-frames:v','1','-vf','scale=1920:-1','/tmp/separate-frame.png']);
  const cleanOcr = execFileSync('tesseract',['/tmp/separate-frame.png','stdout','--psm','6'],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
  if (/KURD\s+TEST/i.test(cleanOcr)) throw Error('Separate MP4 unexpectedly has burned-in subtitles');
  unlinkSync('/tmp/separate-frame.png'); unlinkSync('/tmp/separate-video.mp4'); unlinkSync('/tmp/separate-subtitle.srt');
  const exported = await evaluate(`window.Capacitor.nativePromise('Offline','list',{}).then(x=>x.items.find(row=>row.id===${JSON.stringify(item.id)}))`);
  if (exported?.export !== 'done' || exported.exportName !== shared.name) throw Error('Separate export state missing');
  console.log('::notice title=Separate export stage::MP4 and SRT verified');
  await evaluate(`window.Capacitor.nativePromise('Offline','openExternal',${JSON.stringify({id:item.id})})`);
  adb('shell','input','keyevent','4');

  await evaluate(`window.Capacitor.nativePromise('Offline','remove' ,${JSON.stringify({ id: item.id })})`);
  const remaining = await evaluate("window.Capacitor.nativePromise('Offline','list',{}).then(x=>x.items)");
  if (remaining.some(row => row.id === item.id)) throw Error('HLS deletion failed');
  // Shared files must survive deletion of the app-private download.
  const exists = adb('shell','ls', `${base}.mp4`, `${base}.srt`);
  if (!exists.includes('.mp4') || !exists.includes('.srt')) throw Error('Public files removed with private item');
  console.log('::notice title=Separate export stage::Public files survive deletion');
  // The one-click choice exports automatically when the download finishes while the dialog is open.
  adb('shell', 'svc', 'wifi', 'enable'); adb('shell', 'svc', 'data', 'enable');
  const auto = await evaluate(`window.Capacitor.nativePromise('Offline','start',${JSON.stringify({ title: 'Automatic export', url, subtitle, maxHeight: 360, autoExport:true })})`);
  await evaluate("document.querySelector('[data-action=offline]').click()");
  await wait('automatic shared export', async () => {
    const row = await evaluate(`window.Capacitor.nativePromise('Offline','list',{}).then(x=>x.items.find(r=>r.id===${JSON.stringify(auto.id)}))`);
    if (row?.state === 'failed' || row?.export === 'failed') throw Error('Automatic export failed');
    return row?.state === 'ready' && row.export === 'done';
  },180000);
  await evaluate(`window.Capacitor.nativePromise('Offline','remove',${JSON.stringify({id:auto.id})})`);

  console.log('::notice title=Android HLS check::Downloaded HLS and verified offline playback, 360p, optional burned-in gallery MP4, separate movable MP4/SRT and automatic export with networking disabled.');
} catch (error) {
  console.log(`::error title=Android HLS check::${String(error.message).split('\n')[0]}`);
  try {
    const crash = adb('logcat', '-d', '-b', 'crash');
    const lines = crash.split('\n').filter(line => /FATAL EXCEPTION|Caused by:|Exception:|at app\.dimo\.movies|at androidx\.media3/.test(line)).slice(0, 18);
    for (const line of lines) console.log(`::error title=Android crash::${line.slice(0, 300)}`);
    try { console.log(`::notice title=App process::${adb('shell','pidof','app.dimo.movies').trim()}`); } catch { console.log('::notice title=App process::No app process'); }
    const exportLog = adb('logcat','-d','-s','SeparateExportDebug:E','*:S');
    for (const line of exportLog.split('\n').filter(line=>/SeparateExportDebug/.test(line)).slice(-15)) console.log(`::error title=Export debug::${line.replace(/https?:\/\/\S+/g,'[url]').slice(0, 300)}`);
    const system = adb('logcat','-d','-t','800');
    const hints = system.split('\n').filter(line => /died|Killing|SIGSEGV|SIGABRT|OutOfMemory|low memory|Fatal signal/i.test(line)).slice(-15);
    for (const line of hints) console.log(`::error title=Android system::${line.replace(/https?:\/\/\S+/g,'[url]').slice(0, 300)}`);

  } catch {}
  process.exitCode = 1;
}
finally { try { adb('shell', 'svc', 'wifi', 'enable'); adb('shell', 'svc', 'data', 'enable'); } catch {} socket?.close(); }
