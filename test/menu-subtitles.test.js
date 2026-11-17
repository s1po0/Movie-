import test from 'node:test';
import assert from 'node:assert/strict';
import { translateMenuSubtitles, subtitleTrackUrl, withSubtitleTrack, createMenuTranslationCache } from '../src/menu-subtitles.js';
import { parseSubtitles } from '../src/subtitles.js';

const sample = Array.from({ length: 65 }, (_, i) => `${i+1}\n00:${String(Math.floor(i/60)).padStart(2, '0')}:${String(i%60).padStart(2, '0')},000 --> 00:${String(Math.floor((i+1)/60)).padStart(2, '0')}:${String((i+1)%60).padStart(2, '0')},000\nLine ${i}\n`).join('\n');

test('translates the complete original subtitle to Sorani while preserving every timing and cue order', async () => {
  let active = 0, maxActive = 0; const calls = [], progress = [];
  const result = await translateMenuSubtitles(sample, async (text, lang) => {
    calls.push(lang); active++; maxActive = Math.max(active, maxActive);
    await new Promise(r => setTimeout(r, text.includes('Line 0\n') ? 25 : 5)); active--;
    return text.split('\n').map(line => `سۆرانی ${line}`).join('\n');
  }, { minSpacingMs: 0, onProgress: (done, total) => progress.push([done, total]) });
  const original = parseSubtitles(sample), translated = parseSubtitles(result);
  assert.ok(result.startsWith('WEBVTT\n')); assert.equal(translated.length, original.length);
  translated.forEach((cue, i) => { assert.equal(cue.start, original[i].start); assert.equal(cue.end, original[i].end); assert.equal(cue.text, `\u200fسۆرانی ${original[i].text}\u200f`); });
  assert.ok(calls.every(lang => lang === 'ckb')); assert.equal(maxActive, 3); assert.equal(progress.at(-1)[0], progress.at(-1)[1]);
});

test('stops after cancellation and rejects invalid subtitle data', async () => {
  let valid = true; await assert.rejects(translateMenuSubtitles(sample, async t => { valid = false; return t; }, { isCurrent: () => valid }), /cancelled/);
  await assert.rejects(translateMenuSubtitles('no subtitle', async t => t), /Invalid/);
});

test('creates an exact temporary menu URL, preserving playback time', () => {
  const token = 'abcdef0123456789abcdef0123456789';
  assert.equal(subtitleTrackUrl(token), `https://vidlink.pro/dimo-sorani/${token}.vtt`);
  const url = new URL(withSubtitleTrack('https://vidlink.pro/movie/155', token, 123.6));
  assert.equal(url.searchParams.get('sub_file'), subtitleTrackUrl(token)); assert.equal(url.searchParams.get('sub_label'), 'کوردی سۆرانی'); assert.equal(url.searchParams.get('startAt'), '123');
  assert.throws(() => subtitleTrackUrl('../../x')); assert.throws(() => withSubtitleTrack('https://evil.example/movie/155', token));
});


test('retries failed requests while preserving ordered cues', async () => {
  let calls = 0;
  const result = await translateMenuSubtitles(sample, async text => {
    if (++calls === 1) throw new Error('Temporary failure');
    return text.split('\n').map(line => `سۆرانی ${line}`).join('\n');
  }, { minSpacingMs: 0, sleep: async () => {} });
  assert.ok(calls >= 4);
  assert.deepEqual(parseSubtitles(result).map(c => c.text), parseSubtitles(sample).map(c => `\u200fسۆرانی ${c.text}\u200f`));
});

test('bounds the per-session cache and keys by the entire source track', () => {
  const cache = createMenuTranslationCache(2);
  cache.set('track one', 'translation one'); cache.set('track two', 'translation two');
  assert.equal(cache.get('track one'), 'translation one');
  cache.set('track three', 'translation three');
  assert.equal(cache.get('track two'), undefined);
  assert.equal(cache.get('track one'), 'translation one');
  assert.equal(cache.get('track three'), 'translation three');
  assert.equal(cache.get('track one, different edition'), undefined);
});

test('rejects a long untranslated track instead of reporting success', async () => {
  await assert.rejects(translateMenuSubtitles(sample, async text => text, {minSpacingMs: 0}), /Sorani script/);
});

test('other target languages are not marked RTL or forced to Sorani', async () => {
  const calls = [];
  const result = await translateMenuSubtitles(sample, async (text, target) => {calls.push(target); return text;}, {target: 'en', minSpacingMs: 0});
  assert.ok(calls.every(c => c === 'en'));
  assert.equal(parseSubtitles(result)[0].text, 'Line 0');
});
