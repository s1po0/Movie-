import test from 'node:test';
import assert from 'node:assert/strict';
import { movies, classicMovies } from '../src/movies.js';

test('catalog movies have unique identifiers and direct HTTPS movie links', () => {
  assert.ok(movies.length >= 12);
  assert.ok(classicMovies.length >= 8);
  assert.equal(new Set(movies.map(movie => movie.id)).size, movies.length);
  for (const movie of movies) {
    assert.equal(new URL(movie.url).protocol, 'https:');
    assert.match(new URL(movie.url).pathname, /\.mp4$/i);
    assert.ok(movie.title && (movie.credit || movie.sourcePage));
  }
});
