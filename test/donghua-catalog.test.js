import test from 'node:test';
import assert from 'node:assert/strict';
import { donghuaVariables, donghuaCatalog, resolveDonghuaMapping } from '../src/donghua-catalog.js';
const media=(id,opts={})=>({id,format:'ONA',countryOfOrigin:'CN',isAdult:false,title:{english:`Show ${id}`},coverImage:{large:'https://s4.anilist.co/file/poster.jpg'},...opts});
const result=media=>({data:{Page:{pageInfo:{hasNextPage:true},media}}});
test('constructs bounded paginated Chinese animation, movie, series and search filters',()=>{
 assert.deepEqual(donghuaVariables(2,'  abc  ','movie'),{page:2,search:'abc',format:['MOVIE']});
 assert.equal(donghuaVariables(1).format,null); assert.throws(()=>donghuaVariables(0));assert.throws(()=>donghuaVariables(1,'','invalid'));
});
test('uses only actual nonadult Chinese metadata and deduplicates, preserving next-page signal',()=>{
 const r=donghuaCatalog(result([media(1),media(1),media(2,{countryOfOrigin:'JP'}),media(3,{isAdult:true}),media(4,{format:'MOVIE'})]));
 assert.deepEqual(r.movies.map(x=>x.id),['donghua-1','donghua-4']);assert.equal(r.hasMore,true);assert.equal(r.movies[1].type,'فیلمی دونگھوا');
});
test('resolves exactly identified seasons and movies; refuses wrong or ambiguous mappings',()=>{
 const a=donghuaCatalog(result([media(1),media(2,{format:'MOVIE'})])).movies;
 assert.equal(resolveDonghuaMapping(a[0],[{anilist_id:1,imdb_id:['tt1234567'],themoviedb_id:{tv:123},season:{tmdb:3}}]).season,3);
 assert.equal(resolveDonghuaMapping(a[0],[{anilist_id:1,themoviedb_id:{tv:123},season:{tmdb:3},episode_offset:{tmdb:1}}]),null);
 assert.equal(resolveDonghuaMapping(a[0],[{anilist_id:1,themoviedb_id:{tv:123}}]),null);
 assert.equal(resolveDonghuaMapping(a[1],[{anilist_id:2,themoviedb_id:{movie:[123]},imdb_id:['tt1234567']}]).tmdbId,'123');
 assert.equal(resolveDonghuaMapping(a[1],[{anilist_id:2,themoviedb_id:{movie:[123,456]}}]),null);
 assert.equal(resolveDonghuaMapping(a[1],[{anilist_id:2},{anilist_id:2}]),null);
});
