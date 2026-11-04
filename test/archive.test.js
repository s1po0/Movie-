import test from 'node:test';
import assert from 'node:assert/strict';
import { searchUrl, searchResults, metadataUrl, archiveFiles } from '../src/archive.js';

test('search escapes user text and only maps valid Archive identifiers', () => {
  const url = new URL(searchUrl('"crime" AND horror', 2));
  assert.equal(url.searchParams.get('page'), '2');
  assert.match(url.searchParams.get('q'), /collection:feature_films/);
  const result = searchResults({ response: { docs: [{ identifier: 'public-film_1', title: 'A film', year: 1930 }, { identifier: '../bad', title: 'Bad' }] } });
  assert.equal(result.length, 1);
  assert.equal(result[0].archiveId, 'public-film_1');
  assert.throws(() => metadataUrl('../secret'));
});

test('selects a movie file and subtitle tracks without fabricating URLs', () => {
  const result = archiveFiles('example', { files: [
    { name: 'trailer.mp4', size: '90000000' },
    { name: 'movie HD.mp4', size: '900000000' },
    { name: 'movie.mp4', size: '50000000' },
    { name: 'subs/english.vtt' }, { name: 'hidden.srt', private: true },
  ] });
  assert.equal(result.url, 'https://archive.org/download/example/movie.mp4');
  assert.deepEqual(result.subtitles, [{ label: 'english.vtt', url: 'https://archive.org/download/example/subs/english.vtt' }]);
  assert.equal(archiveFiles('example', { files: [] }).url, null);
  assert.throws(() => archiveFiles('example', { is_dark: true, files: [] }));
});
