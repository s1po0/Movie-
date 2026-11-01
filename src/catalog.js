// Publicly visible titles on the reference page. That page does not expose
// direct stream URLs in its public listing, so these link to the source page.
export const referenceUrl = 'https://kurdtips.uno/live/';
export const referenceMovies = [
  ['Verity', 'rmaNMA1seHqpjtnYKzyynFAr1g8.jpg', '6.8'],
  ['The Dog Stars', '5O616X9vmRzQdB68PHzBewPittd.jpg', '7.1'],
  ['Clayface', '9l1NuFjel2j89hiuiJbsxfblqjy.jpg', '7.5'],
  ['Apocalypse Z: New World', 'wgPGAKuojOd3ncsNbxMDuU4uRn0.jpg', '6.1'],
  ['Forgotten Island', 'myd1K3gefdNAWFsGNRDdMeiK9Qg.jpg', '7.9'],
  ['Wildwood', 'snFM00mpNAfUzUtkdEW0uDEvXA0.jpg', '8.7'],
  ['Hope', '6VY1ZKgpsc8CfGsQcCGiYEgHdH0.jpg', '6.8'],
  ['Obsession', 'bRwnj8WEKBCvmfeUNOukJPwB43K.jpg', '8.2'],
  ['Avengers: Doomsday', 'jzPwsojjFStf5lR5Nm07w2hH56G.jpg', ''],
  ['Resident Evil', 'i7UyjfPio0VFHB9rBUZSFyhOoM8.jpg', '7.3'],
  ['Dune: Part Three', 'glt0v4I89rMWstDNCaFXc5SNyO1.jpg', ''],
  ['Spider-Man: Brand New Day', 'bjiS5ipwxb9JFy3XRRN4OAilSeX.jpg', '8.5'],
].map(([title, poster, rating]) => ({ title, poster: `https://image.tmdb.org/t/p/w500/${poster}`, rating, year: '2026' }));
export function searchReferenceMovies(query) {
  const term = query.trim().toLocaleLowerCase();
  return referenceMovies.filter(movie => movie.title.toLocaleLowerCase().includes(term));
}
