import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://v3-cinemeta.strem.io/**', route => {
      const url = route.request().url();
      const genre = /genre=([^&.]+)/.exec(url)?.[1] || 'Popular';
      const names = url.includes('search=') ? ['The Matrix'] : [`${genre} One`, `${genre} Two`];
      route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ metas: names.map((name, index) => ({ id: `tt${String(1000001 + index)}`, type: 'movie', name, releaseInfo: '2020' })) }) });
    });
    await page.route('https://images.metahub.space/**', route => route.abort());
    await page.goto('http://127.0.0.1:5173/');
    await page.locator('#shelf-action .catalog-card').first().waitFor();
    if ((await page.locator('.catalog-filters button').count()) !== 20) throw Error('Missing genre filters');
    await page.locator('.catalog-filters [data-genre="Horror"]').click();
    await page.locator('#catalog-cards').getByText('Horror One').waitFor();
    if (await page.locator('.catalog-filters [data-genre="Horror"]').getAttribute('aria-pressed') !== 'true') throw Error('Genre selection did not update');
    await page.locator('#catalog-search').fill('Matrix');
    await page.locator('#catalog-cards').getByText('The Matrix').first().waitFor();
    await page.locator('[data-action="add"]').first().click();
    await page.locator('#add-form').waitFor();
    await page.locator('#modal [data-action="close"]').click();
    await page.locator('[data-play="cinebloom-155"]').first().click();
    await page.locator('#player-modal iframe').waitFor();
    await page.locator('#player-modal [data-action="close-player"]').click();
    if (errors.length) throw Error(errors.join('; '));
    console.log(`::notice title=UI smoke test::${viewport.width}px: shelves, genres, search, library dialog and player passed`);
    await page.close();
  }
} catch (error) {
  console.log(`::error title=UI smoke test::${String(error.message).replace(/\n/g, ' | ').slice(0, 1500)}`);
  process.exitCode = 1;
} finally { await browser.close(); }
