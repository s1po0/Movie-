// Only identifiers are accepted; the embedded player remains on its own origin.
export function movieEmbedUrl(id) {
  const text = String(id);
  if (!/^(?:\d{1,12}|tt\d{5,12})$/.test(text)) throw new Error('Invalid movie identifier');
  return `https://vidlink.pro/movie/${text}`;
}

export function seriesEmbedUrl(id, season = 1, episode = 1) {
  const text = String(id);
  if (!/^\d{1,12}$/.test(text) || !Number.isInteger(season) || season < 1 || season > 999 || !Number.isInteger(episode) || episode < 1 || episode > 9999) throw new Error('Invalid episode identifier');
  return `https://vidlink.pro/tv/${text}/${season}/${episode}`;
}
