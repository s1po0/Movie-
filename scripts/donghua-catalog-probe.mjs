import {parseHTML} from 'linkedom';
const get=async url=>{const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(25000)}); if(!r.ok)throw Error('HTTP '+r.status);return r.text()};
for(const [key,url] of [['donghua','https://donghuastream.org/anime/list-mode/'],['anime','https://animexin.dev/anime/list-mode/'],['show','https://donghuastream.org/anime/tomb-of-fallen-gods-season-3/'],['anime-show','https://animexin.dev/tomb-of-fallen-gods-season-3/']])try{
 let html=await get(url),doc=parseHTML(html).document;
 for(const selector of ['.listupd','.listseries','.listseries ul','ul.cl','div.eplister','div.eplister ul','div.bs','div.listupd a','div.eplister a']) {
  const nodes=doc.querySelectorAll(selector);if(nodes.length) console.log(`::notice title=${key} ${selector}::count=${nodes.length}; example=${nodes[0].outerHTML.slice(0,450).replace(/\s+/g,' ')}`);
 }
 console.log(`::notice title=${key} totals::html=${html.length} title=${doc.title} all-links=${doc.querySelectorAll('a').length}`);
}catch(e){console.log(`::notice title=${key}::${e.message}`)}
