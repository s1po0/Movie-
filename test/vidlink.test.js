import test from 'node:test';
import assert from 'node:assert/strict';
import { movieEmbedUrl, movieSourceUrl, movieSources } from '../src/vidlink.js';

test('builds a player embed URL only for numeric movie IDs', () => {
  assert.equal(movieEmbedUrl('155'), 'https://vidlink.pro/movie/155');
  assert.throws(() => movieEmbedUrl('../155'));
  assert.throws(() => movieEmbedUrl('155?x=1'));
});

test('creates a short-lived source request for a valid TMDB movie id', () => {
  assert.equal(movieSourceUrl('155', 1700000000000), 'https://vidlink.pro/api/b/movie/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQXwUvTSIhfLnqUzrHA0Z98GGDf5NQFZ8ijaq?multiLang=1');
  assert.notEqual(movieSourceUrl('155', 1700000000000), movieSourceUrl('155', 1700000010000));
  assert.throws(() => movieSourceUrl('../155'));
  assert.throws(() => movieSourceUrl('155', NaN));
});

test('resolves playable sources and subtitle languages without retaining expired URLs', () => {
  const resolved = movieSources({ stream: {
    qualities: {
      360: { type: 'mp4', url: 'https://video.example/360.mp4?signature=abc', requiresProxy: true },
      720: { type: 'mp4', url: 'https://video.example/720.mp4?signature=abc', requiresProxy: true, codecName: 'hevc' },
      1080: { type: 'mp4', url: 'https://video.example/1080.mp4?signature=abc' },
    },
    captions: [
      { language: 'English', url: 'https://sub.example/en.srt?signature=abc', type: 'srt' },
      { language: 'العربية', url: 'https://sub.example/ar.vtt?signature=abc', type: 'vtt' },
      { language: 'Bad', url: 'javascript:alert(1)', type: 'srt' },
    ],
  } });
  assert.equal(resolved.source.url, 'https://video.example/720.mp4?signature=abc');
  assert.equal(resolved.source.requiresProxy, true);
  assert.equal(resolved.source.codec, 'hevc');
  assert.deepEqual(resolved.subtitles.map(x => x.label), ['English', 'العربية']);
  assert.equal(movieSources({ stream: { playlist: 'https://video.example/master.m3u8', captions: [] } }).source.type, 'hls');
  assert.equal(movieSources({ stream: { qualities: { 720: { type: 'mp4', url: 'http://video.example/a.mp4' } } } }).source, null);
  assert.throws(() => movieSources(null));
});
