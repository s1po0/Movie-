import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const headers={'access-control-allow-origin':'*','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type'};
 await page.route('https://graphql.anilist.co/**',async route=>{
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
   const {variables}=route.request().postDataJSON();const n=variables.page;const media=(id,title,format='ONA')=>({id,format,title:{english:title},isAdult:false,countryOfOrigin:'CN',coverImage:{},episodes:12,startDate:{year:2020}});
   const entries=variables.search ? [media(4,'Found Movie','MOVIE')] : n===1?[media(1,'First'),media(2,'Unmapped')]:[media(3,'Next')];
   await route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({data:{Page:{pageInfo:{hasNextPage:n===1},media:entries}}})});
 });
 await page.route('https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json',r=>r.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify([{anilist_id:1,themoviedb_id:{tv:1234},season:{tmdb:2}},{anilist_id:4,themoviedb_id:{movie:[45]}}])}));
 await page.goto('http://127.0.0.1:5173/');await page.locator('#donghua-cards').getByText('First').waitFor();
 await page.locator('#donghua-more').click();await page.locator('#donghua-cards').getByText('Next').waitFor();
 await page.locator('#donghua-cards').getByText('Unmapped').click();await page.locator('#donghua-resolve').getByText('ناسنامەی دڵنیای پەخش').waitFor();
 await page.locator('#modal [data-action=close]').click();await page.locator('#donghua-cards').getByText('First').click();
 await page.locator('#player-modal iframe[src*="/tv/1234/2/1"]').waitFor();await page.locator('#player-modal [data-action=close-player]').click();
 await page.locator('#donghua-kind').selectOption('movie');await page.locator('#donghua-search').fill('Found');await page.locator('#donghua-cards').getByText('Found Movie').waitFor();
 await page.locator('#donghua-cards').getByText('Found Movie').click();await page.locator('#player-modal iframe[src*="/movie/45"]').waitFor();
 if(errors.length)throw Error(errors.join('; '));
 console.log('::notice title=Donghua UI::Pagination, search, filtering, mapped series and movie, and unmapped fallback verified.');
} catch(e) {console.log('::error title=Donghua UI::'+String(e.message).replace(/\n/g,' | ').slice(0,1000));process.exitCode=1} finally{await browser.close()}
