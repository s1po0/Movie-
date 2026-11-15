import test from 'node:test';
import assert from 'node:assert/strict';
import {donghuaAnimeUrl} from '../src/donghua-player.js';
test('builds a subbed provider URL for the exact AniList entry and episode',()=>{
  assert.equal(donghuaAnimeUrl(126403, 2),'https://megavid.buzz/ani/126403/2/sub');
  assert.equal(donghuaAnimeUrl(112023),'https://megavid.buzz/ani/112023/1/sub');
});
test('rejects invalid identifiers and episodes',()=>{
  for(const [id,ep] of [[0,1],[-1,1],[1,0],[1,10000],[1,1.5],['1',1],[NaN,1],[1,'1']]) assert.throws(()=>donghuaAnimeUrl(id,ep));
});
