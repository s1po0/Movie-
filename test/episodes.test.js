import test from 'node:test';
import assert from 'node:assert/strict';
import { episodeGroups } from '../src/episodes.js';
import { searchMovies } from '../src/catalog.js';

test('Tomb of Fallen Gods is searchable by title and aliases', () => {
  for (const term of ['Tomb of Fallen Gods', 'shen mu', '神墓']) {
    const [series] = searchMovies(term);
    assert.equal(series?.id, 'series-tomb-of-fallen-gods');
    assert.equal(series.imdbId, 'tt31530980');
    assert.equal(series.tmdbId, '206343');
    assert.equal(series.mediaKind, 'series');
  }
});

test('episode choices are grouped, sorted, deduplicated and omit future or invalid entries', () => {
  const data = {meta:{id:'tt31530980',videos:[
    {season:3,episode:52,released:'2026-07-23T00:00:00Z'},
    {season:1,episode:2}, {season:1,episode:1}, {season:1,episode:1},
    {season:2,episode:1}, {season:3,episode:1}, {season:2,episode:3,released:'2099-01-01T00:00:00Z'},
    {season:0,episode:1}, {season:1,episode:-1}, {season:'x',episode:1},
  ]}};
  assert.deepEqual(episodeGroups(data,'tt31530980',Date.parse('2026-11-01')), [
    {season:1,episodes:[1,2]}, {season:2,episodes:[1]}, {season:3,episodes:[1,52]},
  ]);
  assert.deepEqual(episodeGroups(data,'tt1234567'), []);
  assert.deepEqual(episodeGroups(null,'tt31530980'), []);
});
