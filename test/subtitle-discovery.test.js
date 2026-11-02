import test from 'node:test';
import assert from 'node:assert/strict';
import { findMovieSubtitles } from '../src/subtitle-discovery.js';

const vtt = 'WEBVTT\n\n' + Array.from({length: 12}, (_, i) => `00:00:${String(i).padStart(2, '0')}.000 --> 00:00:${String(i + 1).padStart(2, '0')}.000\nLine ${i}\n\n`).join('');
const first = 'https://api.thesubtitledb.org/integrations/stremio/s/42.vtt';
const fallback = 'https://subs5.strem.io/en/download/subencoding-stremio-utf8/src-api/file/123';

test('automatically discovers and loads English subtitles for a movie', async () => {
  const calls = [];
  const result = await findMovieSubtitles('tt0468569', { json: async url => { calls.push(url); return { subtitles: [{ lang: 'eng', url: first }] }; }, text: async url => { calls.push(url); return vtt; } });
  assert.equal(result, vtt); assert.match(calls[0], /tt0468569/); assert.equal(calls[1], first);
});

test('falls back after a service error and never fetches untrusted URLs', async () => {
  const requested = [];
  const result = await findMovieSubtitles('tt0133093', { json: async url => url.includes('thesubtitledb') ? { subtitles: [{ lang: 'eng', url: 'https://evil.example/steal' }, { lang: 'eng', url: first }] } : { subtitles: [{ lang: 'eng', url: fallback }] }, text: async url => { requested.push(url); if (url === first) throw Error('unavailable'); return vtt; } });
  assert.equal(result, vtt); assert.deepEqual(requested, [first, fallback]);
});

test('stops after cancellation and rejects invalid movie identifiers', async () => {
  let active = true, downloads = 0;
  const pending = findMovieSubtitles('tt0468569', { json: async () => { active = false; return { subtitles: [{ lang: 'eng', url: first }] }; }, text: async () => { downloads++; return vtt; }, isCurrent: () => active });
  assert.equal(await pending, null); assert.equal(downloads, 0);
  await assert.rejects(findMovieSubtitles('tt../bad', { json() {}, text() {} }));
});

test('skips incomplete and invalid tracks', async () => {
  const requested = [];
  const result = await findMovieSubtitles('tt0468569', { json: async () => ({ subtitles: [{ lang: 'eng', url: first, subtitleFileName: 'movie.CD1.srt' }, { lang: 'eng', url: 'https://api.thesubtitledb.org/integrations/stremio/s/43.vtt', subtitleFileName: 'full.srt' }] }), text: async url => { requested.push(url); return vtt; } });
  assert.equal(result, vtt); assert.match(requested[0], /43\.vtt/);
});
