import nacl from 'tweetnacl';

// The player uses a short-lived token, so resolve a new source when a film is opened.
const PLAYER_KEY = Uint8Array.from('c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd'.match(/../g), value => parseInt(value, 16));
const safeUrl = value => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
};

export { movieEmbedUrl } from './vidlink-embed.js';

export function movieSourceUrl(id, now = Date.now()) {
  const text = String(id);
  if (!/^\d{1,12}$/.test(text) || !Number.isFinite(now) || now < 0) throw new Error('Invalid movie identifier');
  const idBytes = new TextEncoder().encode(text);
  const message = new Uint8Array(idBytes.length + 8);
  message.set(idBytes);
  new DataView(message.buffer).setBigUint64(idBytes.length, BigInt(Math.floor(now / 1000) + 480));
  const nonce = new Uint8Array(24);
  const cipher = nacl.secretbox(message, nonce, PLAYER_KEY);
  const bytes = new Uint8Array(nonce.length + cipher.length);
  bytes.set(nonce); bytes.set(cipher, nonce.length);
  const token = btoa(Array.from(bytes, value => String.fromCharCode(value)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `https://vidlink.pro/api/b/movie/${token}?multiLang=1`;
}

// The TV API uses the same short-lived identifier token and appends the
// validated season and episode to its path.
export function seriesSourceUrl(id, season, episode, now = Date.now()) {
  if (!Number.isInteger(season) || season < 1 || season > 999 || !Number.isInteger(episode) || episode < 1 || episode > 9999) throw new Error('Invalid episode identifier');
  const url = new URL(movieSourceUrl(id, now));
  url.pathname = url.pathname.replace('/api/b/movie/', '/api/b/tv/') + `/${season}/${episode}`;
  return url.href;
}

export function movieSources(response) {
  const stream = response?.stream;
  if (!stream || typeof stream !== 'object') throw new Error('Movie source unavailable');
  const options = Object.entries(stream.qualities || {}).map(([quality, entry]) => ({ quality: Number(quality), url: safeUrl(entry?.url), type: entry?.type, codec: entry?.codecName, requiresProxy: Boolean(entry?.requiresProxy) }))
    .filter(entry => entry.url && /^(mp4|hls)$/i.test(entry.type || '') && Number.isFinite(entry.quality));
  // Prefer 720p or below to limit data usage, but retain higher-quality sources if necessary.
  options.sort((a, b) => (a.quality <= 720 ? 0 : 1) - (b.quality <= 720 ? 0 : 1) || (a.quality <= 720 ? b.quality - a.quality : a.quality - b.quality));
  const playlist = safeUrl(stream.playlist);
  const selected = playlist ? { url: playlist, type: 'hls', requiresProxy: false } : options[0];
  const subtitles = (Array.isArray(stream.captions) ? stream.captions : []).slice(0, 100)
    .map(caption => ({ label: typeof caption.language === 'string' ? caption.language.slice(0, 80) : '', url: safeUrl(caption.url), type: caption.type }))
    .filter(caption => caption.label && caption.url && /^(srt|vtt)$/i.test(caption.type || ''))
    .map(({ label, url }) => ({ label, url }));
  return { source: selected || null, subtitles };
}
