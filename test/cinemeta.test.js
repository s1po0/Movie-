import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogUrl, catalogResults } from '../src/cinemeta.js';

test('builds movie search and popular catalog URLs safely', () => {
  assert.equal(catalogUrl(''), 'https://v3-cinemeta.strem.io/catalog/movie/top.json');
  assert.equal(catalogUrl('', 2), 'https://v3-cinemeta.strem.io/catalog/movie/top/skip=100.json');
  assert.equal(catalogUrl('  The Matrix & more  '), 'https://v3-cinemeta.strem.io/catalog/movie/top/search=The%20Matrix%20%26%20more.json');
  assert.throws(() => catalogUrl('', 0));
});

test('maps and deduplicates valid movie metadata without promising playback', () => {
  const items = catalogResults({ metas: [
    { id: 'tt0133093', name: 'The Matrix', type: 'movie', releaseInfo: '1999', poster: 'https://example.com/poster.jpg' },
    { id: 'tt0133093', name: 'duplicate', type: 'movie' },
    { id: 'tt0468569', name: 'The Dark Knight', type: 'movie', poster: 'javascript:alert(1)' },
    { id: 'tt1234567', name: 'A series', type: 'series' },
    { id: '../bad', name: 'bad id', type: 'movie' },
  ] });
  assert.equal(items.length, 2);
  assert.equal(items[0].imdbId, 'tt0133093');
  assert.equal(items[0].year, '1999');
  assert.equal(items[1].poster, 'https://images.metahub.space/poster/small/tt0468569/img');
  assert.throws(() => catalogResults({}));
});
