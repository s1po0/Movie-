let socket;
try {
  const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
  const page = targets.find(t => t.type === 'page' && /localhost/.test(t.url)) || targets.find(t => t.type === 'page');
  if (!page) throw Error('Android WebView debugging target not found');
  const ws = new URL(page.webSocketDebuggerUrl); ws.host = '127.0.0.1:9222';
  socket = new WebSocket(ws.href);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0; const pending = new Map();
  socket.onmessage = message => { const result = JSON.parse(message.data), p = pending.get(result.id); if (!p) return; pending.delete(result.id); result.error ? p.reject(Error(result.error.message)) : p.resolve(result.result); };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); socket.send(JSON.stringify({ id:n, method, params })); });
  const evaluate = async expression => { const out = await send('Runtime.evaluate', { expression, awaitPromise:true, returnByValue:true }); if (out.exceptionDetails) throw Error(out.exceptionDetails.text); return out.result.value; };
  await send('Runtime.enable');
  const deadline = Date.now() + 30000;
  while (!await evaluate("Boolean(window.Capacitor?.PluginHeaders?.some(p => p.name === 'Updater'))")) { if (Date.now() > deadline) throw Error('Updater plugin not registered'); await new Promise(r => setTimeout(r, 500)); }
  const version = await evaluate("window.Capacitor.nativePromise('Updater','getVersion',{})");
  if (version.versionCode !== 15) throw Error(`Unexpected installed version ${version.versionCode}`);
  const invalid = await evaluate("window.Capacitor.nativePromise('Updater','download',{url:'https://evil.example/Nali.apk'}).then(()=>'accepted').catch(()=>'rejected')");
  if (invalid !== 'rejected') throw Error('Untrusted update URL accepted');
  if (!await evaluate("Boolean(document.querySelector('[data-action=check-update]'))")) throw Error('Update button missing');
  console.log('::notice title=Android updater::Native updater registered, installed version read, and untrusted download URL rejected. In-place installation requires a stable signing key.');
} catch(error) { console.log(`::error title=Android updater::${String(error.message).split('\n')[0]}`); process.exitCode=1; }
finally { socket?.close(); }
