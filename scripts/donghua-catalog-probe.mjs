const query='query ($page: Int!) { Page(page:$page,perPage:50) { pageInfo {total hasNextPage currentPage} media(type:ANIME,countryOfOrigin:CN,sort:POPULARITY_DESC,isAdult:false) { id format title {english romaji native} episodes } } }';
try {
 const mappingRes=await fetch('https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json',{signal:AbortSignal.timeout(30000)});
 if(!mappingRes.ok)throw Error(`Mapping HTTP ${mappingRes.status}`);
 const entries=await mappingRes.json(), mapped=new Map(entries.filter(x=>x.anilist_id).map(x=>[x.anilist_id,x]));
 const result=[];let mappedCount=0;for(let page=1;page<=22;page++) {
   const r=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,variables:{page}}),signal:AbortSignal.timeout(30000)});
   if(!r.ok)throw Error(`AniList page ${page} HTTP ${r.status}`);const d=await r.json();
   if(d.errors?.length)throw Error(d.errors[0].message);const p=d.data.Page; result.push(...p.media);for(const x of p.media){const m=mapped.get(x.id);if(m?.themoviedb_id?.tv||m?.themoviedb_id?.movie?.length||m?.imdb_id?.length)mappedCount++}
   if(!p.pageInfo.hasNextPage)break;
 }
 console.log(`::notice title=CN catalog::${result.length} entries across ${Math.ceil(result.length/50)} pages, ${mappedCount} have a TMDB/IMDb mapping; metadata only, playback and captions unverified.`);
 console.log(`::notice title=Mapping example::${JSON.stringify(mapped.get(result[0].id)).slice(0,850)}`);
}catch(e){console.log(`::error title=CN catalog::${e.message}`);process.exitCode=1}
