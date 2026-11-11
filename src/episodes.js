// Cinemeta metadata describes episode numbers, not playback availability.
export function episodeGroups(data, imdbId, now = Date.now()) {
  if (!/^tt\d{5,12}$/.test(imdbId || '') || data?.meta?.id !== imdbId || !Array.isArray(data.meta.videos)) return [];
  const seasons = new Map();
  for (const item of data.meta.videos.slice(0, 10000)) {
    const season = Number(item?.season), episode = Number(item?.episode);
    if (!Number.isInteger(season) || season < 1 || season > 999 || !Number.isInteger(episode) || episode < 1 || episode > 9999) continue;
    const date = item.released ? Date.parse(item.released) : NaN;
    if (Number.isFinite(date) && date > now) continue;
    const episodes = seasons.get(season) || new Set();
    episodes.add(episode); seasons.set(season, episodes);
  }
  return [...seasons].sort(([a], [b]) => a - b).map(([season, entries]) => ({season, episodes:[...entries].sort((a,b) => a-b)}));
}
