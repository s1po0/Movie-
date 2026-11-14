// AnimeCube is an external source whose availability and response format may change.
// This resolver only discovers an episode's player; it does not download the video.
const BASE = 'https://animecube.live';
const SLUG = 'tomb-of-fallen-gods';
const PRIMARY = 'primary-1';
const SEASON = 'tab-1754560267416';

export async function animeCubeTombSeason3Source(episode, getJson) {
  if (!Number.isInteger(episode) || episode < 1 || episode > 52) throw new Error('Invalid season 3 episode');
  if (typeof getJson !== 'function') throw new TypeError('A JSON requester is required');

  const registry = await getJson(`${BASE}/api/anime-sources-versions`);
  const version = registry?.bySeason?.[SLUG]?.[PRIMARY]?.[SEASON];
  if (typeof version !== 'string' || !/^[\w-]{1,100}$/.test(version)) throw new Error('Season source version unavailable');

  const episodeId = `${SLUG}-${SEASON}-ep-${episode}`;
  const url = new URL(`${BASE}/api/anime/${SLUG}/episode/${episodeId}/sources`);
  url.searchParams.set('v', version);
  url.searchParams.set('primaryTabId', PRIMARY);
  url.searchParams.set('seasonId', SEASON);
  const response = await getJson(url.href);
  if (response?.success !== true || !Array.isArray(response.sources)) throw new Error('Episode sources unavailable');
  const source = response.sources.find(item => item?.platform === 'dailymotion' && typeof item.privateId === 'string' && /^[a-zA-Z0-9]{1,100}$/.test(item.privateId));
  if (!source) throw new Error('No supported episode player');
  const player = new URL('https://geo.dailymotion.com/player/x1h6z6.html');
  player.searchParams.set('video', source.privateId);
  return { playerUrl: player.href, episode };
}

// Look up fresh, short-lived stream and subtitle URLs, without logging or persisting them.
// This is discovery only: it cannot establish that a video is downloadable or playable.
export async function dailymotionMedia(playerUrl, getJson) {
  let player;
  try { player = new URL(playerUrl); } catch { throw new Error('Invalid player URL'); }
  const id = player.searchParams.get('video');
  if (player.protocol !== 'https:' || player.hostname !== 'geo.dailymotion.com' || player.port || player.username || player.password ||
      !/^\/player\/x[0-9a-z]+\.html$/.test(player.pathname) || !id || !/^[a-zA-Z0-9]{1,100}$/.test(id)) throw new Error('Invalid player URL');
  if (typeof getJson !== 'function') throw new TypeError('A JSON requester is required');
  const metadata = await getJson(`https://www.dailymotion.com/player/metadata/video/${id}`);
  if (metadata?.error || metadata?.protected_delivery !== false) throw new Error('Protected or unavailable video');
  const streams = metadata?.qualities?.auto;
  if (!Array.isArray(streams)) throw new Error('HLS stream unavailable');
  const safeUrl = (value, allowed) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && !url.port && allowed.has(url.hostname) ? url.href : null;
    } catch { return null; }
  };
  const manifestHosts = new Set(['cdndirector.dailymotion.com']);
  const streamUrl = streams.filter(item => /^application\/(x-mpegurl|vnd\.apple\.mpegurl)$/i.test(item?.type || ''))
    .map(item => safeUrl(item.url, manifestHosts)).find(Boolean);
  if (!streamUrl) throw new Error('HLS stream unavailable');
  // Prefer human English, then Arabic, then auto-generated English. They are
  // translated from this exact video, so subtitle timing isn't borrowed from a different cut.
  const tracks = metadata?.subtitles?.data || {};
  let subtitleUrl = null, subtitleLanguage = null;
  const otherLanguages = Object.keys(tracks).filter(lang => /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?(?:-auto)?$/.test(lang) && !['en', 'ar', 'en-auto'].includes(lang));
  otherLanguages.sort((a, b) => Number(a.endsWith('-auto')) - Number(b.endsWith('-auto')));
  for (const lang of ['en', 'ar', 'en-auto', ...otherLanguages]) {
    const urls = tracks[lang]?.urls;
    const url = Array.isArray(urls) && urls.map(value => safeUrl(value, new Set(['static1.dmcdn.net', 'static2.dmcdn.net']))).find(Boolean);
    if (url) { subtitleUrl = url; subtitleLanguage = lang; break; }
  }
  // These are the qualities advertised for this video, not a guarantee that
  // the CDN or the device will be able to play/download each variant.
  const qualityLevels = Object.keys(metadata?.stream_formats || {}).map(Number)
    .filter(value => [380, 480, 720, 1080, 1440, 2160].includes(value)).sort((a,b) => a-b);
  return { streamUrl, subtitleUrl, subtitleLanguage, qualityLevels };
}

// Read actual HLS variants instead of treating metadata encoding labels as availability.
export function manifestQualityLevels(text) {
  if (typeof text !== 'string' || !/^#EXTM3U(?:\r?\n|$)/.test(text)) return [];
  const heights = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;
    const resolution = line.match(/(?:\:|,)RESOLUTION=(\d+)x(\d+)(?:,|$)/i);
    const height = Number(resolution?.[2]);
    if (height > 0 && height <= 4320) heights.push(height);
  }
  return [...new Set(heights)].sort((a, b) => a - b);
}
