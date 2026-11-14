// Inspect public episode pages and hosting metadata, without downloading full episodes.
const H={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'};
const get=async u=>{const r=await fetch(u,{headers:H,signal:AbortSignal.timeout(30000)});return {status:r.status,url:r.url,text:await r.text()}};
for (const ep of [1,25,52]) {
 try {
  const url=`https://donghuastream.org/tomb-of-fallen-gods-season-3-episode-${ep}-multiple-subtitles/`;
  const r=await get(url); console.log(`::notice title=Episode ${ep}::HTTP ${r.status}, HTML length ${r.text.length}`);
  if(r.status!==200) continue;
  const hits=r.text.split('\n').filter(x=>/iframe|dailymotion|vikingfile|all sub player|select video server|player-option|data-src|embed|mirror/i.test(x)).filter(x=>x.length<5000).slice(0,45);
  for (const h of hits) console.log(`::notice title=E${ep} HTML::${h.trim().replace(/%/g,'%25').slice(0,1000)}`);
  const vik=r.text.match(/https?:\/\/(?:www\.)?vikingfile\.com\/f\/[\w-]+/i)?.[0];
  if(vik) {const v=await get(vik); console.log(`::notice title=E${ep} Viking::HTTP ${v.status}, HTML length ${v.text.length}`); for(const line of v.text.split('\n').filter(x=>/iframe|download|\.mp4|\.mkv|fileSize|file.size|contentUrl|fetch\(|axios/i.test(x)).filter(x=>x.length<5000).slice(0,18)) console.log(`::notice title=E${ep} Viking page::${line.trim().replace(/%/g,'%25').slice(0,700)}`);}
 } catch(e) { console.log(`::notice title=Episode ${ep}::${e.name}: ${String(e.message).slice(0,120)}`); }
}
