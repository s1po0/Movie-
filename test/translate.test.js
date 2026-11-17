import test from 'node:test';
import assert from 'node:assert/strict';
import { translationGroups, translationUrl, translatedText, translateGroup, soraniRtl, assertSoraniScript } from '../src/translate.js';

test('constructs keyless Google translation URL and parses the response', () => {
  const url = new URL(translationUrl('Hello world', 'ckb'));
  assert.equal(url.searchParams.get('q'), 'Hello world');
  assert.equal(url.searchParams.get('tl'), 'ckb');
  assert.equal(url.searchParams.has('key'), false);
  assert.equal(translatedText([[['سڵاو', 'Hello'], [' جیهان', ' world']]]), 'سڵاو جیهان');
});
test('preserves cue timings and falls back when translated separators change', async () => {
  const cues = [{start:'1',end:'2',text:'One\nline'}, {start:'3',end:'4',text:'Two'}];
  const group = translationGroups(cues)[0];
  const requests = [];
  const translated = await translateGroup(group, async text => { requests.push(text); return text.includes('\n') ? 'combined' : `translated ${text}`; });
  assert.deepEqual(requests, ['One line\nTwo', 'One line', 'Two']);
  assert.deepEqual(translated, [{start:'1',end:'2',text:'translated One line'}, {start:'3',end:'4',text:'translated Two'}]);
});
test('keeps translated batches aligned when newlines are preserved', async () => {
  const group = translationGroups([{text:'Hi'}, {text:'Bye'}])[0];
  assert.deepEqual(await translateGroup(group, async () => 'سڵاو\nخواحافیز'), [{text:'سڵاو'}, {text:'خواحافیز'}]);
});

test('uses a known language only when valid, or detects it automatically', () => {
  assert.equal(new URL(translationUrl('مرحبا', 'ckb', 'ar')).searchParams.get('sl'), 'ar');
  assert.equal(new URL(translationUrl('你好', 'ckb')).searchParams.get('sl'), 'auto');
  assert.equal(new URL(translationUrl('hello', 'ckb', 'en&tl=en')).searchParams.get('sl'), 'auto');
});

test('marks Sorani lines RTL without reversing Kurdish, English, punctuation or numbers', () => {
  const input = [{start:'1', end:'2', text:'سڵاو Alice 123!\n(باشە؟)'}];
  const output = soraniRtl(input);
  assert.equal(output[0].text, '\u200fسڵاو Alice 123!\u200f\n\u200f(باشە؟)\u200f');
  assert.deepEqual(soraniRtl(output), output);
  assert.equal(input[0].text, 'سڵاو Alice 123!\n(باشە؟)');
  assert.throws(() => assertSoraniScript([{text:'The service returned English instead of a Sorani subtitle translation.'}]), /Sorani/);
  assert.doesNotThrow(() => assertSoraniScript([{text:'سڵاو چۆنی ئەمڕۆ دەتوانیت بە ئاسانی سەیری فیلمەکە بکەیت؟'}]));
});
