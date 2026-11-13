import test from 'node:test';
import assert from 'node:assert/strict';
import { animeCubeTombSeason3Source, dailymotionMedia } from '../src/animecube.js';

const registry = { bySeason: { 'tomb-of-fallen-gods': { 'primary-1': { 'tab-1754560267416': 'test_version' } } } };

test('resolves exact AnimeCube season and episode to a Dailymotion player', async () => {
  for (const episode of [1, 25, 52]) {
    const calls = [];
    const result = await animeCubeTombSeason3Source(episode, async url => {
      calls.push(url);
      if (calls.length === 1) return registry;
      const parsed = new URL(url);
      assert.equal(parsed.origin, 'https://animecube.live');
      assert.equal(parsed.pathname, `/api/anime/tomb-of-fallen-gods/episode/tomb-of-fallen-gods-tab-1754560267416-ep-${episode}/sources`);
      assert.equal(parsed.searchParams.get('v'), 'test_version');
      assert.equal(parsed.searchParams.get('primaryTabId'), 'primary-1');
      assert.equal(parsed.searchParams.get('seasonId'), 'tab-1754560267416');
      return {success:true, sources:[{platform:'dailymotion',privateId:'kExample123'}]};
    });
    assert.deepEqual(result, {episode, playerUrl:'https://geo.dailymotion.com/player/x1h6z6.html?video=kExample123'});
    assert.equal(calls.length, 2);
  }
});

test('rejects invalid episodes, absent season versions and unsafe player IDs', async () => {
  for (const value of [0, 53, -1, 1.5, '1']) await assert.rejects(animeCubeTombSeason3Source(value, async () => registry));
  await assert.rejects(animeCubeTombSeason3Source(1, async () => ({})), /version unavailable/);
  let count = 0;
  await assert.rejects(animeCubeTombSeason3Source(1, async () => ++count === 1 ? registry : {success:true, sources:[{platform:'dailymotion',privateId:'bad&other=1'}]}), /No supported/);
  count = 0;
  await assert.rejects(animeCubeTombSeason3Source(1, async () => ++count === 1 ? registry : {success:false, sources:[]}), /sources unavailable/);
});

test('discovers non-protected HLS and English subtitles only from allowed hosts', async () => {
  const player = 'https://geo.dailymotion.com/player/x1h6z6.html?video=kExample123';
  const meta = { protected_delivery:false, qualities:{auto:[{type:'application/x-mpegURL',url:'https://cdndirector.dailymotion.com/cdn/manifest/video/123.m3u8?sec=abc'}]}, subtitles:{data:{en:{urls:['https://static2.dmcdn.net/subtitle_en.srt']}}} };
  const result = await dailymotionMedia(player, async url => {
    assert.equal(url, 'https://www.dailymotion.com/player/metadata/video/kExample123');
    return meta;
  });
  assert.deepEqual(result, {streamUrl:'https://cdndirector.dailymotion.com/cdn/manifest/video/123.m3u8?sec=abc',subtitleUrl:'https://static2.dmcdn.net/subtitle_en.srt'});
  await assert.rejects(dailymotionMedia('https://evil.example/player/x1h6z6.html?video=kExample123', async () => meta), /Invalid player/);
  await assert.rejects(dailymotionMedia(player, async () => ({...meta, protected_delivery:true})), /Protected/);
  await assert.rejects(dailymotionMedia(player, async () => ({...meta, protected_delivery:undefined})), /Protected/);
  await assert.rejects(dailymotionMedia(player, async () => ({...meta, qualities:{auto:[{type:'application/x-mpegURL',url:'https://evil.example/playlist.m3u8'}]}})), /HLS stream unavailable/);
  const withoutSubtitle = await dailymotionMedia(player, async () => ({...meta, subtitles:{data:{en:{urls:['https://evil.example/x.srt']}}}}));
  assert.equal(withoutSubtitle.subtitleUrl, null);
});
