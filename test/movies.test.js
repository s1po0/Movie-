import test from 'node:test';
import assert from 'node:assert/strict';
import { openMovies } from '../src/movies.js';

test('free movies have unique identifiers and direct HTTPS movie URLs', () => {
  assert.ok(openMovies.length >= 4);
  assert.equal(new Set(openMovies.map(movie => movie.id)).size, openMovies.length);
  for (const movie of openMovies) {
    assert.equal(new URL(movie.url).protocol, 'https:');
    assert.match(movie.url, /\.mp4$/i);
    assert.ok(movie.title && movie.credit);
  }
});
