import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeSubtitle } from '../src/subtitle-encoding.js';
import { parseSubtitles } from '../src/subtitles.js';

const text = '1\n00:00:01,000 --> 00:00:02,000\nسڵاو Alice 123\n';
test('decodes UTF-8 and UTF-16 subtitles with BOM without corrupting Sorani', () => {
  assert.equal(decodeSubtitle(Buffer.from('\ufeff'+text, 'utf8')), text);
  assert.equal(decodeSubtitle(Buffer.concat([Buffer.from([0xff,0xfe]), Buffer.from(text, 'utf16le')])), text);
  const le = Buffer.from(text, 'utf16le'); const be = Buffer.from(le).swap16();
  assert.equal(decodeSubtitle(Buffer.concat([Buffer.from([0xfe,0xff]), be])), text);
  assert.equal(parseSubtitles(decodeSubtitle(Buffer.from(text, 'utf8')))[0].text, 'سڵاو Alice 123');
});
test('rejects empty, oversized and unrecognisable binary data', () => {
  assert.throws(() => decodeSubtitle(new Uint8Array()), /بەتاڵە/);
  assert.throws(() => decodeSubtitle(new Uint8Array(2_000_001)), /گەورە/);
  assert.throws(() => decodeSubtitle(Uint8Array.from([0xff,0x00,0xff,0x00,0xff,0x00,0xff,0x00])), /UTF-8/);
});

test('detects common Japanese Shift-JIS files', () => {
  const bytes = Uint8Array.from([130,177,130,241,130,201,130,191,130,205,144,162,138,69,129,65,130,177,130,234,130,205,147,250,150,123,140,234,130,204,142,154,150,139,130,197,130,183,129,66,130,230,130,235,130,181,130,173,130,168,138,232,130,162,130,181,130,220,130,183,129,66].flatMap(x => [x]));
  const long = new Uint8Array(bytes.length * 10);
  for (let i=0;i<10;i++) long.set(bytes, i*bytes.length);
  assert.match(decodeSubtitle(long), /^こんにちは世界/);
});
