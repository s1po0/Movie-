import { parseSubtitles } from './subtitles.js';

const sources = [
  { endpoint: id => `https://api.thesubtitledb.org/integrations/stremio/subtitles/movie/${id}.json`, host: 'api.thesubtitledb.org', path: /^\/integrations\/stremio\/s\/\d+\.vtt$/ },
  { endpoint: id => `https://opensubtitles-v3.strem.io/subtitles/movie/${id}.json`, host: 'subs5.strem.io', path: /^\/en\/download\/subencoding-stremio-utf8\/src-api\/file\/\d+$/ },
];

// Only download subtitles from the hosts and paths belonging to each service.
function trackUrl(value, source) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== source.host || url.port || url.username || url.password || !source.path.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}

export async function findMovieSubtitles(imdbId, { json, text, isCurrent = () => true }) {
  if (!/^tt\d{5,12}$/.test(imdbId || '')) throw new Error('Invalid movie identifier');
  for (const source of sources) {
    if (!isCurrent()) return null;
    try {
      const data = await json(source.endpoint(imdbId));
      if (!isCurrent()) return null;
      if (!Array.isArray(data?.subtitles)) continue;
      const candidates = data.subtitles.filter(track => /^(eng|en|ara|ar|spa|fre|fra|tur|per|fas)$/i.test(track?.lang || ''))
        .map(track => ({ ...track, safeUrl: trackUrl(track.url, source) })).filter(track => track.safeUrl)
        .sort((a, b) => (a.lang !== 'eng') - (b.lang !== 'eng') || /(?:cd|disc|part)[ ._-]*[12]\b/i.test(a.subtitleFileName || '') - /(?:cd|disc|part)[ ._-]*[12]\b/i.test(b.subtitleFileName || ''));
      for (const track of candidates.slice(0, 5)) {
        if (!isCurrent()) return null;
        try {
          const body = await text(track.safeUrl);
          if (!isCurrent()) return null;
          if (typeof body !== 'string' || body.length > 2_000_000 || parseSubtitles(body).length < 10) continue;
          return body;
        } catch { /* try another subtitle */ }
      }
    } catch { /* try the next service */ }
  }
  throw new Error('No subtitle source available');
}
