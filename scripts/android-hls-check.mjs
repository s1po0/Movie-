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
  const subtitle = 'WEBVTT\n\n00:00:00.000 --> 00:00:02.300\nسڵاو جیهان\n';
  const item = await evaluate(`window.Capacitor.nativePromise('Offline','start',${JSON.stringify({ title: 'HLS offline test', url, subtitle })})`);
  await wait('HLS download completed', async () => {
    const { items } = await evaluate("window.Capacitor.nativePromise('Offline','list',{})");
    const row = items.find(row => row.id === item.id);
    if (row?.state === 'failed') throw Error('HLS download failed');
    return row?.state === 'ready';
  });
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
  const meta = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_entries','format=duration:stream=codec_type,codec_name','-of','json','/tmp/kurd-hls-gallery-test.mp4'], {encoding:'utf8'}));
  if (!meta.streams?.some(stream => stream.codec_type === 'video' && stream.codec_name === 'h264') || Number(meta.format?.duration) < 1) throw Error('Gallery video is not a playable MP4');
  unlinkSync('/tmp/kurd-hls-gallery-test.mp4');
  await evaluate(`window.Capacitor.nativePromise('Offline','remove' ,${JSON.stringify({ id: item.id })})`);
  const remaining = await evaluate("window.Capacitor.nativePromise('Offline','list',{}).then(x=>x.items)");
  if (remaining.some(row => row.id === item.id)) throw Error('HLS deletion failed');
  console.log('::notice title=Android HLS check::Downloaded HLS and verified offline subtitle playback and gallery MP4 export with networking disabled.');
} catch (error) { console.log(`::error title=Android HLS check::${String(error.message).split('\n')[0]}`); process.exitCode = 1; }
finally { try { adb('shell', 'svc', 'wifi', 'enable'); adb('shell', 'svc', 'data', 'enable'); } catch {} socket?.close(); }
