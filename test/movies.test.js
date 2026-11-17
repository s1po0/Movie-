import test from 'node:test';
import assert from 'node:assert/strict';
import { movies, classicMovies, openMovies } from '../src/movies.js';

test('catalog movies have unique identifiers and direct HTTPS movie links', () => {
  assert.ok(movies.length >= 12);
  assert.ok(classicMovies.length >= 8);
  assert.equal(new Set(movies.map(movie => movie.id)).size, movies.length);
  for (const movie of movies) {
    if (movie.tmdbId) { assert.match(movie.tmdbId, /^\d+$/); continue; }
    assert.equal(new URL(movie.url).protocol, 'https:');
    assert.match(new URL(movie.url).pathname, /\.(?:mp4|m3u8)$/i);
    assert.ok(movie.title && (movie.credit || movie.sourcePage));
  }
});


test('curated HLS films have multiple direct subtitle sources and attribution', () => {
  const films = openMovies.filter(movie => /\.m3u8$/i.test(movie.url));
  assert.equal(films.length, 2);
  for (const movie of films) {
    assert.ok(movie.subtitles.length >= 2);
    assert.ok(movie.subtitles.every(track => track.label && /^https:\/\//.test(track.url) && /\.vtt$/.test(track.url)));
    assert.equal(new Set(movie.subtitles.map(track => track.url)).size, movie.subtitles.length);
    assert.ok(movie.credit && movie.attributionUrl);
  }

});
