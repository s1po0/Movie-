import test from 'node:test';
import assert from 'node:assert/strict';
import { translationGroups, translationUrl, translatedText, translateGroup } from '../src/translate.js';

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
