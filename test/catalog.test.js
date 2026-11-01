import test from 'node:test';
import assert from 'node:assert/strict';
import { referenceMovies, referenceUrl, searchReferenceMovies } from '../src/catalog.js';
test('reference titles are searchable and point to a clearly identified source', () => {
  assert.ok(referenceMovies.length > 0);
  assert.deepEqual(searchReferenceMovies('  vErItY ').map(m => m.title), ['Verity']);
  assert.equal(searchReferenceMovies('no such movie').length, 0);
  assert.equal(new URL(referenceUrl).host, 'kurdtips.uno');
});
