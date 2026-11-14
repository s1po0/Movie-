import { execFileSync } from 'node:child_process';
let socket;
try {
  const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
  const page = targets.find(t => t.type === 'page' && /localhost/.test(t.url));
  if (!page) throw Error('Android WebView target not found');
  const ws = new URL(page.webSocketDebuggerUrl); ws.host = '127.0.0.1:9222'; socket = new WebSocket(ws.href);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0; const pending = new Map();
  socket.onmessage = event => { const data = JSON.parse(event.data), p = pending.get(data.id); if (!p) return; pending.delete(data.id); data.error ? p.reject(Error(data.error.message)) : p.resolve(data.result); };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const out = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (out.exceptionDetails) throw Error(out.exceptionDetails.exception?.description || out.exceptionDetails.text); return out.result.value; };
  const wait = async (name, fn, timeout = 45000) => { const end = Date.now() + timeout; while (Date.now() < end) { try { const value = await fn(); if (value) return value; } catch {} await new Promise(r => setTimeout(r, 1000)); } throw Error(`Timed out: ${name}`); };
  await send('Runtime.enable');
  await wait('app and Offline plugin', () => evaluate("Boolean(document.querySelector('[data-action=offline]') && window.Capacitor?.isPluginAvailable('Offline'))"));
  await evaluate(`document.querySelector('.top-add').click(); document.querySelector('#modal [data-action=add]').click();
    document.querySelector('[name=title]').value='Offline test'; document.querySelector('[name=url]').value='https://github.com/mediaelement/mediaelement-files/raw/refs/heads/master/big_buck_bunny.mp4';
    document.querySelector('#add-form').requestSubmit(); document.querySelector('#modal .saved-title').click();`);
  await wait('direct player', () => evaluate("Boolean(document.querySelector('#subtitle-file'))"));
  await evaluate(`{ const input=document.querySelector('#subtitle-file'), dt=new DataTransfer(); dt.items.add(new File(['WEBVTT\\n\\n00:00:00.000 --> 00:00:20.000\\nسڵاو جیهان\\n'], 'kurdish.vtt', {type:'text/vtt'})); input.files=dt.files; input.dispatchEvent(new Event('change',{bubbles:true})); }`);
  await wait('subtitle loaded', () => evaluate("document.querySelector('#subtitle-status')?.textContent.includes('بارکرا')"));
  await evaluate("document.querySelector('#original-is-kurdish').checked=true; document.querySelector('[data-action=download-current]').click()");
  await wait('download queued', () => evaluate("!document.querySelector('#modal').classList.contains('hidden') && Boolean(document.querySelector('#offline-list'))"));
  const id = await wait('download completed', async () => {
    const items = await evaluate("window.Capacitor.nativePromise('Offline','list',{}).then(x=>x.items)");
    if (items[0]?.state === 'failed') throw Error('DownloadManager failed');
    return items[0]?.state === 'ready' && items[0].id;
  }, 240000);
  const exported = await wait('automatic direct-file export', async () => {
    const item = await evaluate(`window.Capacitor.nativePromise('Offline','list',{}).then(x=>x.items.find(r=>r.id==='${id}'))`);
    return item?.export === 'done' || item?.export === 'failed' ? item.export : '';
  }, 180000);
  if (exported !== 'done') throw Error('Automatic export failed');
  // Disconnect both device transports before opening the downloaded file.
  execFileSync('adb', ['shell', 'svc', 'wifi', 'disable']); execFileSync('adb', ['shell', 'svc', 'data', 'disable']);
  await new Promise(r => setTimeout(r, 3000));
  await evaluate("document.querySelector('[data-action=offline]').click()");
  await wait('offline item displayed', () => evaluate(`Boolean(document.querySelector('[data-offline-play="${id}"]:not([disabled])'))`));
  await evaluate(`document.querySelector('[data-offline-play="${id}"]').click()`);
  await wait('offline player and subtitle', () => evaluate("Boolean(document.querySelector('#video') && document.querySelector('#subtitle-status')?.textContent.includes('بارکرا'))"));
  const partial = await evaluate(`fetch(document.querySelector('#video').src,{headers:{Range:'bytes=0-99'}}).then(async r=>({status:r.status,range:r.headers.get('Content-Range'),size:(await r.arrayBuffer()).byteLength}))`);
  if (partial.status !== 206 || partial.size !== 100 || !partial.range?.startsWith('bytes 0-99/')) throw Error(`Incorrect offline range: ${JSON.stringify(partial)}`);
  await wait('offline video ready', () => evaluate("document.querySelector('#video').readyState >= 2"), 60000);
  await evaluate("document.querySelector('#video').currentTime=2; document.querySelector('#video').play().catch(()=>{})");
  await wait('offline video playing', () => evaluate("document.querySelector('#video').currentTime > 2.3"), 30000);
  const subtitle = await evaluate("Array.from(document.querySelector('#video').textTracks).some(t=>t.mode==='showing' && Array.from(t.cues||[]).some(c=>c.text.includes('سڵاو'))) ");
  if (!subtitle) throw Error('Kurdish subtitle not restored');
  await evaluate(`document.querySelector('[data-action=close-player]').click(); window.Capacitor.nativePromise('Offline','remove',{id:'${id}'})`);
  const remaining = await evaluate("window.Capacitor.nativePromise('Offline','list',{}).then(x=>x.items.length)");
  if (remaining !== 0) throw Error('Offline deletion failed');
  console.log('::notice title=Android offline check::Downloaded direct MP4 with Kurdish VTT; disabled device networking; verified partial requests, playback, subtitles and deletion.');
} catch (error) { console.log(`::error title=Android offline check::${String(error.message).split('\n')[0]}`); try { for (const line of execFileSync('adb',['logcat','-d','-s','SeparateExportDebug:E','*:S'],{encoding:'utf8'}).split('\n').filter(line=>/SeparateExportDebug/.test(line)).slice(-25)) console.log(`::error title=Export debug::${line.slice(0,300)}`); } catch {} process.exitCode = 1; }
finally { try { execFileSync('adb', ['shell', 'svc', 'wifi', 'enable']); execFileSync('adb', ['shell', 'svc', 'data', 'enable']); } catch {} socket?.close(); }
