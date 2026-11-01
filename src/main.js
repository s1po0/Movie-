import './style.css';
import Hls from 'hls.js';
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { createIcons, icons } from 'lucide';
import { parseSubtitles, toVtt } from './subtitles.js';
import { translationGroups, translationUrl, translatedText, translateGroup } from './translate.js';
import { searchMovies } from './catalog.js';
import { movies } from './movies.js';
import { searchUrl, searchResults, metadataUrl, archiveFiles } from './archive.js';
import { isDonkeyPage, donkeyHome } from './donkey.js';
import { movieEmbedUrl } from './vidlink.js';

const languages = [['ckb','کوردی سۆرانی'],['en','English'],['ar','العربية'],['ku','Kurdî (Kurmancî)'],['tr','Türkçe'],['fa','فارسی'],['fr','Français'],['de','Deutsch'],['es','Español'],['hi','हिन्दी'],['ja','日本語'],['ko','한국어'],['zh-CN','中文']];
const DonkeyPlayer = registerPlugin('DonkeyPlayer');
const app = document.querySelector('#app');
let library = readLibrary();
let current = null, hls = null, subtitleUrls = {}, originalCues = null, playerSession = 0, subtitleVersion = 0, subtitleRequest = 0, translations = {};
let discovery = [], discoveryQuery = '', discoveryPage = 0, discoverySeq = 0, discoveryTimer;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function readLibrary() { try { const value = JSON.parse(localStorage.getItem('dimo-library') || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function saveLibrary() { localStorage.setItem('dimo-library', JSON.stringify(library)); }
function icon(name, cls = '') { return `<i data-lucide="${name}" class="${cls}"></i>`; }
function paintIcons() { createIcons({ icons }); }
function render() {
  const cards = library;
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <a href="#home" class="brand" aria-label="DIMO"><span class="brand-mark">${icon('play')}</span><span>DIMO<span class="brand-dot">.</span></span></a>
        <nav><a class="nav-active" href="#home">سەرەتا</a><a href="#catalog">فیلمەکان</a><a href="#library">کتێبخانە</a></nav>
        <button class="top-add" data-action="add">${icon('plus')} <span>زیادکردنی فیلم</span></button>
      </header>
      <main id="home">
        <section class="hero">
          <div class="hero-shade"></div><div class="hero-content">
            <div class="eyebrow"><span></span> جیهانێک چیرۆک، لە یەک شوێن</div>
            <h1>کاتی ئەوەیە<br><em>چیرۆکێکی نوێ ببینیت.</em></h1>
            <p>فیلم و دراماکانت کۆ بکەرەوە، سەیریان بکە و ژێرنووسەکە بە زمانی دڵخوازت بگۆڕە.</p>
            <div class="hero-actions"><button class="primary" data-play="cinebloom-155">${icon('play')} سەیرکردنی <span dir="ltr">The Dark Knight</span></button><button class="ghost" data-action="add">${icon('plus')} فیلم زیاد بکە</button></div>
          </div><div class="hero-index"><span>01</span><div></div> YOUR CINEMA, YOUR WAY</div>
        </section>
        <div class="feature-strip"><div>${icon('clapperboard')} <span>فیلم و دراما</span></div><div>${icon('captions')} <span>ژێرنووسی دڵخواز</span></div><div>${icon('languages')} <span>وەرگێڕان بۆ چەند زمانێک</span></div><div>${icon('smartphone')} <span>لە مۆبایلەکەتدا</span></div></div>
        <section class="catalog" id="catalog">
          <div class="section-head catalog-head"><div><span class="overline">DISCOVER MOVIES</span><h2>فیلم و دراماکان <span>✦</span></h2><p>فیلم هەڵبژێرە و ڕاستەوخۆ لە ناو بەرنامەکە سەیری بکە.</p></div><label class="catalog-search"><span class="sr-only">گەڕان بە ناوی فیلم</span>${icon('search')}<input id="catalog-search" type="search" placeholder="گەڕان بە ناوی فیلم..." autocomplete="off"></label></div>
          <button class="ghost donkey-link" data-action="donkey">${icon('clapperboard')} فیلم و درامای زیاتر</button><p class="catalog-notice">بەردەستبوونی پەخش و ژێرنووس بە سەرچاوەکە و ئینتەرنێتەوە پەیوەستە؛ هەموو فیلمێک بەردەست نییە.</p>
          <div id="catalog-cards" class="catalog-cards">${catalogCards(searchMovies(''))}</div>
          <p id="catalog-empty" class="catalog-empty hidden">هیچ فیلمێک بەم ناوە نەدۆزرایەوە.</p><p id="discovery-status" class="form-hint" role="status"></p><button id="more-movies" class="ghost hidden" type="button">فیلمی زیاتر</button>
        </section>
        <section class="library" id="library">
          <div class="section-head"><div><span class="overline">YOUR COLLECTION</span><h2>کتێبخانەی تۆ <span>✦</span></h2><p>لینکی فیلمەکانی خۆت لێرە زیاد بکە.</p></div><button class="text-button" data-action="add">زیادکردنی فیلم ${icon('arrow-up-left')}</button></div>
          <div class="cards">${cards.map((movie, i) => `<article class="movie-card"><button class="poster ${escapeHtml(movie.color || ['gold','plum','blue'][i%3])}" ${movie.poster ? `style="background-image:linear-gradient(0deg, #101510a8, transparent 55%),url('${escapeHtml(movie.poster)}');background-size:cover;background-position:center"` : ''} data-play="${escapeHtml(movie.id)}" aria-label="سەیرکردنی ${escapeHtml(movie.title)}"><span class="poster-label">${movie.credit ? 'FREE MOVIE' : 'MY MOVIE'}</span><span class="poster-art">${icon('clapperboard')}</span><span class="poster-play">${icon('play')}</span><span class="poster-bottom">DIMO <span>✦</span></span></button><div class="card-info"><div><h3 dir="auto">${escapeHtml(movie.title)}</h3><p>${escapeHtml(isDonkeyPage(movie.url) ? 'فیلمی من' : movie.type || 'فیلمی من')} <span>•</span> STREAMING</p></div>${movie.credit ? '' : `<button class="delete" data-delete="${escapeHtml(movie.id)}" aria-label="سڕینەوەی ${escapeHtml(movie.title)}">${icon('trash-2')}</button>`}</div></article>`).join('')}<button class="add-card" data-action="add"><span>${icon('plus')}</span><strong>فیلمێکی نوێ زیاد بکە</strong><small>لینکی خۆت دابنێ</small></button></div>
        </section>
        <section class="note"><div class="note-icon">${icon('sparkles')}</div><div><strong>هەر چیرۆکێک، بە زمانی خۆت.</strong><p>ژێرنووسێک بار بکە و بە Google Translate وەری بگێڕە بۆ زمانی دڵخوازت.</p></div><button class="text-button" data-action="help">چۆن کار دەکات؟ ${icon('arrow-up-left')}</button></section>
      </main>
      <footer><span class="footer-brand">DIMO<span>.</span></span><span>دروستکراوە بۆ خۆشەویستانی فیلم <b>✦</b></span><span>YOUR STORIES, YOUR WAY</span></footer>
    </div>
    <div class="overlay hidden" id="modal" role="dialog" aria-modal="true"></div>
    <div class="overlay hidden player-overlay" id="player-modal" role="dialog" aria-modal="true"></div>
    <div class="toast hidden" role="status"></div>`;
  paintIcons();
  loadDiscovery('', 1);
}
function catalogCards(items) {
  return items.map(movie => `<article class="catalog-card"><button class="catalog-movie" data-play="${escapeHtml(movie.id)}" aria-label="سەیرکردنی ${escapeHtml(movie.title)}"><div class="catalog-poster"><img src="${escapeHtml(movie.poster)}" alt="" loading="lazy"><span class="catalog-badge">${escapeHtml(movie.year || 'FREE')}</span><span class="catalog-open">${icon('play')}</span></div><h3 dir="auto">${escapeHtml(movie.title)}</h3><p dir="auto">${escapeHtml(movie.type || 'فیلم')} · STREAMING</p></button></article>`).join('');
}
function openModal(content) { const m = document.querySelector('#modal'); m.innerHTML = `<div class="dialog">${content}</div>`; m.classList.remove('hidden'); paintIcons(); }
function closeModal() { document.querySelector('#modal').classList.add('hidden'); }
function addDialog() {
  openModal(`<div class="dialog-header"><div><span class="overline">YOUR COLLECTION</span><h2>فیلمێک زیاد بکە</h2></div><button class="icon-button" data-action="close" aria-label="داخستن">${icon('x')}</button></div><p class="dialog-desc">لینکی فیلم یان ماڵپەڕی فیلمێک دابنێ.</p><form id="add-form"><label>ناوی فیلم <input required name="title" maxlength="100" placeholder="ناوی فیلمەکە بنووسە"></label><label>لینکی ستریم <input required name="url" type="url" dir="ltr" placeholder="https://example.com/movie.m3u8"></label><label>لینکی ژێرنووس <span class="optional">ئیختیاری · SRT / VTT</span><input name="subtitle" type="url" dir="ltr" placeholder="https://example.com/subtitle.srt"></label><p class="form-hint">بۆ پلەیەری DIMO، لینکەکە دەبێت HTTPS و ڕاستەوخۆ بۆ MP4، WebM یان HLS بێت. لینکی ماڵپەڕ لە پلەیەری ماڵپەڕەکە دەکرێتەوە؛ ژێرنووسی DIMO بۆی کار ناکات.</p><button class="primary full" type="submit">${icon('plus')} زیادکردن بۆ کتێبخانە</button></form>`);
}
function helpDialog() { openModal(`<div class="dialog-header"><div><span class="overline">HOW IT WORKS</span><h2>چۆن کار دەکات؟</h2></div><button class="icon-button" data-action="close" aria-label="داخستن">${icon('x')}</button></div><div class="help-list"><p><b>١</b><span>لینکی ڕاستەوخۆی ستریمەکەت زیاد بکە و فیلمەکە بکەرەوە.</span></p><p><b>٢</b><span>فایلی ژێرنووسی SRT یان VTT هەڵبژێرە، یان لینکی ژێرنووس دابنێ.</span></p><p><b>٣</b><span>زمان هەڵبژێرە و دوگمەی وەرگێڕان دابگرە؛ پێویست بە کلیل یان پارەدان نییە.</span></p></div><p class="form-hint">ژێرنووسەکان بۆ Google دەنێردرێن. خزمەتگوزارییە بەخۆڕاییەکە فەرمی نییە؛ لەوانەیە سنووردار بکرێت یان بوەستێت. هەندێک ستریم یان زمان لەوانەیە پشتگیری نەکرێت.</p>`); }
function toast(message) { const el = document.querySelector('.toast'); el.textContent = message; el.classList.remove('hidden'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.add('hidden'), 4500); }
function validUrl(url) { try { return new URL(url).protocol === 'https:'; } catch { return false; } }
async function openDonkey(url) {
  if (!isDonkeyPage(url)) return;
  try {
    if (Capacitor.isNativePlatform()) await DonkeyPlayer.open({ url });
    else window.open(url, '_blank', 'noopener,noreferrer');
  } catch { toast('ماڵپەڕەکە نەکرایەوە.'); }
}
function findMovie(id) { return [...library, ...movies, ...discovery].find(m => m.id === id); }
async function getJson(url) {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({ url, responseType: 'json' });
    if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}`);
    return typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
function drawCatalog() {
  const local = searchMovies(discoveryQuery);
  const ids = new Set(movies.map(m => m.id.startsWith('archive-') ? m.id.slice(8) : ''));
  const items = [...local, ...discovery.filter(m => !ids.has(m.archiveId))];
  document.querySelector('#catalog-cards').innerHTML = catalogCards(items);
  document.querySelector('#catalog-empty').classList.toggle('hidden', items.length > 0 || discoveryPage === 0);
  document.querySelector('#more-movies').classList.toggle('hidden', discoveryPage === 0 || discovery.length < discoveryPage * 24);
  paintIcons();
}
async function loadDiscovery(query, page) {
  const seq = ++discoverySeq; discoveryQuery = query;
  const status = document.querySelector('#discovery-status'); if (!status) return;
  const button = document.querySelector('#more-movies'); button.disabled = true;
  status.textContent = 'فیلمەکان بار دەکرێن...';
  try {
    const items = searchResults(await getJson(searchUrl(query, page)));
    if (seq !== discoverySeq) return;
    if (page === 1) discovery = items; else discovery.push(...items);
    discoveryPage = page; drawCatalog();
    status.textContent = items.length ? 'فیلمەکان لە Internet Archive دەنرێن؛ هەموو ئەنجامەکان ڕەنگە فایلی پەخشیان نەبێت.' : 'ئەنجامی زیاتری بەردەست نییە.';
  } catch {
    if (seq === discoverySeq) { status.textContent = 'فیلمەکانی Internet Archive بار نەبوون؛ ئینتەرنێت بپشکنە. فیلمە ناوخۆییەکان هێشتا دیارن.'; drawCatalog(); }
  } finally { if (seq === discoverySeq) button.disabled = false; }
}
function addSubtitleSources(sources) {
  const label = document.querySelector('#subtitle-source-label'), select = document.querySelector('#subtitle-source');
  if (!label || !select) return;
  const known = new Set([...select.options].map(o => o.value));
  for (const source of sources) {
    if (!source.url || known.has(source.url)) continue;
    const option = document.createElement('option'); option.value = source.url; option.textContent = source.label; select.append(option); known.add(source.url);
  }
  label.classList.toggle('hidden', select.options.length <= 1);
}
async function loadArchiveItem(id, movie, session, initialSubtitleRequest) {
  const message = document.querySelector('#player-message');
  if (!movie.url) message.textContent = 'لینکی فیلمەکە بار دەکرێت...';
  try {
    const data = archiveFiles(id, await getJson(metadataUrl(id)));
    if (session !== playerSession) return;
    if (!movie.url) {
      if (!data.url) { message.textContent = 'فایلی MP4 بۆ ئەم فیلمە بەردەست نییە.'; return; }
      const video = document.querySelector('#video'); video.src = data.url; video.play().catch(() => {});
      message.textContent = 'سەرچاوە: Internet Archive';
    }
    addSubtitleSources(data.subtitles);
    if (!movie.subtitle && data.subtitles.length && !originalCues && subtitleRequest === initialSubtitleRequest) {
      const preferred = data.subtitles.find(s => /(^|[^a-z])(en|eng|english)([^a-z]|$)/i.test(s.label)) || data.subtitles[0];
      document.querySelector('#subtitle-source').value = preferred.url; loadSubtitleUrl(preferred.url);
    }
  } catch {
    if (session === playerSession && !movie.url) message.textContent = 'لینکی فیلم بار نەبوو؛ ئینتەرنێت یان بەردەستبوونی سەرچاوەکە بپشکنە.';
  }
}
function playDirect(url, format) {
  const video = document.querySelector('#video');
  if (!video) return;
  if ((format === 'hls' || /\.m3u8(?:[?#]|$)/i.test(url)) && Hls.isSupported()) {
    hls = new Hls(); hls.loadSource(url); hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) document.querySelector('#player-message').textContent = 'ستریمەکە بار نەبوو؛ لینک و دەستڕاگەیشتنی CORS بپشکنە.'; });
  } else video.src = url;
  video.play().catch(() => {});
}
function openPlayer(movie) {
  if (!movie) return;
  playerSession++; subtitleRequest++; current = movie; originalCues = null; translations = {};
  const modal = document.querySelector('#player-modal');
  if (movie.tmdbId) {
    const url = movieEmbedUrl(movie.tmdbId);
    modal.innerHTML = `<div class="player-dialog"><div class="player-head"><div><span class="overline">NOW PLAYING</span><h2 dir="auto">${escapeHtml(movie.title)}</h2></div><button class="icon-button" data-action="close-player" aria-label="داخستن">${icon('x')}</button></div><div class="video-wrap"><iframe src="${url}" title="${escapeHtml(movie.title)}" sandbox="allow-scripts allow-same-origin allow-presentation" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div><p class="player-message">دوگمەی پەخش لە ناو پلەیەرەکە دابگرە. ژێرنووس لە ڕێکخستنەکانی ئەو پلەیەرە هەڵبژێرە؛ وەرگێڕانی DIMO لێرە کار ناکات. بەردەستبوونی فیلم بە سەرچاوەکە پەیوەستە.</p><a class="text-button" href="${url}" target="_blank" rel="noopener noreferrer">ئەگەر پلەیەرەکە نەکرایەوە، لە پەڕەیەکی تر بیکەرەوە ↗</a></div>`;
    modal.classList.remove('hidden'); document.body.classList.add('modal-open'); paintIcons();
    return;
  }
  modal.innerHTML = `<div class="player-dialog"><div class="player-head"><div><span class="overline">NOW PLAYING</span><h2 dir="auto">${escapeHtml(movie.title)}</h2></div><button class="icon-button" data-action="close-player" aria-label="داخستن">${icon('x')}</button></div><div class="video-wrap"><video id="video" controls playsinline></video></div><div id="player-message" class="player-message">${movie.credit ? `${escapeHtml(movie.credit)}${movie.attributionUrl ? ` · <a href="${escapeHtml(movie.attributionUrl)}" target="_blank" rel="noopener noreferrer">HLS attribution ↗</a>` : ''} · <a href="${escapeHtml(movie.licenseUrl || `https://creativecommons.org/licenses/${movie.id === 'sample-dream' ? 'by/2.5/' : 'by/3.0/'}`)}" target="_blank" rel="noopener noreferrer">License ↗</a>` : movie.sourcePage ? `Internet Archive · <a href="${escapeHtml(movie.sourcePage)}" target="_blank" rel="noopener noreferrer">سەرچاوە ↗</a>` : 'ئەگەر ستریمەکە کار نەکرد، لینک و ئینتەرنێت بپشکنە.'}</div><div class="subtitle-panel"><div class="sub-heading"><div><span class="sub-icon">${icon('captions')}</span><div><h3>ژێرنووس</h3><p id="subtitle-status">ژێرنووسێک هەڵبژێرە یان بار بکە</p></div></div><label class="upload-button">${icon('upload')} بارکردنی فایل<input id="subtitle-file" type="file" accept=".srt,.vtt,text/vtt,text/plain" hidden></label></div><div class="sub-controls"><label id="subtitle-source-label" class="hidden">فایلی ژێرنووسی فیلم<select id="subtitle-source"><option value="">ژێرنووس هەڵبژێرە</option></select></label><label>ژێرنووسی بەردەست<select id="track-select"><option value="off">کوژاندنەوە</option></select></label><label>زمانی وەرگێڕان<select id="language">${languages.map(([code, name]) => `<option value="${code}">${escapeHtml(name)}</option>`).join('')}<option value="custom">زمانێکی تر…</option></select></label><label id="custom-language-label" class="hidden">کۆدی زمان <input id="custom-language" dir="ltr" placeholder="e.g. it"></label></div><details class="translate-details"><summary>${icon('languages')} وەرگێڕانی ژێرنووس بە Google</summary><p>فایلی ژێرنووس بار بکە و زمان هەڵبژێرە. وەرگێڕان بەخۆڕاییە و پێویستی بە کلیل نییە؛ ژێرنووسەکان بۆ Google دەنێردرێن.</p><div class="translate-row"><button class="primary" id="translate">${icon('sparkles')} وەرگێڕان</button></div><p id="translation-status" class="form-hint" role="status"></p></details></div></div>`;
  modal.classList.remove('hidden'); document.body.classList.add('modal-open'); paintIcons();
  const video = document.querySelector('#video');
  video.addEventListener('error', () => { document.querySelector('#player-message').textContent = 'ستریمەکە کار نەکرد. لینک، ئینتەرنێت و پشتگیری فرۆمات بپشکنە.'; });
  const session = playerSession;
  if (movie.url) playDirect(movie.url);
  video.textTracks.addEventListener('addtrack', refreshTracks);
  video.textTracks.addEventListener('removetrack', refreshTracks);
  const sources = [...(movie.subtitle ? [{ label: 'ژێرنووسی سەرچاوە', url: movie.subtitle }] : []), ...(movie.subtitles || [])];
  if (sources.length) {
    addSubtitleSources(sources);
    document.querySelector('#subtitle-source').value = sources[0].url;
    loadSubtitleUrl(sources[0].url);
  }
  const archiveId = movie.archiveId || (movie.id.startsWith('archive-') ? movie.id.slice(8) : null);
  if (archiveId) loadArchiveItem(archiveId, movie, session, subtitleRequest);
}
function closePlayer() { playerSession++; if (hls) { hls.destroy(); hls = null; } const video = document.querySelector('#video'); if (video) { video.pause(); video.removeAttribute('src'); video.load(); } Object.values(subtitleUrls).forEach(URL.revokeObjectURL); subtitleUrls = {}; originalCues = null; current = null; document.querySelector('#player-modal').innerHTML = ''; document.querySelector('#player-modal').classList.add('hidden'); document.body.classList.remove('modal-open'); }
function refreshTracks() {
  const video = document.querySelector('#video'), select = document.querySelector('#track-select'); if (!video || !select) return;
  const selected = select.value; select.innerHTML = '<option value="off">کوژاندنەوە</option>';
  Array.from(video.textTracks).forEach((track, i) => { if (track.kind !== 'subtitles' && track.kind !== 'captions') return; const option = document.createElement('option'); option.value = String(i); option.textContent = track.label || track.language || `ژێرنووس ${i + 1}`; select.append(option); });
  if ([...select.options].some(o => o.value === selected)) select.value = selected;
}
function installCues(cues, label, kind = 'original') {
  const video = document.querySelector('#video'); if (!video) return;
  if (kind === 'original') {
    const translated = video.querySelector('track[data-external="translated"]'); if (translated) translated.remove();
    if (subtitleUrls.translated) URL.revokeObjectURL(subtitleUrls.translated); delete subtitleUrls.translated;
  }
  const old = video.querySelector(`track[data-external="${kind}"]`); if (old) old.remove();
  if (subtitleUrls[kind]) URL.revokeObjectURL(subtitleUrls[kind]);
  subtitleUrls[kind] = URL.createObjectURL(new Blob([toVtt(cues)], { type: 'text/vtt' }));
  const track = document.createElement('track'); track.kind = 'subtitles'; track.label = label; track.srclang = 'und'; track.src = subtitleUrls[kind]; track.dataset.external = kind; video.append(track);
  Array.from(video.textTracks).forEach(t => { t.mode = 'disabled'; }); track.track.mode = 'showing';
  refreshTracks(); const index = Array.from(video.textTracks).indexOf(track.track); document.querySelector('#track-select').value = String(index);
}
function loadSubtitle(text) { const cues = parseSubtitles(text); if (!cues.length) throw new Error('هیچ ژێرنووسێک نەدۆزرایەوە. فایلی SRT یان VTT دروست هەڵبژێرە.'); originalCues = cues; subtitleVersion++; translations = {}; installCues(cues, 'ژێرنووسی ڕەسەن'); document.querySelector('#subtitle-status').textContent = `${cues.length} دێڕی ژێرنووس بارکرا`; }
async function loadSubtitleUrl(url) {
  const session = playerSession, requestId = ++subtitleRequest;
  try { let text; if (Capacitor.isNativePlatform()) { const result = await CapacitorHttp.get({ url, responseType: 'text' }); if (result.status < 200 || result.status >= 300) throw new Error(); text = result.data; } else { const response = await fetch(url); if (!response.ok) throw new Error(); text = await response.text(); } if (session === playerSession && requestId === subtitleRequest) loadSubtitle(text); } catch { if (session === playerSession && requestId === subtitleRequest) document.querySelector('#subtitle-status').textContent = 'ژێرنووس بار نەبوو؛ لینکەکە بپشکنە یان فایل بار بکە.'; }
}
async function translateCues() {
  const status = document.querySelector('#translation-status'), button = document.querySelector('#translate');
  const selection = document.querySelector('#language').value, target = selection === 'custom' ? document.querySelector('#custom-language').value.trim() : selection;
  if (!originalCues) { status.textContent = 'سەرەتا فایلی ژێرنووس بار بکە.'; return; }
  if (!/^[a-zA-Z]{2,3}(?:-[a-zA-Z]{2,4})?$/.test(target)) { status.textContent = 'کۆدی زمانێکی دروست بنووسە.'; return; }
  if (translations[target]) { installCues(translations[target], `Google · ${target}`, 'translated'); status.textContent = 'وەرگێڕان ئامادەیە.'; return; }
  const session = playerSession, version = subtitleVersion; button.disabled = true;
  const stillCurrent = () => session === playerSession && version === subtitleVersion;
  try {
    const groups = translationGroups(originalCues), translated = [];
    const request = async text => {
      if (!stillCurrent()) throw new Error('Translation cancelled');
      const url = translationUrl(text, target); let data;
      if (Capacitor.isNativePlatform()) {
        const res = await CapacitorHttp.get({ url, responseType: 'json' });
        if (res.status < 200 || res.status >= 300) throw new Error(`Google HTTP ${res.status}`);
        data = res.data;
      } else {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Google HTTP ${res.status}`);
        data = await res.json();
      }
      return translatedText(data);
    };
    for (let i = 0; i < groups.length; i++) {
      if (!stillCurrent()) return;
      status.textContent = `وەرگێڕان... ${i + 1} / ${groups.length}`;
      translated.push(...await translateGroup(groups[i], request));
    }
    if (!stillCurrent()) return;
    translations[target] = translated; installCues(translated, `Google · ${target}`, 'translated'); status.textContent = 'وەرگێڕان تەواو بوو.'; document.querySelector('#subtitle-status').textContent = `وەرگێڕدراوە بۆ ${target}`;
  } catch (error) { if (stillCurrent()) status.textContent = `وەرگێڕان سەرکەوتوو نەبوو: ${error.message}`; }
  finally { if (session === playerSession) { button.disabled = false; if (version !== subtitleVersion) status.textContent = 'ژێرنووسەکە گۆڕدرا؛ دووبارە وەرگێڕان دەست پێ بکە.'; } }
}
app.addEventListener('click', e => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'donkey') openDonkey(donkeyHome);
  if (action === 'add') addDialog(); if (action === 'help') helpDialog(); if (action === 'close') closeModal(); if (action === 'close-player') closePlayer();
  const play = e.target.closest('[data-play]'); if (play) { const movie = findMovie(play.dataset.play); if (movie && isDonkeyPage(movie.url)) openDonkey(movie.url); else openPlayer(movie); }
  const del = e.target.closest('[data-delete]'); if (del && confirm('ئەم فیلمە لە کتێبخانە بسڕدرێتەوە؟')) { library = library.filter(m => m.id !== del.dataset.delete); saveLibrary(); render(); toast('فیلمەکە سڕایەوە.'); }
  if (e.target.closest('#translate')) translateCues();
  if (e.target.closest('#more-movies')) loadDiscovery(discoveryQuery, discoveryPage + 1);
  if (e.target.id === 'modal') closeModal();
});
app.addEventListener('submit', e => {
  if (e.target.id !== 'add-form') return; e.preventDefault(); const form = new FormData(e.target); const title = String(form.get('title')).trim(), url = String(form.get('url')).trim(), subtitle = String(form.get('subtitle')).trim();
  if (!title || !validUrl(url) || (subtitle && !validUrl(subtitle))) { toast('ناو و لینکێکی دروست بنووسە.'); return; }
  library.unshift({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, title, url, subtitle: isDonkeyPage(url) ? '' : subtitle, type: 'فیلمی من' }); saveLibrary(); closeModal(); render(); toast('فیلمەکە زیادکرا.');
});
app.addEventListener('input', e => {
  if (e.target.id !== 'catalog-search') return;
  const query = e.target.value;
  discoverySeq++; clearTimeout(discoveryTimer); discovery = []; discoveryPage = 0; discoveryQuery = query;
  drawCatalog();
  document.querySelector('#discovery-status').textContent = 'گەڕان...';
  discoveryTimer = setTimeout(() => loadDiscovery(query, 1), 400);
});
app.addEventListener('change', async e => {
  if (e.target.id === 'subtitle-file') { const file = e.target.files[0], session = playerSession, requestId = ++subtitleRequest; if (!file) return; try { const text = await file.text(); if (session === playerSession && requestId === subtitleRequest) loadSubtitle(text); } catch (error) { if (session === playerSession && requestId === subtitleRequest) document.querySelector('#subtitle-status').textContent = error.message; } }
  if (e.target.id === 'subtitle-source' && e.target.value) loadSubtitleUrl(e.target.value);
  if (e.target.id === 'track-select') { const video = document.querySelector('#video'); Array.from(video.textTracks).forEach((t, i) => { t.mode = String(i) === e.target.value ? 'showing' : 'disabled'; }); }
  if (e.target.id === 'language') document.querySelector('#custom-language-label').classList.toggle('hidden', e.target.value !== 'custom');
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!document.querySelector('#modal').classList.contains('hidden')) closeModal(); else if (current) closePlayer(); } });
render();
