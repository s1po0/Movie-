import { withSubtitleTrack, subtitleTrackUrl } from '../src/menu-subtitles.js';

let socket;
try {
  const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
  const page = targets.find(t => t.type === 'page' && /localhost/.test(t.url)) || targets.find(t => t.type === 'page');
  if (!page) throw Error('Android WebView debugging target not found');
  const ws = new URL(page.webSocketDebuggerUrl); ws.host = '127.0.0.1:9222';
  socket = new WebSocket(ws.href);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0; const pending = new Map();
  socket.onmessage = message => { const data = JSON.parse(message.data); const p = pending.get(data.id); if (!p) return; pending.delete(data.id); data.error ? p.reject(Error(data.error.message)) : p.resolve(data.result); };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression, contextId) => {
    const out = await send('Runtime.evaluate', { expression, contextId, awaitPromise: true, returnByValue: true });
    if (out.exceptionDetails) throw Error(out.exceptionDetails.exception?.description || out.exceptionDetails.text);
    return out.result.value;
  };
  const wait = async (fn, timeout = 60000) => { const end = Date.now() + timeout; let result; while (Date.now() < end) { try { result = await fn(); if (result) return result; } catch { /* wait for the frame */ } await new Promise(r => setTimeout(r, 1000)); } throw Error('Timed out waiting for ' + fn.name); };
  await send('Page.enable'); await send('Runtime.enable');
  await wait(async function appReady() { return evaluate("Boolean(document.querySelector('[data-play=\"cinebloom-155\"]'))"); }, 30000);
  if (!await evaluate("Boolean(window.Capacitor?.PluginHeaders?.some(p => p.name === 'MenuSubtitle'))")) throw Error('Native subtitle plugin not registered');
  const token='0123456789abcdef0123456789abcdef';
  const text='WEBVTT\n\n00:00:00.000 --> 00:10:00.000\nسڵاو تاقیکردنەوە\n';
  await evaluate("document.querySelector('[data-play=\"cinebloom-155\"]').click()");
  await evaluate(`window.Capacitor.nativePromise('MenuSubtitle','setTrack', ${JSON.stringify({ token, text })})`);
  const src=withSubtitleTrack('https://vidlink.pro/movie/155',token);
  await evaluate(`document.querySelector('#player-modal iframe').src=${JSON.stringify(src)}`);
  const contextId = await wait(async function playerContext() {
    const { frameTree } = await send('Page.getFrameTree');
    const find = t => t.frame?.url?.startsWith('https://vidlink.pro/movie/') ? t.frame.id : (t.childFrames || []).map(find).find(Boolean);
    const frameId = find(frameTree); if (!frameId) return null;
    const world = await send('Page.createIsolatedWorld', { frameId, worldName: 'dimo-test' });
    return await evaluate("document.readyState === 'complete'", world.executionContextId) ? world.executionContextId : null;
  });
  const fetched = await evaluate(`fetch(${JSON.stringify(subtitleTrackUrl(token))}).then(async r => ({status:r.status,text:await r.text()}))`, contextId);
  if (fetched.status !== 200 || fetched.text !== text) throw Error(`Android interception failed: HTTP ${fetched.status}`);
  await wait(async function menuReady() { return evaluate("Array.from(document.querySelectorAll('button')).some(b => /Captions.*کوردی سۆرانی/.test(b.innerText))", contextId); }, 60000);
  console.log('::notice title=Android subtitle menu::Android WebView served the in-memory VTT and the player selected the Sorani menu option');
} catch(error) {
  console.log(`::error title=Android subtitle menu::${String(error.message).split('\n')[0]}`); process.exitCode=1;
} finally { socket?.close(); }
