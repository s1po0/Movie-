const BASE = 'https://v3-cinemeta.strem.io/catalog/movie/top';
const imdbId = value => typeof value === 'string' && /^tt\d{5,12}$/.test(value);

// Cinemeta provides metadata, not streams. Search results may not have a playable source.
export function catalogUrl(query = '', page = 1, genre = '') {
  const term = Array.from(String(query).trim()).slice(0, 120)
    .map(char => char.length === 1 && /[\uD800-\uDFFF]/.test(char) ? '\uFFFD' : char).join('');
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new Error('Invalid catalog page');
  if (genre !== '' && genre !== 'Horror') throw new Error('Invalid catalog genre');
  if (term) return `${BASE}/search=${encodeURIComponent(term)}.json`;
  // Cinemeta's popular catalog advances in 50-item slots; some slots contain fewer entries.
  const params = [];
  if (genre) params.push(`genre=${genre}`);
  if (page > 1) params.push(`skip=${(page - 1) * 50}`);
  return `${BASE}${params.length ? `/${params.join('&')}` : ''}.json`;
}

export function mergeCatalogPage(existing, data, query = '', page = 1) {
  const items = catalogResults(data);
  const known = new Set((page === 1 ? [] : existing).map(movie => movie.imdbId));
  const added = items.filter(movie => !known.has(movie.imdbId));
  return {
    movies: page === 1 ? added : [...existing, ...added],
    // Cinemeta can return fewer than 50 items even when later pages exist.
    hasMore: !String(query).trim() && data.metas.length > 0 && added.length > 0,
  };
}

export function catalogResults(data) {
  if (!Array.isArray(data?.metas)) throw new Error('Invalid movie catalog response');
  const seen = new Set();
  return data.metas.flatMap(item => {
    const id = item?.id;
    if (!imdbId(id) || item.type !== 'movie' || typeof item.name !== 'string' || !item.name.trim() || seen.has(id)) return [];
    seen.add(id);
    let poster = `https://images.metahub.space/poster/small/${id}/img`;
    try { const url = new URL(item.poster); if (url.protocol === 'https:' && !url.username && !url.password) poster = url.href; } catch { /* use the metadata poster service */ }
    return [{ id: `cinemeta-${id}`, imdbId: id, title: item.name.trim().slice(0, 200),
      year: typeof item.releaseInfo === 'string' ? item.releaseInfo.slice(0, 4) : '', type: 'فیلم', poster }];
  });
}
