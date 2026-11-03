import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://v3-cinemeta.strem.io/**', route => {
      const url = route.request().url();
      if (url.includes('/meta/series/tt10850932.json')) { route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({meta:{id:'tt10850932',type:'series',name:'Korean drama',country:'South Korea',genres:['Drama'],moviedb_id:94796}})}); return; }
      const genre = /genre=([^&.]+)/.exec(url)?.[1] || 'Popular';
      const names = url.includes('search=') ? ['The Matrix'] : [`${genre} One`, `${genre} Two`];
      if (url.includes('/catalog/series/')) { route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({metas:[{id:'tt10850932',type:'series',name:'Korean drama',country:'South Korea',genres:['Drama'],moviedb_id:94796}]})}); return; }
      route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ metas: [...names.map((name, index) => ({ id: `tt${String(1000001 + index)}`, type: 'movie', name, releaseInfo: '2020' })),{id:'tt6751668',type:'movie',name:'Korean film',country:'South Korea'}, {id:'tt0012345',type:'movie',name:'Japanese film',country:'Japan'}, {id:'tt0012346',type:'movie',name:'Chinese film',country:'China'}] }) });
    });
    await page.route('https://api.thesubtitledb.org/**', route => route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({subtitles:[{lang:'eng',url:'https://api.thesubtitledb.org/integrations/stremio/s/123.vtt'}]})}));
    await page.route('https://images.metahub.space/**', route => route.abort());
    await page.goto('http://127.0.0.1:5173/');
    await page.locator('#shelf-action .catalog-card').first().waitFor();
    await page.locator('#asian').scrollIntoViewIfNeeded();
    await page.locator('#asian-koreanMovie').getByText('Korean film').waitFor();
    await page.locator('#asian-korean').getByText('Korean drama').waitFor();
    await page.locator('#asian-japanese').getByText('Japanese film').waitFor();
    await page.locator('#asian-chinese').getByText('Chinese film').waitFor();
    await page.locator('#asian-korean [data-play]').first().click();
    await page.locator('#player-modal iframe[src*="/tv/94796/1/1"]').waitFor();
    await page.locator('#episode-number').fill('2');
    await page.locator('[data-action=play-episode]').click();
    await page.locator('#player-modal iframe[src*="/tv/94796/1/2"]').waitFor();
    await page.locator('#player-modal [data-action=close-player]').click();
    if ((await page.locator('.catalog-filters button').count()) !== 20) throw Error('Missing genre filters');
    await page.locator('.catalog-filters [data-genre="Horror"]').click();
    await page.locator('#catalog-cards').getByText('Horror One').waitFor();
    if (await page.locator('.catalog-filters [data-genre="Horror"]').getAttribute('aria-pressed') !== 'true') throw Error('Genre selection did not update');
    await page.locator('#catalog-search').fill('Matrix');
    await page.locator('#catalog-cards').getByText('The Matrix').first().waitFor();
    await page.locator('#catalog-cards').getByText('Korean drama').first().waitFor();
    if (await page.locator('#library').count()) throw Error('The removed library section is still visible');
    await page.locator('.top-add[data-action="library"]').click();
    await page.locator('#modal [data-action="add"]').click();
    await page.locator('#add-form').waitFor();
    await page.locator('#add-form [name="title"]').fill('My saved movie');
    await page.locator('#add-form [name="url"]').fill('https://example.com/movie.mp4');
    await page.locator('#add-form button[type="submit"]').click();
    await page.locator('#modal .saved-title').getByText('My saved movie').waitFor();
    await page.locator('#modal [data-action="close"]').click();
    await page.locator('[data-play="cinebloom-155"]').first().click();
    await page.locator('#player-modal iframe').waitFor();
    await page.locator('#player-modal [data-action="close-player"]').click();
    if (errors.length) throw Error(errors.join('; '));
    console.log(`::notice title=UI smoke test::${viewport.width}px: shelves, genres, search, saved links and player passed`);
    await page.close();
  }
} catch (error) {
  console.log(`::error title=UI smoke test::${String(error.message).replace(/\n/g, ' | ').slice(0, 1500)}`);
  process.exitCode = 1;
} finally { await browser.close(); }
