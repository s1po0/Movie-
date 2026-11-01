// Sidecar captions from NoMercy's HLS encodes of the Blender open movies.
const mediaRoot = 'https://raw.githubusercontent.com/NoMercy-Entertainment/nomercy-media/master/Films';
const languageNames = { afr: 'Afrikaans', ara: 'العربية', bra: 'Português (Brasil)', chi: '中文', cro: 'Hrvatski', cze: 'Čeština', dan: 'Dansk', dut: 'Nederlands', eng: 'English', fre: 'Français', ger: 'Deutsch', gre: 'Ελληνικά', heb: 'עברית', hin: 'हिन्दी', hun: 'Magyar', ind: 'Bahasa Indonesia', ita: 'Italiano', jpn: '日本語', kor: '한국어', lit: 'Lietuvių', nob: 'Norsk', nor: 'Norsk', per: 'فارسی', pob: 'Português (Brasil)', pol: 'Polski', por: 'Português', ron: 'Română', rus: 'Русский', spa: 'Español', srp: 'Српски', swe: 'Svenska', tam: 'தமிழ்', tel: 'తెలుగు', tur: 'Türkçe', vie: 'Tiếng Việt' };
const sidecars = (folder, languages) => languages.map(code => ({
  label: languageNames[code], url: `${mediaRoot}/${folder}/subtitles/${folder}.NoMercy.${code}.full.vtt`,
}));
// Free-to-watch Blender Foundation open movies. The video and sidecars remain on their hosts.
export const openMovies = [
  {
    id: 'sample-bunny', title: 'Big Buck Bunny', type: 'ئەنیمەیشن · کۆمیدی',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    poster: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
    credit: '© 2008 Blender Foundation · Directed by Sacha Goedegebure · CC BY 3.0',
  },
  {
    id: 'sample-dream', title: 'Elephants Dream', type: 'ئەنیمەیشن · خەیاڵی',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    poster: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
    credit: '© 2006 Blender Foundation / Netherlands Media Art Institute · Directed by Bassam Kurdali · CC BY 2.5',
    attributionUrl: 'https://github.com/NoMercy-Entertainment/nomercy-media/blob/master/Films/ATTRIBUTION.md',
    subtitles: sidecars('Elephants.Dream.(2006)', ['eng', 'ara', 'dut', 'jpn', 'rus', 'swe']),
  },
  {
    id: 'open-sintel', title: 'Sintel', type: 'ئەنیمەیشن · خەیاڵی',
    url: 'https://s.fastmotion.io/1752fa30-009a-47a0-a5fd-bdf19fcb77f5/playlist.m3u8',
    poster: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg',
    credit: '© 2010 Blender Foundation · Directed by Colin Levy · CC BY 3.0',
    attributionUrl: 'https://github.com/NoMercy-Entertainment/nomercy-media/blob/master/Films/ATTRIBUTION.md',
    subtitles: sidecars('Sintel.(2010)', ['eng', 'dut', 'fre', 'ger', 'ita', 'pol', 'por', 'rus', 'spa']),
  },
  {
    id: 'open-tears', title: 'Tears of Steel', type: 'زانستی خەیاڵی · دراما',
    url: 'https://s.fastmotion.io/cd7ec8f0-3136-41cd-bb8b-117edb7cda39/playlist.m3u8',
    poster: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg',
    subtitle: 'https://download.blender.org/demo/movies/ToS/subtitles/TOS-en.srt',
    credit: '© 2012 Blender Foundation · Directed by Ian Hubert · CC BY 3.0',
    attributionUrl: 'https://github.com/NoMercy-Entertainment/nomercy-media/blob/master/Films/ATTRIBUTION.md',
    subtitles: sidecars('Tears.of.Steel.(2012)', ['bra', 'chi', 'cro', 'cze', 'dan', 'dut', 'fre', 'ger', 'gre', 'heb', 'hun', 'ind', 'ita', 'jpn', 'nor', 'per', 'por', 'rus', 'spa']),
  },

];

// Publicly accessible Internet Archive items. Only direct video URLs are stored;
// the media itself stays on the Archive's servers.
const archiveMovie = (id, title, year, type, file, subtitle) => ({
  id: `archive-${id}`, title, year, type,
  url: `https://archive.org/download/${id}/${encodeURIComponent(file)}`,
  poster: `https://archive.org/services/img/${id}`,
  sourcePage: `https://archive.org/details/${id}`,
  ...(subtitle ? { subtitle: `https://archive.org/download/${id}/${encodeURIComponent(subtitle)}` } : {}),
});
export const classicMovies = [
  archiveMovie('his_girl_friday', 'His Girl Friday', '1940', 'کۆمیدی · ڕۆمانسی', 'his_girl_friday.mp4', 'his_girl_friday.asr.srt'),
  archiveMovie('Nosferatu1922', 'Nosferatu', '1922', 'ترسناک · دراما', 'Nosferatu.mp4'),
  archiveMovie('metropolis-1927-english-titles', 'Metropolis', '1927', 'زانستی خەیاڵی · دراما', 'Metropolis-1927-EnglishTitles.mp4'),
  archiveMovie('murder-1930', 'Murder!', '1930', 'تاوان · نهێنی', 'Murder! (1930).mp4'),
  archiveMovie('holiday-1930-pdd26', 'Holiday', '1930', 'دراما · ڕۆمانسی', 'Holiday (1930).mp4'),
  archiveMovie('anna-christie-1930-greta-garbo-english', 'Anna Christie', '1930', 'دراما', 'Anna Christie 1930 - Greta Garbo, Marie Dressler, Charles Bickford.mp4'),
  archiveMovie('the-unholy-three_1930', 'The Unholy Three', '1930', 'تاوان · دراما', 'the-unholy-three_1930.mp4'),
  archiveMovie('the-divorcee_1930', 'The Divorcee', '1930', 'دراما · ڕۆمانسی', 'the-divorcee_1930.mp4'),
  archiveMovie('SherlockHolmes-TheCaseoftheCunninghamHeritage', 'Sherlock Holmes: The Cunningham Heritage', '1954', 'زنجیرە · نهێنی', 'TheCaseoftheCunninghamHeritage.mp4', 'TheCaseoftheCunninghamHeritage.autogenerated.vtt'),
  archiveMovie('SherlockHolmes-TheCaseofLadyBeryl', 'Sherlock Holmes: The Case of Lady Beryl', '1954', 'زنجیرە · نهێنی', 'TheCaseofLadyBeryl.mp4', 'TheCaseofLadyBeryl.autogenerated.vtt'),
];
export const movies = [...classicMovies, ...openMovies];
