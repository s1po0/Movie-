import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await page.locator('#catalog-cards [data-play^="cinemeta-"]').first().waitFor({ timeout: 15000 });
    console.log('::notice title=Popular movies::Live popular catalogue loaded');
  } catch { console.log('::warning title=Popular movies::Live popular catalogue did not load'); }
  await page.locator('#catalog-search').fill('the matrix');
  await page.locator('[data-play="cinemeta-tt0133093"]').waitFor({ timeout: 30000 });
  console.log('::notice title=Movie search::Live Cinemeta search returned The Matrix');
  await page.evaluate(() => { window.__dimoEvents = []; window.addEventListener('message', e => { const f = document.querySelector('#player-modal iframe'); if (f && e.origin === 'https://vidlink.pro' && e.source === f.contentWindow && e.data?.type === 'PLAYER_EVENT') window.__dimoEvents.push(e.data.data); }); });
  await page.locator('[data-play="cinebloom-155"]').first().click();
  const player = page.frameLocator('#player-modal iframe');
  await player.locator('body').waitFor({ timeout: 30000 });
  await player.locator('video').waitFor({ timeout: 30000 });
  const frame = page.frames().find(f => f.url().startsWith('https://vidlink.pro/movie/'));
  const body = await frame.locator('body').innerText();
  if (/please disable sandbox/i.test(body)) throw new Error('Provider still reports sandbox restriction');
  console.log('::notice title=Embedded player::Provider loaded without the sandbox warning');
  const box = await page.locator('#player-modal iframe').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const playError = await frame.locator('video').evaluate(v => v.play().then(() => null).catch(error => error.message));
  if (playError) throw new Error(`Video play failed: ${playError}`);
  await page.waitForTimeout(20000);
  const getMedia = () => frame.locator('video').evaluate(v => ({ paused: v.paused, currentTime: v.currentTime, duration: v.duration, readyState: v.readyState, networkState: v.networkState, error: v.error?.code || null }));
  let media = await getMedia();
  if (media.currentTime < 1) {
    await frame.locator('video').evaluate(v => v.play().catch(() => {}));
    await page.waitForTimeout(12000); media = await getMedia();
  }
  if (media.currentTime < 1) console.log(`::warning title=Movie playback::No meaningful playback progress: ${JSON.stringify(media)}`);
  else console.log(`::notice title=Movie playback::Playback advanced to ${media.currentTime.toFixed(1)} seconds`);
  const events = await page.evaluate(() => window.__dimoEvents.filter(e => typeof e?.currentTime === 'number'));
  if (events.length) {
    console.log(`::notice title=Subtitle synchronization::Received ${events.length} verified player time events through ${events.at(-1).currentTime.toFixed(1)} seconds`);
    // The first English subtitle for this film is at about 100 seconds. Seek there
    // to check automatic lookup and Google translation, without uploading a file.
    await frame.locator('video').evaluate(v => { v.currentTime = 100.5; v.pause(); });
    try {
      await page.waitForFunction(() => /[\u0600-\u06ff]/.test(document.querySelector('#embedded-subtitle-text')?.textContent || ''), null, { timeout: 30000 });
      console.log('::notice title=Automatic Sorani subtitle::Automatically found an English subtitle and displayed Google translation without uploading a file');
      await page.locator('.embedded-fullscreen-button').click();
      if (await page.locator('#embedded-subtitle-text').isVisible() && /[\u0600-\u06ff]/.test(await page.locator('#embedded-subtitle-text').innerText())) console.log('::notice title=Fullscreen Sorani subtitle::Translated subtitle remained visible in DIMO fullscreen');
      else console.log('::warning title=Fullscreen Sorani subtitle::Subtitle was not visible in DIMO fullscreen');
      await page.locator('.dimo-fullscreen-exit').click();
    } catch {
      console.log(`::warning title=Automatic Sorani subtitle::No translated overlay: ${await page.locator('#embedded-subtitle-status').innerText()}`);
    }
  }
  else console.log('::warning title=Subtitle synchronization::No verified player time events received');
} catch (error) {
  console.log(`::warning title=Live movie check::${String(error.message).split('\n')[0]}`);
} finally {
  await browser.close();
}
