// Cinemeta's country metadata provides discovery, not a guarantee of playback.
const countries = {
  koreanMovie: { type: 'movie', accepted: ['south korea', 'republic of korea'], label: 'فیلمی کۆری' },
  korean: { type: 'series', accepted: ['south korea', 'republic of korea'], label: 'درامای کۆری' },
  japanese: { type: 'movie', accepted: ['japan'], label: 'فیلمی ژاپۆنی' },
  chinese: { type: 'movie', accepted: ['china', 'hong kong', 'taiwan'], label: 'فیلمی چینی' },
};
export const asianRegions = Object.keys(countries);
// Well-known starting points; metadata and subtitle availability are still
// checked live before a title is displayed. The catalog can expand by page.
export const asianSeedIds = {
  koreanMovie: ['tt6751668','tt5700672','tt0364569','tt1392190','tt0468492','tt8579674','tt4016934','tt0353969','tt1216492','tt7282468','tt6878038','tt5215952','tt12477480','tt1588170'],
  korean: ['tt10850932','tt10919420','tt5994364','tt7923710','tt6611916','tt13433812','tt20869502','tt5182866','tt24640580','tt11239552','tt4922804'],
  japanese: ['tt0245429','tt5311514','tt0047478','tt8075192','tt0119698','tt0096283','tt0347149','tt0118849','tt0095327','tt0081505'],
  chinese: ['tt0118694','tt0190332','tt0106332','tt0299977','tt7605074','tt0110081','tt0101640','tt0118693','tt0091288','tt0187393'],
};
export function asianMetadataUrl(region, id) {
  const config = countries[region];
  if (!config || !/^tt\d{5,12}$/.test(id || '')) throw new Error('Invalid Asian metadata request');
  return `https://v3-cinemeta.strem.io/meta/${config.type}/${id}.json`;
}
export function asianCatalogUrl(region, page) {
  const config = countries[region];
  if (!config || !Number.isInteger(page) || page < 1 || page > 10000) throw new Error('Invalid Asian catalog request');
  return `https://v3-cinemeta.strem.io/catalog/${config.type}/top${page > 1 ? `/skip=${(page - 1) * 50}` : ''}.json`;
}
export function koreanDramaSearchUrl(query) {
  const term = Array.from(String(query).trim()).slice(0, 120).map(char => char.length === 1 && /[\uD800-\uDFFF]/.test(char) ? '\uFFFD' : char).join('');
  if (!term) throw new Error('Invalid drama search');
  return `https://v3-cinemeta.strem.io/catalog/series/top/search=${encodeURIComponent(term)}.json`;
}
export function asianCatalogResults(region, data) {
  const config = countries[region];
  if (!config || !Array.isArray(data?.metas)) throw new Error('Invalid Asian catalog response');
  const seen = new Set();
  return data.metas.flatMap(item => {
    const parts = typeof item?.country === 'string' ? item.country.toLowerCase().split(',').map(s => s.trim()) : [];
    const genres = Array.isArray(item?.genres) ? item.genres : Array.isArray(item?.genre) ? item.genre : [];
    const id = item?.id;
    if (item?.type !== config.type || !config.accepted.includes(parts[0]) ||
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
