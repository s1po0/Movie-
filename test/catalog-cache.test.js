import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogCache } from '../src/catalog-cache.js';

test('reuses catalog requests, deduplicates in-flight calls and expires entries', async () => {
  let calls = 0, clock = 0;
  const get = createCatalogCache(async url => { calls++; return { metas: [{ id: url }] }; }, { ttl: 100, now: () => clock });
  const [a, b] = await Promise.all([get('a'), get('a')]);
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
  await get('a');
  assert.equal(calls, 1);
  clock = 101;
  await get('a');
  assert.equal(calls, 2);
});

test('evicts old catalog entries and never caches failed or malformed responses', async () => {
  let calls = 0, fail = true;
  const get = createCatalogCache(async url => {
    calls++;
    if (url === 'bad') return fail ? {} : { metas: [] };
    return { metas: [{ id: url }] };
  }, { maxEntries: 2 });
  await get('a'); await get('b'); await get('a'); await get('c'); await get('b');
  assert.equal(calls, 4);
  await assert.rejects(get('bad'));
  fail = false;
  await get('bad');
  assert.equal(calls, 6);
});
