import { catalogUrl, mergeCatalogPage } from '../src/cinemeta.js';

// Optional integration check: requires network access to Cinemeta.
try {
  const genre = process.argv.includes('--horror') ? 'Horror' : '';
  let movies = [];
  for (let page = 1; page <= 23; page++) {
    const response = await fetch(catalogUrl('', page, genre), { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Catalog page ${page}: HTTP ${response.status}`);
    const data = await response.json();
    const result = mergeCatalogPage(movies, data, '', page);
    movies = result.movies;
    if (!result.hasMore && page < 23) throw new Error(`Catalog stopped at page ${page}: ${movies.length} titles`);
  }
  if (movies.length <= 1000) throw new Error(`Only ${movies.length} unique titles returned`);
  console.log(`::notice title=Live movie catalog::${movies.length} unique ${genre || 'general'} movie titles across 23 pages`);
} catch (error) {
  console.log(`::error title=Live catalog check::${error.message} ${error.cause?.message || ''}`);
  process.exitCode = 1;
}
