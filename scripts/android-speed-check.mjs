// Measure real Google translation on Android, then verify the generated VTT.
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
  const wait = async (fn, timeout = 60000) => { const end = Date.now() + timeout; while (Date.now() < end) { try { const value = await fn(); if (value) return value; } catch { /* wait for the frame */ } await new Promise(r => setTimeout(r, 500)); } throw Error('Timed out waiting for ' + fn.name); };
  await send('Page.enable'); await send('Runtime.enable');
  await wait(async function appReady() { return evaluate("Boolean(document.querySelector('[data-play=\"cinebloom-155\"]'))"); }, 30000);
  const start = Date.now();
  await evaluate("document.querySelector('[data-play=\"cinebloom-155\"]').click()");
  let translationStarted;
  const state = await wait(async function translationReady() {
    const state = await evaluate("({status:document.querySelector('#embedded-subtitle-status')?.textContent || '', ready:!!document.querySelector('.embedded-menu-ready:not(.hidden)')})");
    if (!translationStarted && /وەرگێڕانی Google|Google ژێرنووسەکە/.test(state.status)) translationStarted = Date.now();
    if (/تەواو نەبوو|نەدۆزرایەوە/.test(state.status)) throw Error(state.status);
    return state.ready ? state : null;
  }, 240000);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const translationElapsed = translationStarted ? ((Date.now() - translationStarted) / 1000).toFixed(1) : 'unknown';
  await evaluate("document.querySelector('.embedded-menu-ready').click()");
  const trackUrl = new URL(await evaluate("document.querySelector('#player-modal iframe').src")).searchParams.get('sub_file');
  if (!trackUrl) throw Error('No translated subtitle track');
  const contextId = await wait(async function playerContext() {
    const { frameTree } = await send('Page.getFrameTree');
    const find = t => { try { if (t.frame?.url && new URL(t.frame.url).searchParams.get('sub_file') === trackUrl) return t.frame.id; } catch {} return (t.childFrames || []).map(find).find(Boolean); };
    const frameId = find(frameTree); if (!frameId) return null;
    const world = await send('Page.createIsolatedWorld', { frameId, worldName: 'perde-speed-test' });
    return await evaluate("document.readyState === 'complete'", world.executionContextId) ? world.executionContextId : null;
  });
  const result = await evaluate(`fetch(${JSON.stringify(trackUrl)}).then(async r => ({status:r.status,text:await r.text()}))`, contextId);
  if (result.status !== 200 || !result.text.startsWith('WEBVTT') || !/[\u0600-\u06ff]/.test(result.text)) throw Error('Generated Sorani VTT was not served');
  console.log(`::notice title=Android translation timing::Ready after ${elapsed}s including discovery; translation ${translationElapsed}s; translated Sorani VTT served successfully.`);
} catch (error) {
  console.log(`::error title=Android translation speed::${String(error.message).split('\n')[0]}`);
  process.exitCode = 1;
} finally { socket?.close(); }
