const run=async(name,url,options={})=>{try{const r=await fetch(url,{...options,signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0',...(options.headers||{})}});const text=await r.text();console.log(`::notice title=${name}::HTTP ${r.status} ${text.slice(0,800).replace(/\s+/g,' ')}`)}catch(e){console.log(`::notice title=${name}::${e.message}`)}};
await run('anilist','https://graphql.anilist.co',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'{ Page(page:1,perPage:2) { pageInfo {total hasNextPage} media(type:ANIME,countryOfOrigin:CN,sort:POPULARITY_DESC) { id title {romaji english} episodes format countryOfOrigin } } }'})});
await run('kitsu','https://kitsu.io/api/edge/anime?filter%5Btext%5D=tomb%20of%20fallen%20gods&page%5Blimit%5D=1');
await run('donghua','https://donghuastream.org/anime/list-mode/');
await run('anime','https://animexin.dev/anime/list-mode/');
