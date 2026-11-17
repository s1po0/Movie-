import test from 'node:test';import assert from 'node:assert/strict';import {DOMParser} from 'linkedom';
import {narulSearchUrl,narulSearchResults,narulEpisodes,narulDailymotionPlayers,narulResolveEpisode} from '../src/narul-direct.js';
const ep='https://naruldonghua.com/swallowed-star-episode-01-english-sub/';
const embed='<iframe src="https://www.dailymotion.com/embed/video/kExample123"></iframe>';
const opt=s=>Buffer.from(s).toString('base64');
const html=`<h1>Swallowed Star Episode 01 English Sub</h1><select><option value="${opt(embed)}">English</option></select>`;
const meta={protected_delivery:false,qualities:{auto:[{type:'application/x-mpegURL',url:'https://cdndirector.dailymotion.com/a.m3u8?x=1'}]},subtitles:{data:{en:{urls:['https://static2.dmcdn.net/a.srt']}}}};
test('Narul search and episode results are explicit and host-scoped',()=>{
 assert.equal(new URL(narulSearchUrl(' Swallowed Star ')).searchParams.get('s'),'Swallowed Star');
 assert.deepEqual(narulSearchResults('<div class="bsx"><a href="/swallowed-star/" title="Swallowed Star"></a></div><div class="bsx"><a href="https://evil.test/swallowed-star/" title="bad"></a></div>',DOMParser),[{title:'Swallowed Star',url:'https://naruldonghua.com/swallowed-star/'}]);
 assert.deepEqual(narulEpisodes(`<div class="eplister"><a href="${ep}"><span class="epl-num">01</span><span class="epl-title">Episode 01</span></a></div>`,'https://naruldonghua.com/swallowed-star/',DOMParser).map(x=>x.number),[1]);
});
test('accepts only a recognized Dailymotion player from explicitly English options',()=>{
 assert.deepEqual(narulDailymotionPlayers(html,DOMParser),['https://geo.dailymotion.com/player/x19jsm.html?video=kExample123']);
 assert.equal(narulDailymotionPlayers(html.replace('English</option>','Indonesian</option>'),DOMParser).length,0);
 assert.equal(narulDailymotionPlayers(`<h1>Episode 1</h1><select><option value="${opt(embed)}">DM</option></select>`,DOMParser).length,0);
 assert.equal(narulDailymotionPlayers(html.replace(opt(embed),opt('<iframe src="https://evil.test/embed/video/kExample123"></iframe>')),DOMParser).length,0);
});
test('resolves a fresh allowed HLS URL with manifest and approved subtitles',async()=>{
 const out=await narulResolveEpisode(ep,async url=>url===ep?html:'#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION=512x288,BANDWIDTH=10\nx.m3u8\n',DOMParser,async()=>meta);
 assert.deepEqual(out.qualityLevels,[288]);assert.equal(out.subtitles[0].language,'en');
 await assert.rejects(narulResolveEpisode(ep,async url=>url===ep?html:'<html>no video</html>',DOMParser,async()=>meta),/No supported/);
 await assert.rejects(narulResolveEpisode('https://evil.test/episode-01/',async()=>html,DOMParser,async()=>meta),/Invalid episode/);
});
