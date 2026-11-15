// Read-only availability diagnostics: no signed stream URLs, media or subtitle text are logged.
import { animeCubeTombSeason3Source, dailymotionMedia } from '../src/animecube.js';
import { donghuaEpisodeSource } from '../src/donghuastream.js';
import { parseSubtitles } from '../src/subtitles.js';
const request=async (url,mode='json')=>{const r=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok) throw Error('HTTP '+r.status);return mode==='json'?r.json():r.text()};
for(const ep of [1,25,52]) {
 for(const source of ['donghua','animecube']) try {
   const player = source==='donghua'?await donghuaEpisodeSource(ep,u=>request(u,'text')):await animeCubeTombSeason3Source(ep,u=>request(u));
   const meta=await request(`https://www.dailymotion.com/player/metadata/video/${new URL(player.playerUrl).searchParams.get('video')}`);
   const tracks = meta.subtitles?.data || {};
   const detail=[];
   for(const [lang,track] of Object.entries(tracks)) {
      const url=track.urls?.find(u=>{try {const p=new URL(u);return p.protocol==='https:'&&['static1.dmcdn.net','static2.dmcdn.net'].includes(p.hostname)&&!p.port&&!p.username&&!p.password}catch{return false}});
      if(!url)continue;try {let c=parseSubtitles(await request(url,'text'));detail.push(`${lang}:${c.length}`)}catch{detail.push(`${lang}:unavailable`)}
   }
   const id=new URL(player.playerUrl).searchParams.get('video');
   console.log(`::notice title=S3 ${source} E${ep}::video-id=${id} captions=${detail.join(',')||'none'}`);
 } catch(e) { console.log(`::notice title=S3 ${source} E${ep}::${e.message}`); }
 for(const [name,url] of [
   ['subtitle-db',`https://api.thesubtitledb.org/integrations/stremio/subtitles/series/tt31530980%3A3%3A${ep}.json`],
   ['opensubtitles',`https://opensubtitles-v3.strem.io/subtitles/series/tt31530980%3A3%3A${ep}.json`],
 ]) try {
   const data=await request(url);const rows=data.subtitles||[];
   console.log(`::notice title=S3 ${name} E${ep}::tracks=${rows.length} languages=${[...new Set(rows.map(x=>x.lang))].join(',')}`);
 }catch(e){console.log(`::notice title=S3 ${name} E${ep}::${e.message}`)}
}
