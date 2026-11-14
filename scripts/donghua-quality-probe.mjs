// Report actual manifest choices, which may differ from metadata's advertised list.
const keep=setInterval(()=>{},1000);
const agents={default:null,android:'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',desktop:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'};
try {
 for(const [name,agent] of Object.entries(agents)) {
  try {
   const headers=agent?{'User-Agent':agent}:{};
   const meta=await fetch('https://www.dailymotion.com/player/metadata/video/k3jnwKOGjrLyixEG4nc',{headers,signal:AbortSignal.timeout(25000)});
   const m=await meta.json(); const stream=m.qualities.auto.find(x=>/mpegurl/i.test(x.type));
   const r=await fetch(stream.url,{headers,signal:AbortSignal.timeout(25000)});
   const text=await r.text(); const streams=text.split(/\r?\n/).filter(x=>x.startsWith('#EXT-X-STREAM-INF:'));
   console.log(`::notice title=Manifest ${name}::HTTP ${r.status}, variants ${streams.length}; ${streams.map(v=>v.match(/RESOLUTION=\d+x\d+/)?.[0] || 'unknown resolution').join(', ')}; metadata ${Object.keys(m.stream_formats||{}).join(',')}`);
  } catch(e) {console.log(`::notice title=Manifest ${name}::${e.name}: ${e.message}`);}
 }
} finally {clearInterval(keep);}
