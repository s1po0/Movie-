// Inspect source accessibility and HLS manifests without printing signed URLs.
import {parseHTML} from 'linkedom';
const keep=setInterval(()=>{},1000), ua='Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
try{
let all=[];
for(const [label,url] of [['Swallowed Star 1','https://lmanime.com/swallowed-star-episode-01/'],['Swallowed Star 100','https://lmanime.com/swallowed-star-episode-100/'],['Renegade Immortal 1','https://lmanime.com/renegade-immortal-episode-01/'],['Tomb S3 25 control','https://donghuastream.org/tomb-of-fallen-gods-season-3-episode-25-multiple-subtitles/']]){
 const row={label};all.push(row);try{
 const p=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'user-agent':ua}});row.page=p.status;const {document}=parseHTML(await p.text());let ids=[];
 for(const frame of document.querySelectorAll('iframe'))for(const attr of ['src','data-src','data-litespeed-src']){try{const u=new URL(frame.getAttribute(attr));if(['geo.dailymotion.com','www.dailymotion.com'].includes(u.hostname)){let id=u.searchParams.get('video')||u.pathname.match(/\/embed\/video\/([a-z0-9]+)/i)?.[1];if(id&&!ids.includes(id))ids.push(id)}}catch{}}
 row.ids=ids;row.videos=[];for(const id of ids.slice(0,1)) for(const mode of ['default','mobile']) {const entry={id,mode};row.videos.push(entry);let h=mode==='mobile'?{'user-agent':ua}:{};const r=await fetch(`https://www.dailymotion.com/player/metadata/video/${id}`,{headers:h,signal:AbortSignal.timeout(20000)});entry.metadata=r.status;let j=await r.json();entry.duration=j.duration;entry.captions=Object.keys(j.subtitles?.data||{});entry.protected=j.protected_delivery;const stream=(j.qualities?.auto||[]).find(x=>/mpegurl/i.test(x.type));if(!stream){entry.error=j.error?.title||'no hls';continue}
 for(const [name,headers] of Object.entries({plain:h,referer:{...h,referer:'https://www.dailymotion.com/',origin:'https://www.dailymotion.com'},geo:{...h,referer:'https://geo.dailymotion.com/',origin:'https://geo.dailymotion.com'}})){try{const rr=await fetch(stream.url,{headers,signal:AbortSignal.timeout(20000)});const text=await rr.text();entry[name]={status:rr.status,host:new URL(rr.url).hostname,variants:[...text.matchAll(/RESOLUTION=(\d+x\d+)/g)].map(x=>x[1]),preview:rr.ok?'':text.slice(0,60)}}catch(e){entry[name]={error:e.name}}}
 }
 }catch(e){row.error=e.message}}
console.log('::notice title=Direct HLS diagnostics::'+JSON.stringify(all).replace(/%/g,'%25'));
}finally{clearInterval(keep)}
