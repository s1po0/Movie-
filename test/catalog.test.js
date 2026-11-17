import test from 'node:test';
import assert from 'node:assert/strict';
import { searchMovies } from '../src/catalog.js';
test('searches playable movies by title, genre, and year', () => {
  assert.deepEqual(searchMovies('  sInTeL ').map(m => m.title), ['Sintel']);
  assert.deepEqual(searchMovies('dark knight').map(m => m.title), ['The Dark Knight']);
  assert.ok(searchMovies('دراما').length > 0);
  assert.ok(searchMovies('1930').length > 0);
  assert.equal(searchMovies('no such movie').length, 0);
});
