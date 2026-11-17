const BASE = 'https://archive.org';
const validId = id => /^[A-Za-z0-9_.-]+$/.test(id);

export function searchUrl(query, page = 1) {
  const text = query.trim().replace(/[\\"\x00-\x1f]/g, ' ').slice(0, 120);
  const search = ['collection:feature_films', 'mediatype:movies', '-title:trailer'];
  if (text) search.push(`title:(${text.split(/\s+/).filter(Boolean).map(word => `"${word}"`).join(' AND ')})`);
  const params = new URLSearchParams({ q: search.join(' AND '), rows: '24', page: String(page), output: 'json' });
  for (const field of ['identifier', 'title', 'year']) params.append('fl[]', field);
  params.append('sort[]', 'downloads desc');
  return `${BASE}/advancedsearch.php?${params}`;
}
export function searchResults(data) {
  if (!Array.isArray(data?.response?.docs)) throw new Error('Invalid Archive search response');
  return data.response.docs.filter(item => validId(item.identifier || '') && typeof item.title === 'string').map(item => ({
    id: `discover-${item.identifier}`, archiveId: item.identifier,
    title: item.title, year: item.year ? String(item.year).slice(0, 4) : '',
    type: 'فیلم · Internet Archive', poster: `${BASE}/services/img/${item.identifier}`,
    sourcePage: `${BASE}/details/${item.identifier}`,
  }));
}
export function metadataUrl(id) {
  if (!validId(id)) throw new Error('Invalid Archive identifier');
  return `${BASE}/metadata/${encodeURIComponent(id)}`;
}
export function archiveFiles(id, data) {
  if (!validId(id) || data?.is_dark || !Array.isArray(data?.files)) throw new Error('Archive item unavailable');
  const download = name => `${BASE}/download/${encodeURIComponent(id)}/${name.split('/').map(encodeURIComponent).join('/')}`;
  const playable = data.files.filter(file => typeof file.name === 'string' && !file.private && /\.mp4$/i.test(file.name) && !/trailer|preview|sample|clip/i.test(file.name) && (!file.size || Number(file.size) >= 30_000_000));
  playable.sort((a, b) => (Number(a.size) || Infinity) - (Number(b.size) || Infinity));
  const subtitles = data.files.filter(file => typeof file.name === 'string' && /\.(srt|vtt)$/i.test(file.name) && !file.private).slice(0, 100).map(file => ({ label: file.name.split('/').pop(), url: download(file.name) }));
  return { url: playable.length ? download(playable[0].name) : null, subtitles };
}
