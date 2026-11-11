let socket;
try {
  const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
  const page = targets.find(t => t.type === 'page' && /localhost/.test(t.url)) || targets.find(t => t.type === 'page');
  if (!page) throw Error('Android WebView debugging target not found');
  const ws = new URL(page.webSocketDebuggerUrl); ws.host = '127.0.0.1:9222';
  socket = new WebSocket(ws.href);
  await new Promise((resolve,reject) => {socket.onopen=resolve;socket.onerror=reject;});
  let sequence=0; const pending=new Map();
  socket.onmessage = message => { const data=JSON.parse(message.data), p=pending.get(data.id); if(!p)return; pending.delete(data.id); data.error?p.reject(Error(data.error.message)):p.resolve(data.result); };
  const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate = async (expression,contextId) => {const out=await send('Runtime.evaluate',{expression,contextId,awaitPromise:true,returnByValue:true});if(out.exceptionDetails)throw Error(out.exceptionDetails.text);return out.result.value;};
  const wait = async (name,fn,timeout=60000) => {const end=Date.now()+timeout;while(Date.now()<end){try{const result=await fn();if(result)return result;}catch{}await new Promise(r=>setTimeout(r,1000));}throw Error(`Timed out: ${name}`);};
  await send('Page.enable'); await send('Runtime.enable');
  await wait('app ready',()=>evaluate('Boolean(document.querySelector(\'[data-play="series-tomb-of-fallen-gods"]\'))'),30000);
  const metaDiagnostic = await evaluate(`window.Capacitor.nativePromise('CapacitorHttp','get',{url:'https://v3-cinemeta.strem.io/meta/series/tt31530980.json',responseType:'json',connectTimeout:10000,readTimeout:10000}).then(r=>({status:r.status, dataType:typeof r.data, id:r.data?.meta?.id || null, videos:r.data?.meta?.videos?.length || 0})).catch(e=>({error:String(e.message).slice(0,100)}))`);
  console.log(`::notice title=Episode metadata diagnostic::${JSON.stringify(metaDiagnostic)}`);
  for (const season of [2,3]) {
    await evaluate(`document.querySelector('[data-play="series-tomb-of-fallen-gods"]').click()`);
    try { await wait('season selector',()=>evaluate("Boolean(document.querySelector('select#episode-season'))")); } catch (error) { console.log(`::notice title=Episode control diagnostic::${await evaluate("document.querySelector('.episode-controls')?.outerHTML || 'missing'")}`); throw error; }
    await evaluate(`{const s=document.querySelector('#episode-season');s.value='${season}';s.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-action=play-episode]').click()}`);
    await wait('selected episode',()=>evaluate(`document.querySelector('#player-modal iframe')?.src.includes('/tv/206343/${season}/1')`));
    const ready=await wait('translation',()=>evaluate("!document.querySelector('.embedded-menu-ready')?.classList.contains('hidden') ? 'ready' : /تەواو نەبوو|نەدۆزرایەوە/.test(document.querySelector('#embedded-subtitle-status')?.textContent || '') ? 'failed' : ''"),210000);
    if(ready!=='ready') throw Error(`Season ${season} automatic subtitle or translation failed`);
    await evaluate("document.querySelector('.embedded-menu-ready').click()");
    const src=await evaluate("document.querySelector('#player-modal iframe').src"), url=new URL(src), trackUrl=url.searchParams.get('sub_file');
    if(!trackUrl || url.searchParams.get('sub_label')!=='کوردی سۆرانی') throw Error(`Season ${season} translated CC option missing`);
    const contextId=await wait('player frame',async()=>{const {frameTree}=await send('Page.getFrameTree');const find=t=>{try{if(t.frame?.url&&new URL(t.frame.url).searchParams.get('sub_file')===trackUrl)return t.frame.id;}catch{}return(t.childFrames||[]).map(find).find(Boolean);};const frameId=find(frameTree);if(!frameId)return null;const world=await send('Page.createIsolatedWorld',{frameId,worldName:'tomb-test'});return await evaluate("document.readyState === 'complete'",world.executionContextId)?world.executionContextId:null;});
    const result=await evaluate(`fetch(${JSON.stringify(trackUrl)}).then(async r=>({status:r.status,text:await r.text()}))`,contextId);
    if(result.status!==200||!result.text.startsWith('WEBVTT')||!/[\u0600-\u06ff]/.test(result.text))throw Error(`Season ${season} translated VTT not available`);
    console.log(`::notice title=Tomb Android subtitles::Season ${season} episode 1: translated Sorani VTT was added to the player and fetched`);
    await evaluate("document.querySelector('#player-modal [data-action=close-player]').click()");
  }
} catch(error) { console.log(`::error title=Tomb Android test::${String(error.message).split('\n')[0]}`); process.exitCode=1; }
finally {socket?.close();}
