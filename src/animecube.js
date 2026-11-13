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
      player.pathname !== '/player/x1h6z6.html' || !id || !/^[a-zA-Z0-9]{1,100}$/.test(id)) throw new Error('Invalid player URL');
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
  const english = metadata?.subtitles?.data?.en?.urls;
  const subtitleUrl = Array.isArray(english)
    ? english.map(url => safeUrl(url, new Set(['static1.dmcdn.net', 'static2.dmcdn.net']))).find(Boolean) || null
    : null;
  return { streamUrl, subtitleUrl };
}
