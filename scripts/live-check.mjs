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
  await page.locator('#embedded-subtitle-file').setInputFiles({ name: 'test.srt', mimeType: 'text/plain', buffer: Buffer.from('1\n00:00:00,000 --> 00:01:00,000\nHello, how are you?\n') });
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
  const media = await frame.locator('video').evaluate(v => ({ paused: v.paused, currentTime: v.currentTime, duration: v.duration, readyState: v.readyState, networkState: v.networkState, error: v.error?.code || null }));
  if (media.currentTime < 1) throw new Error(`No meaningful playback progress: ${JSON.stringify(media)}`);
  console.log(`::notice title=Movie playback::Playback advanced to ${media.currentTime.toFixed(1)} seconds`);
  const events = await page.evaluate(() => window.__dimoEvents.filter(e => typeof e?.currentTime === 'number'));
  if (events.length) {
    console.log(`::notice title=Subtitle synchronization::Received ${events.length} verified player time events through ${events.at(-1).currentTime.toFixed(1)} seconds`);
    const text = await page.locator('#embedded-subtitle-text').innerText();
    if (text && /[\u0600-\u06ff]/.test(text)) console.log('::notice title=Sorani subtitle::Live Google translation displayed over the playing video');
    else console.log(`::warning title=Sorani subtitle::No translated overlay: ${await page.locator('#embedded-subtitle-status').innerText()}`);
  }
  else console.log('::warning title=Subtitle synchronization::No verified player time events received');
} catch (error) {
  console.log(`::warning title=Live movie check::${String(error.message).split('\n')[0]}`);
} finally {
  await browser.close();
}
