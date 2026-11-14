// Public source inspection: do not print signed video or subtitle URLs.
import { parseSubtitles } from '../src/subtitles.js';
const keep=setInterval(()=>{},1000);
const H={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'};
const get=async u=>{const r=await fetch(u,{headers:H,signal:AbortSignal.timeout(30000)});return {status:r.status,url:r.url,text:await r.text()}};
try {
 for (const ep of [1,25,52]) {
  try {
   const r=await get(`https://donghuastream.org/tomb-of-fallen-gods-season-3-episode-${ep}-multiple-subtitles/`);
   const id=r.text.match(/geo\.dailymotion\.com\/player\/[\w]+\.html\?video=([A-Za-z0-9]+)/)?.[1];
   console.log(`::notice title=Episode ${ep}::page HTTP ${r.status}; player=${id||'missing'}; Viking=${/vikingfile\.com\/f\//i.test(r.text)}`);
   if (!id) continue;
   const response=await get(`https://www.dailymotion.com/player/metadata/video/${id}`);
   if(response.status!==200) {console.log(`::notice title=Episode ${ep} metadata::HTTP ${response.status}`);continue;}
   const m=JSON.parse(response.text);
   console.log(`::notice title=Episode ${ep} metadata::duration=${m.duration}, protected=${m.protected_delivery}, formats=${Object.keys(m.stream_formats||{}).join(',')}, captions=${Object.keys(m.subtitles?.data||{}).join(',')}`);
   for(const key of ['en','en-auto','ar']) {
    const sub=m.subtitles?.data?.[key]?.urls?.[0]; if(!sub) continue;
    const result=await get(sub);const cues=parseSubtitles(result.text);
    const preview=cues.slice(0,2).map(x=>x.text.replace(/[\r\n]/g,' ').slice(0,100)).join(' | ');
    console.log(`::notice title=Episode ${ep} caption::${key} HTTP=${result.status}, cues=${cues.length}, preview=${preview.replace(/%/g,'%25')}`);
   }
  } catch(e) {console.log(`::notice title=Episode ${ep}::${e.name}: ${String(e.message).slice(0,120)}`);}
 }
} finally {clearInterval(keep);}
