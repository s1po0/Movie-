import { movies } from './movies.js';

export function searchMovies(query) {
  const term = query.trim().toLocaleLowerCase();
  return movies.filter(movie => `${movie.title} ${movie.year || ''} ${movie.type || ''}`.toLocaleLowerCase().includes(term));
}
