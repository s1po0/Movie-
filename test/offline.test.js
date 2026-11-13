import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { isOfflineDownloadable, offlineSubtitle } from '../src/offline.js';

test('only direct HTTPS MP4, WebM and HLS URLs can be saved offline', () => {
  for (const url of ['https://example.com/film.mp4', 'https://example.com/film.WEBM?token=a', 'https://example.com/playlist.m3u8?token=a']) assert.equal(isOfflineDownloadable(url), true);
  for (const url of ['http://example.com/film.mp4', 'https://example.com/tv/1/2/3', 'https://bad@example.com/film.mp4', 'https://example.com/movie.mp4/other', 'not a url']) assert.equal(isOfflineDownloadable(url), false);
});
test('offline subtitles require Sorani translation or explicit Kurdish source confirmation', () => {
  const original = [{ text: 'original' }], sorani = [{ text: 'کوردی' }];
  assert.equal(offlineSubtitle({}, original, false), null);
  assert.equal(offlineSubtitle({ ckb: sorani }, original, false), sorani);
  assert.equal(offlineSubtitle({}, original, true), original);
  assert.equal(offlineSubtitle({ ckb: [] }, [], true), null);
});
