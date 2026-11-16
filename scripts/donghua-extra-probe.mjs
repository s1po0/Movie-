import {parseHTML} from 'linkedom';
const urls = [
 'https://kuriname.com/swallowed-star-episode-1/?series=24575&video_index=3',
 'https://kuriname.com/swallowed-star-episode-2/?series=24575&video_index=3',
 'https://anime4i.com/swallowed-star-episode-1-english-subtitles',
 'https://anime4i.com/swallowed-star-episode-125-english-subtitles'
];
await Promise.all(urls.map(async url => {
 try {
  const response = await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36'},signal:AbortSignal.timeout(25000)});
  const html=await response.text(), document=parseHTML(html).document;
  console.log('::notice title=Additional provider::'+JSON.stringify({url,status:response.status,frames:[...document.querySelectorAll('iframe')].map(e=>e.getAttribute('src')||e.getAttribute('data-src')).slice(0,8),select:[...document.querySelectorAll('select option')].map(e=>e.textContent.trim()).slice(0,8),title:document.querySelector('title')?.textContent}).replace(/%/g,'%25'));
 } catch(error) {console.log('::notice title=Additional provider::'+JSON.stringify({url,error:error.message}));}
}));
import {okVideo} from '../src/donghua-direct.js';
import {DOMParser} from 'linkedom';
for(const n of [1,2,3,4,5,6,125]){
 let record={episode:n};
 try {
  let r=await fetch(`https://kuriname.com/swallowed-star-episode-${n}/?series=24575&video_index=3`,{signal:AbortSignal.timeout(20000)}),d=parseHTML(await r.text()).document;
  const frame=[...d.querySelectorAll('iframe')].map(x=>x.getAttribute('src')||'').find(x=>/^\/?\/?(?:https:\/\/)?ok\.ru\/videoembed\/\d+/.test(x));record.status=r.status;record.frame=frame||null;
  if(frame){let e=await fetch(new URL(frame,'https://kuriname.com').href,{signal:AbortSignal.timeout(20000)});const m=okVideo(await e.text(),DOMParser);record.title=m.sourceTitle;const v=await fetch(m.url,{headers:{Range:'bytes=0-1023'},signal:AbortSignal.timeout(15000)});record.video=v.status;record.type=v.headers.get('content-type');await v.body?.cancel()}
 }catch(e){record.error=e.message}
 console.log('::notice title=Kurina mirror probe::'+JSON.stringify(record).replace(/%/g,'%25'));
}
