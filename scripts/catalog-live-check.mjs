import { catalogUrl, mergeCatalogPage } from '../src/cinemeta.js';

// Optional integration check: requires network access to Cinemeta.
let movies = [];
for (let page = 1; page <= 11; page++) {
  const response = await fetch(catalogUrl('', page), { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Catalog page ${page}: HTTP ${response.status}`);
  const result = mergeCatalogPage(movies, await response.json(), '', page);
  movies = result.movies;
  if (!result.hasMore && page < 11) throw new Error(`Catalog stopped at page ${page}: ${movies.length} titles`);
}
if (movies.length <= 1000) throw new Error(`Only ${movies.length} unique titles returned`);
console.log(`::notice title=Live movie catalog::${movies.length} unique movie titles across eleven pages`);
