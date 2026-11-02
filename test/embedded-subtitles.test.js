import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmbeddedSubtitles } from '../src/embedded-subtitles.js';

const subtitles = `1\n00:00:01,000 --> 00:00:03,000\nHello!\n\n2\n00:00:05,000 --> 00:00:07,000\nHow are you?\n\n3\n00:02:00,000 --> 00:02:02,000\nLater\n`;
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

test('translates to Sorani ahead of playback and synchronizes seeks and overlap', async () => {
  let shown = '', calls = [];
  const player = createEmbeddedSubtitles({ onText: text => shown = text, onStatus() {}, request: async (text, target) => { calls.push([text, target]); return text.split('\n').map(t => `کوردی ${t}`).join('\n'); } });
  player.setCues(subtitles);
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], 'ckb');
  player.setTime(1.5); assert.equal(shown, 'کوردی Hello!');
  player.setTime(4); assert.equal(shown, '');
  player.setTime(5.5); assert.equal(shown, 'کوردی How are you?');
  player.setTime(120.5); await flush(); assert.equal(shown, 'کوردی Later');
  player.setTime(0); assert.equal(shown, '');
  player.setTime(NaN); assert.equal(shown, '');
  player.setTarget('off'); player.setTime(1.5); assert.equal(shown, '');
  player.destroy();
});

test('Sorani upload displays without translation and switches to another language', async () => {
  let shown = '', calls = [];
  const player = createEmbeddedSubtitles({ onText: value => shown = value, onStatus() {}, request: async (text, lang) => { calls.push(lang); return text; } });
  player.setCues(subtitles, true); player.setTime(1.1);
  assert.equal(shown, 'Hello!'); assert.deepEqual(calls, []);
  player.setTarget('ar'); await flush(); assert.equal(calls[0], 'ar'); assert.equal(shown, 'Hello!');
  player.destroy();
});

test('ignores obsolete translation after changing source or destroying', async () => {
  let resolve, shown = '';
  const player = createEmbeddedSubtitles({ onText: value => shown = value, onStatus() {}, request: () => new Promise(r => resolve = r) });
  player.setCues(subtitles); player.setTime(1.5);
  player.setCues('1\n00:00:01,000 --> 00:00:03,000\nنوێ', true);
  assert.equal(shown, 'نوێ'); resolve('old\nold'); await flush(); assert.equal(shown, 'نوێ');
  player.destroy();
});

test('stops on translation failure until retry and rejects malformed subtitle files', async () => {
  let calls = 0, status = '', shown = '';
  const player = createEmbeddedSubtitles({ onText: value => shown = value, onStatus: value => status = value, request: async text => { calls++; if (calls === 1) throw Error('offline'); return text; } });
  assert.throws(() => player.setCues('not subtitles'));
  player.setCues(subtitles); await flush();
  assert.match(status, /سەرکەوتوو نەبوو/); player.setTime(1.5); await flush(); assert.equal(calls, 1);
  player.retry(); await flush(); assert.equal(shown, 'Hello!');
  player.destroy();
});

test('prepares the next subtitle even during a long silent introduction', async () => {
  let calls = [], shown = '';
  const player = createEmbeddedSubtitles({ onText: value => shown = value, onStatus() {}, request: async (text, lang) => { calls.push([text, lang]); return text.split('\n').map(() => 'سڵاو').join('\n'); } });
  player.setCues('1\n00:03:00,000 --> 00:03:05,000\nHello\n\n2\n00:10:00,000 --> 00:10:05,000\nLater');
  await flush(); assert.equal(calls.length, 1); assert.equal(calls[0][1], 'ckb');
  player.setTime(181); assert.equal(shown, 'سڵاو');
  player.destroy();
});

test('subtitle timing adjustment changes display without changing the movie position', async () => {
  let shown = '';
  const player = createEmbeddedSubtitles({ onText: value => shown = value, onStatus() {}, request: async text => text });
  player.setCues(subtitles); await flush(); player.setTime(3.5); assert.equal(shown, '');
  player.setOffset(2); assert.equal(shown, 'Hello!');
  player.setOffset(0); assert.equal(shown, ''); player.destroy();
});
