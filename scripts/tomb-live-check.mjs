import { chromium } from 'playwright-core';
import nacl from 'tweetnacl';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
try {
  await Promise.all([1, 2, 3].map(async season => {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    const responses = []; const pending = [];
    page.on('response', response => {
      try {
        const u = new URL(response.url());
        if (u.hostname === 'vidlink.pro' && u.pathname.startsWith('/api/')) {
          const path = u.pathname.split('/').slice(0, 5).map((p, i) => i === 4 && p.length > 20 ? '<token>' : p).join('/');
          const info = {path, status:response.status()}; responses.push(info);
          if (u.pathname.startsWith('/api/b/tv/')) pending.push((async () => {
            const segments = u.pathname.split('/');
            info.segmentShape = segments.slice(4).map(p => /^\d{1,4}$/.test(p) ? p : `len${p.length}`);
            try {
              const raw = Uint8Array.from(Buffer.from(segments[4], 'base64url'));
              const key = Uint8Array.from('c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd'.match(/../g), x=>parseInt(x,16));
              const plain = nacl.secretbox.open(raw.subarray(24), raw.subarray(0,24), key);
              if (plain) info.tokenPayload = Buffer.from(plain.subarray(0,plain.length-8)).toString('utf8');
            } catch { info.tokenPayload = 'unavailable'; }
            try { const data = await response.json(); info.captionInfo = (data?.stream?.captions || []).map(c => ({language:c.language,type:c.type,host:(()=>{try{return new URL(c.url).hostname}catch{return ''}})()})).slice(0,20); } catch { info.captionInfo = 'unavailable'; }
          })().catch(() => { info.captionInfo = 'parse-error'; }));
        }
      } catch { /* ignore unrelated URLs */ }
    });
    try {
      await page.goto(`https://vidlink.pro/tv/206343/${season}/1`, {waitUntil:'domcontentloaded',timeout:45000});
      await page.locator('video').waitFor({timeout:45000});
      await page.locator('video').evaluate(v=>v.play().catch(()=>{}));
      await page.waitForTimeout(18000);
      const state = await page.locator('video').evaluate(v=>({time:v.currentTime, duration:Number.isFinite(v.duration)?v.duration:0, error:v.error?.code || null, paused:v.paused}));
      await Promise.allSettled(pending);
      const body = await page.locator('body').innerText();
      console.log(`::notice title=Tomb season ${season}::state ${JSON.stringify(state)}; English listed: ${/English/i.test(body)}; api ${JSON.stringify(responses).replace(/%/g,'%25')}`);
    } catch (error) { console.log(`::warning title=Tomb season ${season}::${String(error.message).split('\n')[0]}`); }
    finally { await page.close(); }
  }));
} finally { await browser.close(); }
// Independently exercise the same short-lived TV API URL used by Android's
// subtitle lookup. Do not log transient media/caption URLs or tokens.
try {
  const { seriesSourceUrl, movieSources } = await import('../src/vidlink.js');
  const { parseSubtitles } = await import('../src/subtitles.js');
  await Promise.all([1,2,3].map(async season => {
    const headers = {'User-Agent':'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', Referer:`https://vidlink.pro/tv/206343/${season}/1`, Origin:'https://vidlink.pro', Accept:'*/*'};
    const response = await fetch(seriesSourceUrl('206343', season, 1), {headers,signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw Error(`season ${season}: source HTTP ${response.status}`);
    const data = await response.json();
    const caption = movieSources(data).subtitles.find(item => /english|\beng?\b/i.test(item.label));
    if (!caption || new URL(caption.url).hostname !== 'cacdn.hakunaymatata.com') throw Error(`season ${season}: no English caption`);
    const track = await fetch(caption.url, {headers,signal:AbortSignal.timeout(30000)});
    if (!track.ok) throw Error(`season ${season}: caption HTTP ${track.status}`);
    const count = parseSubtitles(await track.text()).length;
    if (count < 10) throw Error(`season ${season}: caption too short`);
    console.log(`::notice title=Android episode lookup::Season ${season}, episode 1: ${count} English subtitle cues available`);
  }));
} catch(error) { console.log(`::error title=Android episode lookup::${String(error.message).split('\n')[0]}`); process.exitCode=1; }
