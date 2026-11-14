import test from 'node:test';
import assert from 'node:assert/strict';
import {donghuaEpisodeUrl, donghuaDailymotionPlayer, donghuaEpisodeSource} from '../src/donghuastream.js';

test('resolves the requested episode page to its trusted player', async () => {
  for (const ep of [1,25,52]) {
    const result = await donghuaEpisodeSource(ep, async url => {
      assert.equal(url, `https://donghuastream.org/tomb-of-fallen-gods-season-3-episode-${ep}-multiple-subtitles/`);
      return '<iframe src="about:blank" data-litespeed-src="https://geo.dailymotion.com/player/x19jsm.html?video=kA123&amp;x=1"></iframe>';
    });
    assert.deepEqual(result, {episode:ep,playerUrl:'https://geo.dailymotion.com/player/x19jsm.html?video=kA123'});
  }
});
test('rejects invalid episodes, malformed pages and untrusted embeds', async () => {
  for (const ep of [0,53,1.5,'1']) assert.throws(() => donghuaEpisodeUrl(ep));
  assert.throws(() => donghuaDailymotionPlayer('<iframe src="https://geo.dailymotion.com.evil.example/player/x19jsm.html?video=1"></iframe>'));
  assert.throws(() => donghuaDailymotionPlayer('<iframe src="http://geo.dailymotion.com/player/x19jsm.html?video=1"></iframe>'));
  assert.throws(() => donghuaDailymotionPlayer('<iframe src="https://geo.dailymotion.com/player/x19jsm.html?video=x%26a"></iframe>'));
});
