import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSubtitles, toVtt, batches } from '../src/subtitles.js';

test('parses SRT and converts it to WebVTT with timings intact', () => {
  const cues = parseSubtitles('\ufeff1\r\n00:00:01,500 --> 00:00:03,000\r\nHello!\r\nSecond line\r\n\r\n2\r\n00:00:04,000 --> 00:00:05,100\r\n<i>Bye</i>');
  assert.deepEqual(cues, [{start:'00:00:01.500',end:'00:00:03.000',text:'Hello!\nSecond line'},{start:'00:00:04.000',end:'00:00:05.100',text:'Bye'}]);
  assert.match(toVtt(cues), /^WEBVTT\n\n00:00:01\.500 --> 00:00:03\.000/);
});
test('parses VTT cue identifiers, short times, settings and notes', () => {
  const cues = parseSubtitles('WEBVTT\n\nNOTE ignored\ntext\n\nhello\n00:02.000 --> 00:04.500 align:start\nHi');
  assert.deepEqual(cues, [{start:'00:00:02.000',end:'00:00:04.500',text:'Hi'}]);
});
test('splits translation batches without dropping cues', () => {
  const cues = Array.from({length:205}, (_, i) => ({text: String(i)}));
  const groups = batches(cues, 24000, 100);
  assert.deepEqual(groups.map(group => group.length), [100,100,5]);
  assert.deepEqual(groups.flat(), cues);
});
