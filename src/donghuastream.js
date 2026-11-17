// This discovers only DonghuaStream's public Dailymotion player for the requested episode.
// The episode page is not itself a downloadable media file.
const BASE = 'https://donghuastream.org';
export function donghuaEpisodeUrl(episode) {
  if (!Number.isInteger(episode) || episode < 1 || episode > 52) throw new Error('Invalid season 3 episode');
  return `${BASE}/tomb-of-fallen-gods-season-3-episode-${episode}-multiple-subtitles/`;
}
export function donghuaDailymotionPlayer(html) {
  if (typeof html !== 'string' || html.length > 2_000_000) throw new Error('Invalid episode page');
  // Extract only an iframe from the page, then validate all parts before requesting it.
  for (const tag of html.match(/<iframe\b[^>]*>/gi) || []) {
    const attrs = tag.match(/(?:data-litespeed-src|src)\s*=\s*["']([^"']+)["']/gi) || [];
    for (const attr of attrs) {
      const value = attr.match(/=\s*["']([^"']+)["']/)?.[1]?.replace(/&amp;/g, '&');
      try {
        const u = new URL(value);
        if (u.protocol !== 'https:' || u.hostname !== 'geo.dailymotion.com' || u.port || u.username || u.password ||
            !/^\/player\/x[0-9a-z]+\.html$/.test(u.pathname) || !/^[a-zA-Z0-9]{1,100}$/.test(u.searchParams.get('video') || '')) continue;
        const clean = new URL('https://geo.dailymotion.com/player/x19jsm.html');
        clean.searchParams.set('video', u.searchParams.get('video'));
        return clean.href;
      } catch { /* not a trusted player */ }
    }
  }
  throw new Error('No supported Dailymotion player');
}
export async function donghuaEpisodeSource(episode, getText) {
  if (typeof getText !== 'function') throw new TypeError('A text requester is required');
  const html = await getText(donghuaEpisodeUrl(episode));
  return { episode, playerUrl: donghuaDailymotionPlayer(html) };
}
