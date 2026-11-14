// The metadata advertises encoded sizes; only actual manifest variants are selectable.
const keep=setInterval(()=>{},1000);
try {
 for(const [episode,id] of [[1,'k4W4qjeu771bNUDB9N0'],[25,'k3jnwKOGjrLyixEG4nc'],[52,'k2fJW8ORXzaHEiI2a4O']]) {
  try {
   const meta=await fetch(`https://www.dailymotion.com/player/metadata/video/${id}`,{signal:AbortSignal.timeout(25000)});
   const m=await meta.json(); const stream=m.qualities.auto.find(x=>/mpegurl/i.test(x.type));
   const r=await fetch(stream.url,{signal:AbortSignal.timeout(25000)});
   const text=await r.text(); const streams=text.split(/\r?\n/).filter(x=>x.startsWith('#EXT-X-STREAM-INF:'));
   console.log(`::notice title=Episode ${episode} manifest::HTTP ${r.status}, variants ${streams.length}; ${streams.map(v=>v.match(/RESOLUTION=\d+x\d+/)?.[0] || 'unknown resolution').join(', ')}; metadata ${Object.keys(m.stream_formats||{}).join(',')}`);
  } catch(e) {console.log(`::notice title=Episode ${episode} manifest::${e.name}: ${e.message}`);}
 }
} finally {clearInterval(keep);}
