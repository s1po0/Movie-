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
