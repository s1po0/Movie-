import { translationUrl } from '../src/translate.js';

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
  const probeUrl = translationUrl('Hello, how are you?', 'ckb');
  const hostStatus = await fetch(probeUrl).then(r => r.status).catch(() => 'error');
  const webStatus = await evaluate(`fetch(${JSON.stringify(probeUrl)}).then(r => r.status).catch(e => e.message)`);
  const nativeStatus = await evaluate(`window.Capacitor.nativePromise('CapacitorHttp','get',${JSON.stringify({url:probeUrl,responseType:'json'})}).then(r=>r.status).catch(e=>e.message)`);
  const nodeAgentStatus = await evaluate(`window.Capacitor.nativePromise('CapacitorHttp','get',${JSON.stringify({url:probeUrl,responseType:'json',headers:{'User-Agent':'node'}})}).then(r=>r.status).catch(e=>e.message)`);
  console.log(`::notice title=Google endpoint diagnostic::Runner=${hostStatus}; WebView=${webStatus}; Android=${nativeStatus}; Android node-agent=${nodeAgentStatus}`);
  await evaluate("document.querySelector('[data-play=\"cinebloom-155\"]').click()");
  try {
    const state = await wait(async function automaticTranslationReady() { return evaluate("!document.querySelector('.embedded-menu-ready')?.classList.contains('hidden') ? 'ready' : /تەواو نەبوو|نەدۆزرایەوە/.test(document.querySelector('#embedded-subtitle-status')?.textContent || '') ? 'failed' : ''"); }, 210000);
    if (state === 'failed') throw Error('Translation failed');
  } catch (error) {
    const status = await evaluate("document.querySelector('#embedded-subtitle-status')?.textContent || 'no status'");
    throw Error(`Automatic translation did not complete: ${status}`);
  }
  const status = await evaluate("document.querySelector('#embedded-subtitle-status').textContent");
  console.log(`::notice title=Android Google translation::${status}`);
  await evaluate("document.querySelector('.embedded-menu-ready').click()");
  const src = await evaluate("document.querySelector('#player-modal iframe').src");
  const url = new URL(src), trackUrl = url.searchParams.get('sub_file');
  if (!trackUrl || url.searchParams.get('sub_label') !== 'کوردی سۆرانی') throw Error('Sorani player option missing');
  const contextId = await wait(async function playerContext() {
    const { frameTree } = await send('Page.getFrameTree');
    const find = t => { try { if (t.frame?.url && new URL(t.frame.url).searchParams.get('sub_file') === trackUrl) return t.frame.id; } catch {} return (t.childFrames || []).map(find).find(Boolean); };
    const frameId = find(frameTree); if (!frameId) return null;
    const world = await send('Page.createIsolatedWorld', { frameId, worldName: 'dimo-test' });
    return await evaluate("document.readyState === 'complete'", world.executionContextId) ? world.executionContextId : null;
  });
  const fetched = await evaluate(`fetch(${JSON.stringify(trackUrl)}).then(async r => ({status:r.status,text:await r.text()}))`, contextId);
  if (fetched.status !== 200 || !fetched.text.startsWith('WEBVTT') || !/[\u0600-\u06ff]/.test(fetched.text)) throw Error(`Android translated subtitle interception failed: HTTP ${fetched.status}`);
  try {
    await wait(async function menuReady() { return evaluate("Array.from(document.querySelectorAll('[role=menuitemradio]')).some(e => e.textContent.trim() === 'کوردی سۆرانی')", contextId); }, 60000);
    // The provider can overlay an advertisement above its controls. Remove it only in
    // this diagnostic to exercise the caption controls independently of that ad.
    await evaluate("document.querySelector('#dontfoid')?.remove()", contextId);
    const tapInFrame = async (selector) => {
      const frameRect = await evaluate(`(() => { const r = document.querySelector('#player-modal iframe').getBoundingClientRect(); return {x:r.x,y:r.y}; })()`);
      const point = await evaluate(`(() => { const e = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'); if (!e) return null; const r = e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`, contextId);
      if (!point) throw Error(`Visible player control not found: ${selector}`);
      const x = Math.round(frameRect.x + point.x), y = Math.round(frameRect.y + point.y);
      await send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x,y}]});
      await send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
    };
    await tapInFrame('#media-menu-button-1');
    await evaluate("Array.from(document.querySelectorAll('[role=menuitemradio]')).filter(e => e.textContent.trim() === 'کوردی سۆرانی').forEach(e => e.setAttribute('data-dimo-test', 'sorani'))", contextId);
    await tapInFrame('[data-dimo-test=sorani]');
    await wait(async function soraniSelected() { return evaluate("Array.from(document.querySelectorAll('[role=menuitemradio]')).some(e => e.textContent.trim() === 'کوردی سۆرانی' && e.getAttribute('aria-checked') === 'true')", contextId); }, 10000);
  } catch (error) {
    const diagnostic = await evaluate("JSON.stringify({text: document.body?.innerText?.slice(0,400), buttons: Array.from(document.querySelectorAll('button')).map(b=>b.innerText).filter(Boolean).slice(0,30), options: Array.from(document.querySelectorAll('[role=menuitemradio]')).map(e => e.textContent.trim()).slice(0,40)})", contextId).catch(() => 'frame context unavailable');
    console.log(`::notice title=Player menu diagnostic::${diagnostic}`);
    throw error;
  }
  console.log('::notice title=Android subtitle menu::The Android app automatically translated subtitles with Google, served its VTT, and selected the Sorani menu option using touch (with the provider ad removed in the test)');
} catch(error) {
  console.log(`::error title=Android subtitle menu::${String(error.message).split('\n')[0]}`); process.exitCode=1;
} finally { socket?.close(); }
