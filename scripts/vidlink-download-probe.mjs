// Check whether a provider actually exposes direct unprotected media, without logging signed URLs.
import { movieSourceUrl, seriesSourceUrl, movieSources } from '../src/vidlink.js';
const cases = [
  {name:'Movie 155',url:movieSourceUrl(155), referer:'https://vidlink.pro/movie/155'},
  {name:'Movie 496243',url:movieSourceUrl(496243), referer:'https://vidlink.pro/movie/496243'},
  {name:'Drama 93405 S1E1',url:seriesSourceUrl(93405,1,1), referer:'https://vidlink.pro/tv/93405/1/1'},
  {name:'Drama 110316 S1E1',url:seriesSourceUrl(110316,1,1), referer:'https://vidlink.pro/tv/110316/1/1'},
];
const fetchTimed = (url, options={}) => fetch(url, { ...options, signal:AbortSignal.timeout(18000) });
for (const c of cases) {
  try {
    const headers = {'User-Agent':'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',Referer:c.referer,Origin:'https://vidlink.pro',Accept:'*/*'};
    const response=await fetchTimed(c.url,{headers});
    if(!response.ok) { console.log(`::notice title=Provider probe::${c.name}: API HTTP ${response.status}`); continue; }
    const data=await response.json(), resolved=movieSources(data);
    const choices=Object.entries(data.stream?.qualities||{}).map(([quality,v])=>`${quality}:${v?.type||'?'}:${v?.requiresProxy?'proxy':'direct'}`).join(',');
    if(!resolved.source) { console.log(`::notice title=Provider probe::${c.name}: no source, choices ${choices}`); continue; }
    let media=await fetchTimed(resolved.source.url,{headers:{...headers,Range:'bytes=0-2047'}});
    let info=`source ${resolved.source.type}, proxy=${resolved.source.requiresProxy}, media HTTP ${media.status}, choices ${choices}, subtitles ${resolved.subtitles.length}`;
    if(media.ok && resolved.source.type==='hls') {
      const playlist=await media.text();
      const encrypted=/#EXT-X-KEY:(?!METHOD=NONE)/i.test(playlist);
      const next=playlist.split('\n').find(line=>line.trim() && !line.startsWith('#'));
      info+=`, encrypted=${encrypted}, master=${/#EXT-X-STREAM-INF/i.test(playlist)}`;
      if(next && !encrypted) { const child=await fetchTimed(new URL(next.trim(),media.url).href,{headers:{...headers,Range:'bytes=0-2047'}}); info+=`, first child HTTP ${child.status}`; await child.body?.cancel(); }
    } else await media.body?.cancel();
    console.log(`::notice title=Provider probe::${c.name}: ${info}`);
  } catch(error) { console.log(`::notice title=Provider probe::${c.name}: ${error.name} ${String(error.message).split('\n')[0]}`); }
}
