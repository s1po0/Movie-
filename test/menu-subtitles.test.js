import test from 'node:test';
import assert from 'node:assert/strict';
import { translateMenuSubtitles, subtitleTrackUrl, withSubtitleTrack } from '../src/menu-subtitles.js';
import { parseSubtitles } from '../src/subtitles.js';

const sample = Array.from({ length: 65 }, (_, i) => `${i+1}\n00:${String(Math.floor(i/60)).padStart(2, '0')}:${String(i%60).padStart(2, '0')},000 --> 00:${String(Math.floor((i+1)/60)).padStart(2, '0')}:${String((i+1)%60).padStart(2, '0')},000\nLine ${i}\n`).join('\n');

test('translates the complete original subtitle to Sorani while preserving every timing and cue order', async () => {
  let active = 0, maxActive = 0; const calls = [], progress = [];
  const result = await translateMenuSubtitles(sample, async (text, lang) => {
    calls.push(lang); active++; maxActive = Math.max(active, maxActive);
    await new Promise(r => setTimeout(r, text.includes('Line 0\n') ? 5 : 1)); active--;
    return text.split('\n').map(line => `سۆرانی ${line}`).join('\n');
  }, { onProgress: (done, total) => progress.push([done, total]) });
  const original = parseSubtitles(sample), translated = parseSubtitles(result);
  assert.ok(result.startsWith('WEBVTT\n')); assert.equal(translated.length, original.length);
  translated.forEach((cue, i) => { assert.equal(cue.start, original[i].start); assert.equal(cue.end, original[i].end); assert.equal(cue.text, `سۆرانی ${original[i].text}`); });
  assert.ok(calls.every(lang => lang === 'ckb')); assert.ok(maxActive <= 2); assert.equal(progress.at(-1)[0], progress.at(-1)[1]);
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
