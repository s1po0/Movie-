// Cinemeta's country metadata provides discovery, not a guarantee of playback.
const countries = {
  korean: { type: 'series', accepted: ['south korea', 'republic of korea'], label: 'درامای کۆری' },
  japanese: { type: 'movie', accepted: ['japan'], label: 'فیلمی ژاپۆنی' },
  chinese: { type: 'movie', accepted: ['china', 'hong kong', 'taiwan'], label: 'فیلمی چینی' },
};
export const asianRegions = Object.keys(countries);
export function asianCatalogUrl(region, page) {
  const config = countries[region];
  if (!config || !Number.isInteger(page) || page < 1 || page > 10000) throw new Error('Invalid Asian catalog request');
  return `https://v3-cinemeta.strem.io/catalog/${config.type}/top${page > 1 ? `/skip=${(page - 1) * 50}` : ''}.json`;
}
export function asianCatalogResults(region, data) {
  const config = countries[region];
  if (!config || !Array.isArray(data?.metas)) throw new Error('Invalid Asian catalog response');
  const seen = new Set();
  return data.metas.flatMap(item => {
    const parts = typeof item?.country === 'string' ? item.country.toLowerCase().split(',').map(s => s.trim()) : [];
    const genres = Array.isArray(item?.genres) ? item.genres : Array.isArray(item?.genre) ? item.genre : [];
    const id = item?.id;
    if (item?.type !== config.type || !parts.some(country => config.accepted.includes(country)) ||
        (config.type === 'series' && !genres.includes('Drama')) ||
        !/^tt\d{5,12}$/.test(id || '') || typeof item.name !== 'string' || !item.name.trim() || seen.has(id)) return [];
    if (config.type === 'series' && !/^\d{1,12}$/.test(String(item.moviedb_id || ''))) return [];
    seen.add(id);
    return [{id:`asian-${config.type}-${id}`, imdbId:id, ...(item.moviedb_id ? {tmdbId:String(item.moviedb_id)} : {}),
      mediaKind:config.type, season:1, episode:1, title:item.name.trim().slice(0, 200),
      year:String(item.releaseInfo || item.year || '').slice(0, 4), type:config.label,
      poster:`https://images.metahub.space/poster/small/${id}/img`}];
  });
}
export function subtitleIndexUrl(item) {
  if (!/^tt\d{5,12}$/.test(item?.imdbId || '')) throw new Error('Invalid title');
  return `https://api.thesubtitledb.org/integrations/stremio/subtitles/${item.mediaKind === 'series' ? `series/${item.imdbId}%3A1%3A1` : `movie/${item.imdbId}`}.json`;
}
export function hasEnglishSubtitle(data) {
  return Array.isArray(data?.subtitles) && data.subtitles.some(track => /^(en|eng)$/i.test(track?.lang || '') && /^https:\/\/api\.thesubtitledb\.org\/integrations\/stremio\/s\/\d+\.vtt$/.test(track?.url || ''));
}
