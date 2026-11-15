// LMAnime episode numbers belong to the chosen LMAnime series, not AniList.
// Always show the provider's own results and episode list for explicit selection.
const BASE = 'https://lmanime.com';
function siteUrl(value, base = BASE) {
  try {
    const u = new URL(value, base);
    if (u.protocol !== 'https:' || u.hostname !== 'lmanime.com' || u.port || u.username || u.password || u.hash) return null;
    return u;
  } catch { return null; }
}
function page(html, Parser = globalThis.DOMParser) {
  if (typeof html !== 'string' || html.length > 2_000_000 || typeof Parser !== 'function') throw new Error('Invalid source page');
  return new Parser().parseFromString(html, 'text/html');
}
export function lmSearchUrl(query) {
  const q = String(query || '').trim().slice(0, 100);
  if (q.length < 2) throw new Error('Search requires at least two characters');
  const u = new URL(BASE); u.searchParams.set('s', q); return u.href;
}
export function lmSearchResults(html, Parser) {
  const seen = new Set(); const results = [];
  for (const a of page(html, Parser).querySelectorAll('.bsx > a')) {
    const u = siteUrl(a.getAttribute('href')); const title = (a.getAttribute('title') || a.querySelector('h2')?.textContent || '').trim();
    if (!u || u.search || !/^\/[a-z0-9][a-z0-9-]*\/$/i.test(u.pathname) || /-episode-\d+/i.test(u.pathname) || !title || seen.has(u.href)) continue;
    seen.add(u.href); results.push({title:title.slice(0, 200), url:u.href}); if (results.length >= 30) break;
  }
  return results;
}
export function lmEpisodes(html, seriesUrl, Parser) {
  if (!siteUrl(seriesUrl)) throw new Error('Invalid series');
  const seen = new Set(); const episodes = [];
  for (const a of page(html, Parser).querySelectorAll('.eplister a, .episodelist a, #chapterlist a')) {
    const u = siteUrl(a.getAttribute('href'), seriesUrl), n = a.querySelector('.epl-num')?.textContent?.trim();
    const title = (a.querySelector('.epl-title')?.textContent || a.textContent || '').trim();
    if (!u || u.search || !/\/[^/]*episode-\d+[a-z0-9-]*\/?$/i.test(u.pathname) || !/^\d{1,4}$/.test(n || '') || !title || seen.has(u.href)) continue;
    seen.add(u.href); episodes.push({number:Number(n), title:title.slice(0, 200), url:u.href});
  }
  return episodes.sort((a,b) => a.number-b.number);
}
export function lmMirrors(html, episodeUrl, Parser) {
  const ep = siteUrl(episodeUrl); if (!ep || ep.search) throw new Error('Invalid episode');
  const doc = page(html, Parser); const results = []; const seen = new Set();
  for (const opt of doc.querySelectorAll('select option')) {
    if (!/\benglish\b/i.test(opt.textContent || '')) continue;
    const u = siteUrl(opt.getAttribute('value'), ep.href);
    if (!u || u.search || !u.pathname.startsWith(ep.pathname.replace(/\/$/, '') + '/v/') || !/\/v\/\d+\/$/.test(u.pathname) || seen.has(u.href)) continue;
    seen.add(u.href); results.push(u.href); if (results.length >= 8) break;
  }
  return results;
}
export function lmOkEmbed(html, Parser) {
  for (const el of page(html, Parser).querySelectorAll('iframe')) {
    for (const attr of ['src','data-src','data-litespeed-src']) try {
      const u = new URL(el.getAttribute(attr), 'https://lmanime.com/');
      if (u.protocol === 'https:' && u.hostname === 'ok.ru' && !u.port && !u.username && !u.password && /^\/videoembed\/\d+$/.test(u.pathname)) return `https://ok.ru${u.pathname}`;
    } catch { /* no trusted iframe */ }
  }
  return null;
}
export function okVideo(html, Parser) {
  for (const el of page(html, Parser).querySelectorAll('[data-options]')) {
    try {
      const options = JSON.parse(el.getAttribute('data-options')); let data = options?.flashvars?.metadata;
      if (typeof data === 'string') data = JSON.parse(data);
      if (!data || data.error) continue;
      // Select a real progressive MP4. URLs expire: resolve them anew every time.
      for (const video of data.videos || []) {
        if (video.disallowed || typeof video.url !== 'string') continue;
        const u = new URL(video.url);
        if (u.protocol !== 'https:' || !/^vd\d+\.okcdn\.ru$/i.test(u.hostname) || u.port || u.username || u.password) continue;
        return {url:u.href, sourceTitle:String(data.movie?.title || '').slice(0,200)};
      }
    } catch { /* Ignore unrelated widgets / invalid URLs. */ }
  }
  throw new Error('No direct OK.ru video');
}
export async function lmResolveEpisode(episodeUrl, getText, Parser) {
  if (typeof getText !== 'function') throw new TypeError('A text requester is required');
  const ep = siteUrl(episodeUrl); if (!ep || ep.search || !/\/[^/]*episode-\d+[a-z0-9-]*\/?$/i.test(ep.pathname)) throw new Error('Invalid episode');
  const original = await getText(ep.href); const mirrors = lmMirrors(original, ep.href, Parser);
  // Prefer the site's English mirrors, never silently substitute another episode.
  for (const mirror of mirrors) {
    try {
      const mirrorHtml = await getText(mirror); const embed = lmOkEmbed(mirrorHtml, Parser);
      if (!embed) continue;
      return okVideo(await getText(embed), Parser);
    } catch { /* Try another server for the same episode. */ }
  }
  throw new Error('No supported direct source for this episode');
}
