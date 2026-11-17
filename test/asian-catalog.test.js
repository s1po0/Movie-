import test from 'node:test';
import assert from 'node:assert/strict';
import { asianCatalogUrl, asianCatalogResults, asianMetadataUrl, koreanDramaSearchUrl, subtitleIndexUrl, hasEnglishSubtitle } from '../src/asian-catalog.js';
import { seriesEmbedUrl } from '../src/vidlink-embed.js';
import { withSubtitleTrack } from '../src/menu-subtitles.js';
import { findMovieSubtitles } from '../src/subtitle-discovery.js';

test('filters actual countries and K-drama series with valid playable identifiers', () => {
  const metas = [
    {id:'tt10850932',type:'series',name:'Crash Landing on You',country:'South Korea',genres:['Drama'],moviedb_id:94796},
    {id:'tt1234567',type:'series',name:'Other show',country:'United States',genres:['Drama'],moviedb_id:2},
    {id:'tt1234568',type:'series',name:'Other genre',country:'South Korea',genres:['Comedy'],moviedb_id:3},
    {id:'tt1234569',type:'series',name:'No TMDB',country:'South Korea',genres:['Drama']},
  ];
  const [show] = asianCatalogResults('korean', {metas});
  assert.equal(asianCatalogResults('korean', {metas}).length, 1);
  assert.equal(seriesEmbedUrl(show.tmdbId, 1, 2), 'https://vidlink.pro/tv/94796/1/2');
  assert.equal(new URL(withSubtitleTrack(seriesEmbedUrl(show.tmdbId,1,2), 'a'.repeat(32))).pathname, '/tv/94796/1/2');
  assert.throws(() => seriesEmbedUrl('94796/../movie',1,2));
  assert.throws(() => seriesEmbedUrl('94796',0,1));
  assert.equal(subtitleIndexUrl(show), 'https://api.thesubtitledb.org/integrations/stremio/subtitles/series/tt10850932%3A1%3A1.json');
  assert.equal(asianCatalogUrl('japanese', 2), 'https://v3-cinemeta.strem.io/catalog/movie/top/skip=50.json');
  assert.throws(() => asianCatalogUrl('bad',1));
});

test('checks subtitle metadata and rejects incorrect country and untrusted tracks', () => {
  const movies = [{id:'tt0012345',type:'movie',name:'Japan',country:'Japan'}, {id:'tt0012346',type:'movie',name:'China',country:'China, Japan'}, {id:'tt0012347',type:'movie',name:'Taiwan',country:'Taiwan'}];
  assert.equal(asianCatalogResults('japanese', {metas:movies}).length, 1);
  assert.equal(asianCatalogResults('chinese', {metas:movies}).length, 2);
  assert.equal(hasEnglishSubtitle({subtitles:[{lang:'eng',url:'https://api.thesubtitledb.org/integrations/stremio/s/123.vtt'}]}), true);
  assert.equal(hasEnglishSubtitle({subtitles:[{lang:'eng',url:'https://evil.example/1.vtt'}]}), false);
  assert.equal(hasEnglishSubtitle({subtitles:[{lang:'ara',url:'https://api.thesubtitledb.org/integrations/stremio/s/1.vtt'}]}), false);
});

test('finds subtitles using the precise series episode, not the movie track', async () => {
  const urls = [];
  const text = 'WEBVTT\n\n' + Array.from({length: 12}, (_,i) => `00:00:${String(i).padStart(2,'0')}.000 --> 00:00:${String(i+1).padStart(2,'0')}.000\nLine\n\n`).join('');
  await findMovieSubtitles('tt10850932', {episode:{season:1,episode:4}, json:async url => {urls.push(url);return {subtitles:[{lang:'eng',url:'https://api.thesubtitledb.org/integrations/stremio/s/1.vtt'}]}},text:async()=>text});
  assert.match(urls[0], /series\/tt10850932%3A1%3A4/);
  await assert.rejects(findMovieSubtitles('tt10850932', {episode:{season:-1,episode:4},json(){},text(){}}));
});

test('Korean movies and drama search are distinct and validate their inputs', () => {
  const metas = [{id:'tt6751668',type:'movie',name:'Parasite',country:'South Korea'}, {id:'tt1234567',type:'movie',name:'US coproduction',country:'United States, South Korea'}, {id:'tt10850932',type:'series',name:'Crash Landing on You',country:'South Korea',genres:['Drama'],moviedb_id:94796}];
  const [film] = asianCatalogResults('koreanMovie', {metas});
  assert.equal(film.title, 'Parasite');
  assert.equal(film.mediaKind, 'movie');
  assert.equal(subtitleIndexUrl(film), 'https://api.thesubtitledb.org/integrations/stremio/subtitles/movie/tt6751668.json');
  assert.equal(asianCatalogResults('korean', {metas}).length, 1);
  assert.match(asianMetadataUrl('koreanMovie','tt6751668'), /meta\/movie\/tt6751668\.json$/);
  assert.throws(() => asianMetadataUrl('koreanMovie','../../bad'));
  assert.equal(koreanDramaSearchUrl('Crash Landing'), 'https://v3-cinemeta.strem.io/catalog/series/top/search=Crash%20Landing.json');
  assert.throws(() => koreanDramaSearchUrl('   '));
});
