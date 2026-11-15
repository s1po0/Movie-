// AniList is metadata only. An entry does not establish streaming or subtitle availability.
export const DONGHUA_API = 'https://graphql.anilist.co';
export const ANIME_MAPPING = 'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json';
export const DONGHUA_QUERY = `query ($page: Int!, $search: String, $format: [MediaFormat]) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    media(type: ANIME, countryOfOrigin: CN, isAdult: false, search: $search, format_in: $format, sort: POPULARITY_DESC) {
      id format countryOfOrigin isAdult episodes title { english romaji native } startDate { year } coverImage { large medium }
    }
  }
}`;
const formats = { all: null, series: ['TV','TV_SHORT','ONA','OVA'], movie: ['MOVIE'] };
export function donghuaVariables(page, search = '', kind = 'all') {
  if (!Number.isInteger(page) || page < 1 || page > 1000 || !Object.hasOwn(formats, kind)) throw new Error('Invalid catalog request');
  const term = Array.from(String(search).trim()).slice(0, 100).join('');
  return { page, search: term || null, format: formats[kind] };
}
export function donghuaCatalog(data) {
  if (!Array.isArray(data?.data?.Page?.media) || data?.errors?.length) throw new Error('Invalid catalog response');
  const seen = new Set();
  const movies = data.data.Page.media.flatMap(item => {
    if (!Number.isSafeInteger(item?.id) || item.id <= 0 || seen.has(item.id) || item.countryOfOrigin !== 'CN' || item.isAdult !== false || !['TV','TV_SHORT','ONA','OVA','MOVIE','SPECIAL'].includes(item.format)) return [];
    const title = [item.title?.english, item.title?.romaji, item.title?.native].find(x => typeof x === 'string' && x.trim());
    if (!title) return [];
    let poster = '';
    try { const u = new URL(item.coverImage?.large || item.coverImage?.medium); if (u.protocol === 'https:' && !u.username && !u.password && !u.port && ['s4.anilist.co','s3.anilist.co'].includes(u.hostname)) poster = u.href; } catch { /* no poster */ }
    seen.add(item.id);
    return [{id:`donghua-${item.id}`, anilistId:item.id, format:item.format, title:title.trim().slice(0,200),
      year:Number.isInteger(item.startDate?.year) ? String(item.startDate.year) : '', poster, type:item.format === 'MOVIE' ? 'فیلمی دونگھوا' : 'زنجیرەی دونگھوا',
      episodes:Number.isInteger(item.episodes) && item.episodes > 0 ? item.episodes : null}];
  });
  return { movies, hasMore: data.data.Page.pageInfo?.hasNextPage === true };
}
// Do not guess a title, season or episode when the mapping is ambiguous. In
// particular, offsets and special seasons need matching beyond this player.
export function resolveDonghuaMapping(item, entries) {
  if (!Number.isSafeInteger(item?.anilistId) || !Array.isArray(entries)) return null;
  const matches = entries.filter(entry => entry?.anilist_id === item.anilistId);
  if (matches.length !== 1) return null;
  const row = matches[0];
  if ((row.episode_offset?.tmdb ?? 0) !== 0) return null;
  const imdb = Array.isArray(row.imdb_id) && row.imdb_id.length === 1 && /^tt\d{5,12}$/.test(row.imdb_id[0]) ? row.imdb_id[0] : null;
  if (item.format === 'MOVIE') {
    const ids = Array.isArray(row.themoviedb_id?.movie) ? [...new Set(row.themoviedb_id.movie.filter(id => Number.isSafeInteger(id) && id > 0))] : [];
    if (ids.length > 1 || (!ids.length && !imdb)) return null;
    return {...item, mediaKind:'movie', ...(ids.length ? {tmdbId:String(ids[0])} : {}), ...(imdb ? {imdbId:imdb} : {})};
  }
  const tv = row.themoviedb_id?.tv, season = row.season?.tmdb;
  if (!Number.isSafeInteger(tv) || tv < 1 || !Number.isInteger(season) || season < 1 || season > 999) return null;
  return {...item, tmdbId:String(tv), ...(imdb ? {imdbId:imdb} : {}), mediaKind:'series', season, episode:1};
}
