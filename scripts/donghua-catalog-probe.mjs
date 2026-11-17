import { DONGHUA_QUERY, donghuaVariables } from '../src/donghua-catalog.js';
const simple='query ($page: Int!) { Page(page:$page,perPage:50) { pageInfo {hasNextPage} media(type:ANIME,countryOfOrigin:CN,sort:POPULARITY_DESC,isAdult:false) { id format countryOfOrigin isAdult episodes title {english romaji native} startDate {year} coverImage {large medium} } } }';
for (const [name,query,variables] of [['full',DONGHUA_QUERY,donghuaVariables(1)],['simple',simple,{page:1}],['movie',DONGHUA_QUERY,donghuaVariables(1,'','movie')]])try{
 const r=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(30000)});const body=await r.text();console.log(`::notice title=${name}::HTTP ${r.status}; ${body.slice(0,450).replace(/\s+/g,' ')}`);
}catch(e){console.log(`::notice title=${name}::${e.message}`)}
