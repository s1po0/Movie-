import { DONGHUA_QUERY, donghuaVariables, donghuaCatalog, resolveDonghuaMapping, ANIME_MAPPING } from '../src/donghua-catalog.js';
try {
 const r=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:DONGHUA_QUERY,variables:donghuaVariables(1)}),signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('AniList HTTP '+r.status);const data=await r.json(),page=donghuaCatalog(data);
 if(page.movies.length<10||!page.hasMore)throw Error('Catalog did not return a full initial page');
 const mapping=await fetch(ANIME_MAPPING,{signal:AbortSignal.timeout(30000)});if(!mapping.ok)throw Error('mapping HTTP '+mapping.status);
 const entries=await mapping.json();const known=page.movies.map(x=>resolveDonghuaMapping(x,entries)).filter(Boolean);
 if(!known.length)throw Error('No unambiguous mapped titles found');
 console.log(`::notice title=Live CN catalog::First page ${page.movies.length} titles; ${known.length} unambiguous mappings; metadata only, playback and captions are not guaranteed.`);
} catch(e){console.log('::error title=Live CN catalog::'+e.message);process.exitCode=1}
