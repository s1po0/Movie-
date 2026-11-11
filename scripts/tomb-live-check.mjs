import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
try {
  await Promise.all([1, 2, 3].map(async season => {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    const responses = [];
    page.on('response', response => {
      try {
        const u = new URL(response.url());
        if (u.hostname === 'vidlink.pro' && u.pathname.startsWith('/api/')) {
          const path = u.pathname.split('/').slice(0, 5).map((p, i) => i === 4 && p.length > 20 ? '<token>' : p).join('/');
          responses.push({path, status:response.status()});
        }
      } catch { /* ignore unrelated URLs */ }
    });
    try {
      await page.goto(`https://vidlink.pro/tv/206343/${season}/1`, {waitUntil:'domcontentloaded',timeout:45000});
      await page.locator('video').waitFor({timeout:45000});
      await page.locator('video').evaluate(v=>v.play().catch(()=>{}));
      await page.waitForTimeout(18000);
      const state = await page.locator('video').evaluate(v=>({time:v.currentTime, duration:Number.isFinite(v.duration)?v.duration:0, error:v.error?.code || null, paused:v.paused}));
      const body = await page.locator('body').innerText();
      console.log(`::notice title=Tomb season ${season}::state ${JSON.stringify(state)}; English listed: ${/English/i.test(body)}; api ${JSON.stringify(responses).replace(/%/g,'%25')}`);
    } catch (error) { console.log(`::warning title=Tomb season ${season}::${String(error.message).split('\n')[0]}`); }
    finally { await page.close(); }
  }));
} finally { await browser.close(); }
