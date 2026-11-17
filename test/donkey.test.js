import test from 'node:test';
import assert from 'node:assert/strict';
import { isDonkeyPage } from '../src/donkey.js';
test('accepts only HTTPS links on the Donkey site', () => {
  assert.equal(isDonkeyPage('https://donkey.to/watch-now?id=42&type=movie'), true);
  assert.equal(isDonkeyPage('https://www.donkey.to/'), true);
  assert.equal(isDonkeyPage('http://donkey.to/'), false);
  assert.equal(isDonkeyPage('https://donkey.to.example.com/watch-now'), false);
  assert.equal(isDonkeyPage('https://archive.org/'), false);
  assert.equal(isDonkeyPage('bad url'), false);
});
