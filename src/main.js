import './style.css';
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { createIcons, Play, Plus, Clapperboard, Captions, Languages, Smartphone, ArrowUpLeft, Trash2, Sparkles, Search, X, Upload, House, Bookmark, ChevronLeft, Film } from 'lucide';
import { parseSubtitles, toVtt } from './subtitles.js';
import { translationGroups, translationUrl, translatedText, translateGroup } from './translate.js';
import { searchMovies } from './catalog.js';
import { movies } from './movies.js';
import { metadataUrl, archiveFiles } from './archive.js';
import { catalogUrl, mergeCatalogPage, catalogResults } from './cinemeta.js';
import { isDonkeyPage } from './donkey.js';
import { movieEmbedUrl, seriesEmbedUrl } from './vidlink-embed.js';
import { asianCatalogUrl, asianCatalogResults, asianSeedIds, asianMetadataUrl, koreanDramaSearchUrl, subtitleIndexUrl, hasEnglishSubtitle } from './asian-catalog.js';
import { createCatalogCache } from './catalog-cache.js';
import { createEmbeddedSubtitles } from './embedded-subtitles.js';
import { findMovieSubtitles } from './subtitle-discovery.js';
import { translateMenuSubtitles, withSubtitleTrack, createMenuTranslationCache } from './menu-subtitles.js';
import { findUpdate, releaseApi } from './update.js';

const languages = [['ckb','کوردی سۆرانی'],['en','English'],['ar','العربية'],['ku','Kurdî (Kurmancî)'],['tr','Türkçe'],['fa','فارسی'],['fr','Français'],['de','Deutsch'],['es','Español'],['hi','हिन्दी'],['ja','日本語'],['ko','한국어'],['zh-CN','中文']];
const DonkeyPlayer = registerPlugin('DonkeyPlayer');
const MenuSubtitle = registerPlugin('MenuSubtitle');
const Updater = registerPlugin('Updater');
let availableUpdate = null;
const nativeMenuAvailable = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('MenuSubtitle');
const app = document.querySelector('#app');
const icons = { Play, Plus, Clapperboard, Captions, Languages, Smartphone, ArrowUpLeft, Trash2, Sparkles, Search, X, Upload, House, Bookmark, ChevronLeft, Film };
const getCatalog = createCatalogCache(getJson);
const menuTranslationCache = createMenuTranslationCache();
let library = readLibrary();
let current = null, hls = null, subtitleUrls = {}, originalCues = null, playerSession = 0, subtitleVersion = 0, subtitleRequest = 0, translations = {}, playerTimer;
let embeddedSubtitles = null, embeddedSourceRequest = 0, embeddedHasSource = false, embeddedOffset = 0;
let embeddedMenuSource = null, embeddedMenuToken = null, embeddedTime = 0;
const genres = [['all','هەمووی'], ['Action','ئەکشن'], ['Adventure','سەرکێشی'], ['Comedy','کۆمیدی'], ['Drama','دراما'], ['Horror','ترسناک'], ['Thriller','هیجان'], ['Crime','تاوان'], ['Mystery','نهێنی'], ['Romance','ڕۆمانسی'], ['Sci-Fi','زانستی خەیاڵی'], ['Fantasy','خەیاڵی'], ['Animation','ئەنیمەیشن'], ['Biography','ژیاننامە'], ['Sport','وەرزشی'], ['Family','خێزانی'], ['Documentary','دۆکیومێنتاری'], ['History','مێژوویی'], ['War','جەنگ'], ['Western','وێستەرن']];
const shelves = [{id:'popular', genre:'', title:'بەناوبانگەکان', subtitle:'فیلمەکانی سەر زارەکان'}, {id:'action', genre:'Action', title:'ئەکشن و سەرکێشی', subtitle:'بۆ دەمێکی پڕ لە هیجان'}, {id:'horror', genre:'Horror', title:'جیهانی ترس', subtitle:'بۆ ئەوانەی دڵێکی بوێریان هەیە'}];
let shelfMovies = [], asianMovies = [], asianObserver;
let asianState = {};
const asianShelves = [{id:'koreanMovie', title:'سینەمای کۆری', subtitle:'فیلم لە کۆریا'}, {id:'korean', title:'درامای کۆری', subtitle:'زنجیرە کۆرییەکان'}, {id:'japanese', title:'سینەمای ژاپۆنی', subtitle:'فیلم لە ژاپۆن'}, {id:'chinese', title:'سینەمای چینی', subtitle:'فیلم لە چین، هۆنگ کۆنگ و تایوان'}];
let discovery = [], discoveryQuery = '', discoveryGenre = '', discoveryPage = 0, discoverySeq = 0, discoveryTimer, discoveryMore = false, discoveryLoading = false, discoveryAuto = true, discoveryObserver;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function readLibrary() { try { const value = JSON.parse(localStorage.getItem('dimo-library') || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function saveLibrary() { localStorage.setItem('dimo-library', JSON.stringify(library)); }
function icon(name, cls = '') { return `<i data-lucide="${name}" class="${cls}"></i>`; }
function paintIcons() { createIcons({ icons }); }
function render() {
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <a href="#home" class="brand" aria-label="Kurd Movie، سەرەتا"><span class="brand-mark">${icon('play')}</span><span class="brand-word" dir="ltr">KURD <span>MOVIE</span></span></a>
        <nav aria-label="گەڕان"><a class="nav-active" href="#home">سەرەتا</a><a href="#catalog">فیلمەکان</a><a href="#genres">جۆرەکان</a><button class="nav-library" data-action="library">لیستەکەم</button></nav>
        <div class="header-actions"><button class="update-check" data-action="check-update" aria-label="پشکنینی نوێکاری">${icon('sparkles')}<span class="update-dot hidden"></span></button><button class="header-search" data-action="focus-search" aria-label="گەڕان">${icon('search')}</button><button class="top-add" data-action="library">${icon('bookmark')} <span>لیستەکەم</span></button></div>
      </header>
      <main id="home">
        <section class="hero" aria-label="پێشوازی">
          <div class="hero-shade"></div><div class="hero-content">
            <div class="eyebrow"><span></span> <span dir="ltr">KURD MOVIE</span> · جیهانی سینەما</div>
            <h1>چیرۆکەکان<br><em>لێرە دەست پێدەکەن.</em></h1>
            <p>لە جیهانێک فیلمدا، چیرۆکی دڵخوازت بدۆزەرەوە و بە زمانی خۆت سەیری بکە.</p>
            <div class="hero-actions"><button class="primary" data-play="cinebloom-155">${icon('play')} سەیری <span dir="ltr">The Dark Knight</span></button><a class="ghost" href="#catalog">${icon('film')} دۆزینەوەی فیلم</a></div>
            <div class="hero-caption"><span>✦</span> چیرۆکی زۆر، یەک شوێن</div>
          </div><div class="hero-index"><span>KURD MOVIE</span><div></div> A WORLD OF STORIES</div>
        </section>
        <div class="shelf-intro"><div><span class="overline">CURATED FOR YOU</span><h2>ئەمڕۆ چی دەبینین؟ <span>✳</span></h2><p>چیرۆکێکی نوێ چاوەڕێتە.</p></div><a href="#catalog">هەموو فیلمەکان ${icon('arrow-up-left')}</a></div>
        <div class="shelf-list">${shelves.map(shelf => `<section class="shelf" aria-labelledby="shelf-title-${shelf.id}"><div class="shelf-heading"><div><h2 id="shelf-title-${shelf.id}">${shelf.title}</h2><p>${shelf.subtitle}</p></div><button class="shelf-more" data-genre="${shelf.genre || 'all'}">هەمووی ${icon('chevron-left')}</button></div><div class="shelf-rail" id="shelf-${shelf.id}"><div class="shelf-loading">فیلمەکان بار دەکرێن...</div></div></section>`).join('')}</div>
        <div class="asian-section" id="asian"><div class="shelf-intro asian-intro"><div><span class="overline">ASIAN CINEMA</span><h2>چیرۆکەکانی ئاسیا <span>✳</span></h2><p>دراما و فیلم، لە کۆریا تا ژاپۆن و چین.</p></div></div><p class="asian-notice">تەنها ئەو ناونیشانانە نیشان دەدرێن کە ژێرنووسی ئینگلیزییان لە سەرچاوەی ژێرنووس دۆزراوەتەوە؛ بەردەستبوونی پەخش و CC دەکرێت بگۆڕێت.</p>${asianShelves.map(shelf => `<section class="shelf" aria-labelledby="asian-title-${shelf.id}"><div class="shelf-heading"><div><h2 id="asian-title-${shelf.id}">${shelf.title}</h2><p>${shelf.subtitle}</p></div><button class="shelf-more" data-asian-more="${shelf.id}">زیاتر ${icon('chevron-left')}</button></div><div class="shelf-rail" id="asian-${shelf.id}"><div class="shelf-loading">گەڕان بۆ فیلم و ژێرنووس...</div></div><p class="asian-status" id="asian-status-${shelf.id}" role="status"></p></section>`).join('')}</div>
        <section class="catalog" id="catalog">
          <div class="section-head catalog-head"><div><span class="overline">EXPLORE MOVIES</span><h2>بگەڕێ و بدۆزەرەوە <span>✳</span></h2><p>بەپێی دڵت فیلمێک هەڵبژێرە.</p></div><label class="catalog-search"><span class="sr-only">گەڕان بە ناوی فیلم</span>${icon('search')}<input id="catalog-search" type="search" placeholder="ناوی فیلمێک بگەڕێ..." autocomplete="off"></label></div>
          <div class="genre-label" id="genres"><span>بەپێی جۆر</span><span>جیهانێک بۆ دۆزینەوە</span></div>
          <div class="catalog-filters" role="group" aria-label="جۆری فیلم">${genres.map(([value, label]) => `<button type="button" data-genre="${value}" aria-pressed="${value === (discoveryGenre || 'all')}">${label}</button>`).join('')}</div>
          <p class="catalog-notice">بۆ فیلمی زیاتر بچۆ خوارەوە · بەردەستبوونی پەخش و ژێرنووس بە سەرچاوەکە پەیوەستە.</p>
          <div id="catalog-cards" class="catalog-cards">${catalogCards(localCatalogMovies(''))}</div>
          <p id="catalog-empty" class="catalog-empty hidden">هیچ فیلمێک بەم ناوە نەدۆزرایەوە.</p><p id="discovery-status" class="form-hint" role="status"></p><button id="more-movies" class="ghost hidden" type="button">فیلمی زیاتر</button>
        </section>
      </main>
      <footer><span class="footer-brand" dir="ltr">KURD MOVIE <span>✳</span></span><span>بۆ خۆشەویستانی چیرۆک و سینەما</span><span>A WORLD OF STORIES</span></footer>
      <div class="mobile-nav" aria-label="گەڕانی مۆبایل"><a href="#home">${icon('house')}<span>سەرەتا</span></a><a href="#catalog">${icon('search')}<span>گەڕان</span></a><a href="#genres">${icon('film')}<span>جۆرەکان</span></a><button data-action="library">${icon('bookmark')}<span>لیستەکەم</span></button></div>
    </div>
    <div class="overlay hidden" id="modal" role="dialog" aria-modal="true"></div>
    <div class="overlay hidden player-overlay" id="player-modal" role="dialog" aria-modal="true"></div>
    <div class="toast hidden" role="status"></div>`;
  paintIcons();
  discoveryObserver?.disconnect();
  discoveryMore = false; discoveryLoading = false; discoveryAuto = true;
  if ('IntersectionObserver' in window) {
    discoveryObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && discoveryAuto && discoveryMore && !discoveryLoading && !discoveryQuery.trim()) {
        loadDiscovery(discoveryQuery, discoveryPage + 1);
      }
    }, { rootMargin: '500px' });
    discoveryObserver.observe(document.querySelector('#more-movies'));
  }
  loadDiscovery('', 1);
  loadShelves();
  asianMovies = []; asianState = {};
  asianObserver?.disconnect();
  if ('IntersectionObserver' in window) {
    asianObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { asianObserver?.disconnect(); asianShelves.forEach(shelf => loadAsian(shelf.id)); }
    }, { rootMargin: '600px' });
    asianObserver.observe(document.querySelector('#asian'));
  } else asianShelves.forEach(shelf => loadAsian(shelf.id));
  if (Capacitor.isNativePlatform()) checkForUpdate(false);
}
function catalogCards(items) {
  return items.map(movie => `<article class="catalog-card"><button class="catalog-movie" data-play="${escapeHtml(movie.id)}" aria-label="سەیرکردنی ${escapeHtml(movie.title)}"><div class="catalog-poster"><img src="${escapeHtml(movie.poster)}" alt="" loading="lazy" decoding="async"><span class="catalog-badge">${escapeHtml(movie.year || 'FREE')}</span><span class="catalog-open">${icon('play')}</span></div><h3 dir="auto">${escapeHtml(movie.title)}</h3><p dir="auto">${escapeHtml(movie.type || 'فیلم')} · STREAMING</p></button></article>`).join('');
}
async function loadShelves() {
  shelfMovies = [];
  await Promise.all(shelves.map(async shelf => {
    const rail = document.querySelector(`#shelf-${shelf.id}`);
    if (!rail) return;
    try {
      const items = catalogResults(await getCatalog(catalogUrl('', 1, shelf.genre))).slice(0, 16);
      if (!rail.isConnected) return;
      shelfMovies.push(...items);
      rail.innerHTML = items.length ? catalogCards(items) : '<p class="shelf-loading">فیلمێک نەدۆزرایەوە.</p>';
      paintIcons();
    } catch {
      if (rail.isConnected) rail.innerHTML = '<p class="shelf-loading">فیلمەکان بار نەبوون؛ ئینتەرنێت بپشکنە.</p>';
    }
  }));
}
async function mapLimited(items, limit, task) {
  const results = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; results[i] = await task(items[i]); }
  }));
  return results;
}
async function loadKoreanSearch(query, seq) {
  try {
    const data = await getCatalog(koreanDramaSearchUrl(query));
    // Search responses often omit country, genres and TMDB IDs; enrich each
    // result from Cinemeta before applying the same shelf validation.
    const ids = [...new Set((data.metas || []).map(item => item?.id).filter(id => /^tt\d{5,12}$/.test(id || '')))].slice(0, 20);
    const metadata = await mapLimited(ids, 3, id => subtitleHttp(asianMetadataUrl('korean', id), 'json').catch(() => null));
    if (seq !== discoverySeq) return;
    const candidates = metadata.flatMap(data => data?.meta ? asianCatalogResults('korean', {metas:[data.meta]}) : []);
    const verified = new Array(candidates.length); let next = 0;
    await Promise.all(Array.from({length: Math.min(3, candidates.length)}, async () => {
      while (next < candidates.length && seq === discoverySeq) {
        const i = next++;
        try { if (hasEnglishSubtitle(await subtitleHttp(subtitleIndexUrl(candidates[i]), 'json'))) verified[i] = candidates[i]; } catch { /* subtitle index unavailable */ }
      }
    }));
    if (seq !== discoverySeq) return;
    const known = new Set(discovery.map(item => item.id));
    const items = verified.filter(item => item && !known.has(item.id));
    if (!items.length) return;
    discovery.push(...items); drawCatalog();
    document.querySelector('#discovery-status').textContent = `${discovery.length.toLocaleString()} ئەنجامی فیلم و دراما بارکرا.`;
  } catch { /* Movie results remain usable if series search fails. */ }
}
async function loadAsian(region) {
  const rail = document.querySelector(`#asian-${region}`);
  const status = document.querySelector(`#asian-status-${region}`);
  const button = document.querySelector(`[data-asian-more="${region}"]`);
  if (!rail || !status || !button || !asianShelves.some(s => s.id === region)) return;
  const state = asianState[region] ||= { page: 0, loading: false, seen: new Set(), count: 0 };
  if (state.loading) return;
  state.loading = true; button.disabled = true;
  status.textContent = 'گەڕان و پشکنینی ژێرنووس...';
  try {
    const pages = Array.from({ length: 8 }, (_, i) => state.page + i + 1);
    const [batches, seedResults] = await Promise.all([
      Promise.all(pages.map(page => getCatalog(asianCatalogUrl(region, page)))),
      state.page === 0 ? mapLimited(asianSeedIds[region], 3, id => subtitleHttp(asianMetadataUrl(region, id), 'json').catch(() => null)) : [],
    ]);
    if (!rail.isConnected || asianState[region] !== state) return;
    state.page += batches.length;
    const seeds = seedResults.flatMap(data => data?.meta ? asianCatalogResults(region, { metas: [data.meta] }) : []);
    const candidates = [...seeds, ...batches.flatMap(data => asianCatalogResults(region, data))].filter(item => {
      if (state.seen.has(item.id)) return false;
      state.seen.add(item.id); return true;
    });
    const verified = new Array(candidates.length); let next = 0;
    await Promise.all(Array.from({length: Math.min(3, candidates.length)}, async () => {
      while (next < candidates.length) {
        const i = next++;
        try { if (hasEnglishSubtitle(await subtitleHttp(subtitleIndexUrl(candidates[i]), 'json'))) verified[i] = candidates[i]; } catch { /* Do not claim an unverified subtitle. */ }
      }
    }));
    if (!rail.isConnected || asianState[region] !== state) return;
    const items = verified.filter(Boolean);
    asianMovies.push(...items); state.count += items.length;
    if (state.page === batches.length) rail.innerHTML = '';
    if (items.length) rail.insertAdjacentHTML('beforeend', catalogCards(items));
    if (!state.count) rail.innerHTML = '<p class="shelf-loading">لە ئەم پەڕانەدا ژێرنووس نەدۆزرایەوە؛ زیاتر دابگرە.</p>';
    else if (items.length) rail.querySelector('.shelf-loading')?.remove();
    status.textContent = `${state.count.toLocaleString()} ناونیشان · ژێرنووسی ئینگلیزی دۆزراوەتەوە`;
    paintIcons();
  } catch {
    if (rail.isConnected) status.textContent = 'بارکردن سەرکەوتوو نەبوو؛ دووبارە هەوڵ بدە.';
  } finally { state.loading = false; if (button.isConnected) button.disabled = false; }
}
function embeddedUrl(movie) {
  return movie.mediaKind === 'series' ? seriesEmbedUrl(movie.tmdbId, movie.season || 1, movie.episode || 1) : movieEmbedUrl(movie.tmdbId || movie.imdbId);
}
async function checkForUpdate(interactive = true) {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('Updater')) {
    if (interactive) toast('پشکنینی نوێکاری بۆ بەرنامەی Android ـە.');
    return;
  }
  if (interactive) toast('پشکنینی نوێکاری...');
  try {
    const info = await Updater.getVersion();
    const response = await CapacitorHttp.get({ url: releaseApi, responseType: 'json', connectTimeout: 10000, readTimeout: 10000 });
    if (response.status !== 200) throw new Error('Update check failed');
    const releases = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    availableUpdate = findUpdate(releases, info.versionCode);
    document.querySelector('.update-dot')?.classList.toggle('hidden', !availableUpdate);
    if (availableUpdate) {
      if (interactive) updateDialog();
      else toast('وەشانێکی نوێ بەردەستە؛ دوگمەی نوێکاری دابگرە.');
    } else if (interactive) toast('بەرنامەکەت نوێترین وەشانە.');
  } catch { if (interactive) toast('نوێکاری نەشکنرا؛ ئینتەرنێت بپشکنە.'); }
}
function updateDialog() {
  if (!availableUpdate) return;
  openModal(`<div class="dialog-header"><div><span class="overline">KURD MOVIE UPDATE</span><h2>وەشانێکی نوێ ئامادەیە</h2></div><button class="icon-button" data-action="close" aria-label="داخستن">${icon('x')}</button></div><p class="dialog-desc">وەشانی ${availableUpdate.version} بەردەستە. دوای دابەزین، لە ئاگادارکردنەوەکە دایمەزرێنە؛ پەسەندکردنی Android و یەکسانبوونی واژۆی وەشانەکان پێویستە.</p><button class="primary full" data-action="download-update">${icon('sparkles')} نوێکردنەوە</button>`);
}
async function downloadUpdate() {
  if (!availableUpdate) return;
  try { await Updater.download({ url: availableUpdate.url }); closeModal(); toast('نوێکاری دادەبەزێت؛ پاش تەواوبوون ئاگادارکردنەوەکە دابگرە.'); }
  catch { toast('دابەزاندنی نوێکاری سەرکەوتوو نەبوو.'); }
}
function openModal(content) { const m = document.querySelector('#modal'); m.innerHTML = `<div class="dialog">${content}</div>`; m.classList.remove('hidden'); paintIcons(); }
function closeModal() { document.querySelector('#modal').classList.add('hidden'); }
function libraryDialog() {
  const items = library.map(movie => `<div class="saved-row"><button class="saved-title" data-play="${escapeHtml(movie.id)}"><span class="saved-icon">${icon('play')}</span><span dir="auto">${escapeHtml(movie.title)}</span></button><button class="delete" data-delete="${escapeHtml(movie.id)}" aria-label="سڕینەوەی ${escapeHtml(movie.title)}">${icon('trash-2')}</button></div>`).join('');
  openModal(`<div class="dialog-header"><div><span class="overline">YOUR LIST</span><h2>لیستەکەم</h2></div><button class="icon-button" data-action="close" aria-label="داخستن">${icon('x')}</button></div><p class="dialog-desc">فیلم و لینکە پاشەکەوتکراوەکانت لێرەن.</p><div class="saved-list">${items || '<p class="saved-empty">هێشتا هیچ فیلمێکت زیاد نەکردووە.</p>'}</div><button class="primary full" data-action="add">${icon('plus')} لینکی فیلم زیاد بکە</button>`);
}
function addDialog() {
  openModal(`<div class="dialog-header"><div><span class="overline">YOUR COLLECTION</span><h2>فیلمێک زیاد بکە</h2></div><button class="icon-button" data-action="close" aria-label="داخستن">${icon('x')}</button></div><p class="dialog-desc">لینکی فیلم یان ماڵپەڕی فیلمێک دابنێ.</p><form id="add-form"><label>ناوی فیلم <input required name="title" maxlength="100" placeholder="ناوی فیلمەکە بنووسە"></label><label>لینکی ستریم <input required name="url" type="url" dir="ltr" placeholder="https://example.com/movie.m3u8"></label><label>لینکی ژێرنووس <span class="optional">ئیختیاری · SRT / VTT</span><input name="subtitle" type="url" dir="ltr" placeholder="https://example.com/subtitle.srt"></label><p class="form-hint">بۆ پلەیەری Kurd Movie، لینکەکە دەبێت HTTPS و ڕاستەوخۆ بۆ MP4، WebM یان HLS بێت. لینکی ماڵپەڕ لە پلەیەری ماڵپەڕەکە دەکرێتەوە؛ ژێرنووسی Kurd Movie بۆی کار ناکات.</p><button class="primary full" type="submit">${icon('plus')} زیادکردن بۆ کتێبخانە</button></form>`);
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
function findMovie(id) { return [...library, ...movies, ...discovery, ...shelfMovies, ...asianMovies].find(m => m.id === id); }
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
function localCatalogMovies(query) {
  return searchMovies(query).filter(movie => !movie.credit && (!discoveryGenre || (discoveryGenre === 'Horror' && movie.type?.includes('ترسناک'))));
}
function updateGenreButtons() {
  document.querySelectorAll('.catalog-filters [data-genre]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.genre === (discoveryGenre || 'all'))));
}
function drawCatalog(appendFrom = null) {
  const local = localCatalogMovies(discoveryQuery);
  const ids = new Set(local.map(movie => movie.imdbId).filter(Boolean));
  const items = [...local, ...discovery.filter(movie => !ids.has(movie.imdbId))];
  const container = document.querySelector('#catalog-cards');
  if (appendFrom === null) container.innerHTML = catalogCards(items);
  else container.insertAdjacentHTML('beforeend', catalogCards(discovery.slice(appendFrom).filter(movie => !ids.has(movie.imdbId))));
  document.querySelector('#catalog-empty').classList.toggle('hidden', items.length > 0 || discoveryPage === 0);
  document.querySelector('#more-movies').classList.toggle('hidden', !discoveryMore);
  paintIcons();
}
async function loadDiscovery(query, page) {
  if (discoveryLoading) return;
  const seq = ++discoverySeq; discoveryQuery = query; discoveryLoading = true;
  const status = document.querySelector('#discovery-status'); if (!status) { discoveryLoading = false; return; }
  const button = document.querySelector('#more-movies'); button.disabled = true;
  status.textContent = 'فیلمەکان بار دەکرێن...';
  try {
    const result = mergeCatalogPage(discovery, await getCatalog(catalogUrl(query, page, discoveryGenre)), query, page);
    if (seq !== discoverySeq) return;
    const previousCount = discovery.length;
    discovery = result.movies; discoveryMore = result.hasMore; discoveryAuto = true;
    discoveryPage = page; button.textContent = 'فیلمی زیاتر'; drawCatalog(page > 1 ? previousCount : null);
    status.textContent = discovery.length ? `${discovery.length.toLocaleString()} فیلم بارکرا؛ بەردەستبوونی پەخش بە سەرچاوەکە پەیوەستە.` : 'ئەنجامی زیاتری بەردەست نییە.';
    if (query.trim()) loadKoreanSearch(query, seq);
  } catch {
    if (seq === discoverySeq) {
      discoveryMore = page > 1 && discovery.length > 0; discoveryAuto = false;
      button.textContent = 'دووبارە هەوڵ بدە';
      status.textContent = 'فیلمەکان بار نەبوون؛ ئینتەرنێت بپشکنە و دووبارە هەوڵ بدە.'; drawCatalog();
    }
  } finally { if (seq === discoverySeq) { discoveryLoading = false; button.disabled = false; } }
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
async function playDirect(url, format) {
  const video = document.querySelector('#video'), session = playerSession;
  if (!video) return;
  if (format === 'hls' || /\.m3u8(?:[?#]|$)/i.test(url)) {
    try {
      const { default: Hls } = await import('hls.js');
      if (session !== playerSession || video !== document.querySelector('#video')) return;
      if (Hls.isSupported()) {
        hls = new Hls(); hls.loadSource(url); hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal && session === playerSession) document.querySelector('#player-message').textContent = 'ستریمەکە بار نەبوو؛ لینک و دەستڕاگەیشتنی CORS بپشکنە.'; });
      } else video.src = url;
    } catch {
      if (session === playerSession) document.querySelector('#player-message').textContent = 'پلەیەری HLS بار نەبوو؛ ئینتەرنێت بپشکنە.';
      return;
    }
  } else video.src = url;
  video.play().catch(() => {});
}
function startEmbeddedPlayer(frame, session) {
  clearTimeout(playerTimer);
  const status = document.querySelector('#embedded-status');
  const loading = document.querySelector('#embedded-loading');
  if (!frame || !status || !loading) return;
  loading.classList.remove('hidden');
  status.textContent = 'پلەیەرەکە بار دەکرێت...';
  playerTimer = setTimeout(() => {
    if (session !== playerSession) return;
    loading.classList.add('hidden');
    status.textContent = 'ئەگەر پەخشەکە درێژی کێشا، دووبارە هەوڵ بدە یان لە پەڕەیەکی تر بیکەرەوە.';
  }, 20000);
}
async function subtitleHttp(url, responseType) {
  if (Capacitor.isNativePlatform()) {
    const result = await CapacitorHttp.get({ url, responseType, connectTimeout: 10000, readTimeout: 10000 });
    if (result.status < 200 || result.status >= 300) throw new Error(`HTTP ${result.status}`);
    return responseType === 'json' && typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
  }
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return responseType === 'json' ? response.json() : response.text();
  } finally { clearTimeout(timer); }
}
async function providerEnglishSubtitle(movie, valid) {
  // Prefer the player's own English track so its timing matches this stream.
  let id = String(movie.tmdbId || '');
  if (!/^\d{1,12}$/.test(id) && /^tt\d{5,12}$/.test(movie.imdbId || '')) {
    const meta = await subtitleHttp(`https://v3-cinemeta.strem.io/meta/movie/${movie.imdbId}.json`, 'json');
    id = String(meta?.meta?.moviedb_id || '');
  }
  if (!valid() || !/^\d{1,12}$/.test(id)) throw new Error('No movie ID');
  const { movieSourceUrl, movieSources } = await import('./vidlink.js');
  const data = await subtitleHttp(movieSourceUrl(id), 'json');
  if (!valid()) throw new Error('Cancelled');
  const track = movieSources(data).subtitles.find(item => /english|\beng?\b/i.test(item.label));
  if (!track || new URL(track.url).hostname !== 'cacdn.hakunaymatata.com') throw new Error('No player subtitle');
  const text = await subtitleHttp(track.url, 'text');
  if (typeof text !== 'string' || text.length > 2_000_000 || parseSubtitles(text).length < 10) throw new Error('Invalid player subtitle');
  return text;
}
async function googleTranslateForMenu(text, target) {
  const base = translationUrl(text, target);
  let lastError;
  // Android's default HTTP user agent is rejected by Google's unofficial web
  // endpoint on some networks; a neutral user agent avoids that rejection.
  for (const client of ['gtx', 'at']) {
    const url = new URL(base); url.searchParams.set('client', client);
    try {
      const response = await CapacitorHttp.get({ url: url.href, responseType: 'json', headers: { 'User-Agent': 'node' }, connectTimeout: 12000, readTimeout: 12000 });
      if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}`);
      return translatedText(response.data);
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Translation unavailable');
}
async function translateForPlayerMenu(text, session, requestId) {
  const valid = () => session === playerSession && requestId === embeddedSourceRequest && embeddedSubtitles;
  const status = message => { if (valid()) document.querySelector('#embedded-subtitle-status').textContent = message; };
  const buttons = document.querySelectorAll('[data-action="enable-menu-subtitle"]');
  buttons.forEach(button => button.classList.add('hidden'));
  let progress = '';
  try {
    status('Google ژێرنووسەکە بۆ کوردی سۆرانی وەردەگێڕێت...');
    let vtt = menuTranslationCache.get(text);
    if (!vtt) {
      vtt = await translateMenuSubtitles(text, googleTranslateForMenu, {
        isCurrent: valid, onProgress: (done, total) => { progress = `${done}/${total}`; status(`وەرگێڕانی Google... ${done} / ${total}`); },
      });
      if (!valid()) return;
      menuTranslationCache.set(text, vtt);
    }
    if (!valid()) return;
    const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    await MenuSubtitle.setTrack({ token, text: vtt });
    if (!valid()) { await MenuSubtitle.clear({ token }); return; }
    if (embeddedMenuToken) MenuSubtitle.clear({ token: embeddedMenuToken }).catch(() => {});
    embeddedMenuToken = token;
    status('وەرگێڕان تەواو بوو؛ دوگمەکە دابگرە تا سۆرانی بێتە لیستی CC.');
    buttons.forEach(button => button.classList.remove('hidden'));
  } catch (error) {
    const detail = /^HTTP \d{3}$/.test(error?.message || '') ? error.message : 'network error';
    status(`وەرگێڕانی Google تەواو نەبوو؛ دووبارە هەوڵ بدە. (${detail}${progress ? ` · ${progress}` : ''})`);
  }
}
async function loadEmbeddedSource(movie, session) {
  const requestId = ++embeddedSourceRequest;
  const valid = () => session === playerSession && requestId === embeddedSourceRequest && embeddedSubtitles;
  const status = text => { if (valid()) document.querySelector('#embedded-subtitle-status').textContent = text; };
  status('گەڕان بۆ ژێرنووس بۆ وەرگێڕانی Google...');
  try {
    let text;
    if (nativeMenuAvailable() && movie.mediaKind !== 'series') {
      try { text = await providerEnglishSubtitle(movie, valid); } catch { /* use an independent track when the player API is blocked */ }
    }
    if (!valid()) return;
    if (!text) text = await findMovieSubtitles(movie.imdbId, {
      json: url => subtitleHttp(url, 'json'), text: url => subtitleHttp(url, 'text'), isCurrent: valid,
      ...(movie.mediaKind === 'series' ? { episode: { season: movie.season || 1, episode: movie.episode || 1 } } : {}),
    });
    if (!valid()) return;
    embeddedHasSource = true;
    if (nativeMenuAvailable()) { embeddedMenuSource = text; translateForPlayerMenu(text, session, requestId); }
    else embeddedSubtitles.setCues(text);
  } catch {
    status('ژێرنووسی ئەم فیلمە نەدۆزرایەوە؛ ناتوانرێت بە Google وەرگێڕدرێت.');
  }
}
function startEmbeddedSubtitles(movie, session) {
  embeddedSubtitles?.destroy(); embeddedHasSource = false; embeddedOffset = 0; embeddedMenuSource = null; embeddedMenuToken = null; embeddedTime = 0;
  embeddedSubtitles = createEmbeddedSubtitles({
    request: async (text, target) => translatedText(await getJson(translationUrl(text, target))),
    onText: text => { const el = document.querySelector('#embedded-subtitle-text'); if (el && session === playerSession) el.textContent = text; },
    onStatus: text => { const el = document.querySelector('#embedded-subtitle-status'); if (el && session === playerSession) el.textContent = text; },
  });
  if (nativeMenuAvailable()) {
    embeddedSubtitles.setTarget('off');
    document.querySelector('#embedded-language').disabled = true;
    document.querySelector('.subtitle-timing').classList.add('hidden');
    document.querySelector('#menu-subtitle-hint').classList.remove('hidden');
  }
  loadEmbeddedSource(movie, session);
}
function openPlayer(movie) {
  if (!movie) return;
  playerSession++; subtitleRequest++; current = movie; originalCues = null; translations = {};
  const modal = document.querySelector('#player-modal');
  if (movie.tmdbId || movie.imdbId) {
    const url = embeddedUrl(movie);
    modal.innerHTML = `<div class="player-dialog"><div class="player-head"><div><span class="overline">NOW PLAYING</span><h2 dir="auto">${escapeHtml(movie.title)}</h2></div><button class="icon-button" data-action="close-player" aria-label="داخستن">${icon('x')}</button></div><div class="video-wrap embedded-wrap"><div id="embedded-loading" class="player-loading" role="status"><span class="loading-ring"></span><span>پلەیەرەکە بار دەکرێت...</span></div><iframe src="${url}" title="${escapeHtml(movie.title)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe><button type="button" class="embedded-fullscreen-button" data-action="subtitle-fullscreen">⛶ شاشەی پڕ · کوردی</button><button type="button" class="embedded-menu-ready hidden" data-action="enable-menu-subtitle">سۆرانی بۆ لیستی CC</button><div id="embedded-subtitle-text" class="embedded-subtitle-text" dir="auto" aria-live="off"></div><button type="button" class="dimo-fullscreen-exit" data-action="exit-subtitle-fullscreen" aria-label="دەرچوون لە شاشەی پڕ">✕</button></div>${movie.mediaKind === 'series' ? `<div class="episode-controls"><label>وەرز<input id="episode-season" type="number" min="1" max="999" value="${movie.season || 1}"></label><label>ئەڵقە<input id="episode-number" type="number" min="1" max="9999" value="${movie.episode || 1}"></label><button class="ghost" type="button" data-action="play-episode">سەیرکردن</button></div>` : ''}<p id="embedded-status" class="player-message" role="status">پلەیەرەکە بار دەکرێت...</p><div class="player-actions"><button class="ghost" type="button" data-action="retry-player">دووبارە بارکردنەوە</button><a class="text-button" href="${url}" target="_blank" rel="noopener noreferrer">کردنەوە لە پەڕەیەکی تر ↗</a></div><div class="subtitle-panel embedded-subtitle-panel"><div class="sub-heading"><div><span class="sub-icon">${icon('captions')}</span><div><h3>وەرگێڕانی Google بۆ کوردی سۆرانی</h3><p id="embedded-subtitle-status" role="status">گەڕان بۆ ژێرنووس...</p></div></div><label class="upload-button">${icon('upload')} ژێرنووسی ئینگلیزی<input id="embedded-subtitle-file" type="file" accept=".srt,.vtt,text/vtt,text/plain" hidden></label></div><div class="sub-controls"><label>زمانی ژێرنووس<select id="embedded-language"><option value="off">کوژاندنەوە</option>${languages.map(([code, name]) => `<option value="${code}" ${code === 'ckb' ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select></label></div><div class="player-actions"><button id="menu-subtitle-enable" class="primary hidden" type="button" data-action="enable-menu-subtitle">سۆرانی زیاد بکە بۆ لیستی CC</button><button class="ghost" type="button" data-action="retry-subtitles">دووبارە هەوڵدانەوەی وەرگێڕان</button><button class="ghost" type="button" data-action="subtitle-fullscreen">شاشەی پڕ بە ژێرنووس</button></div><div class="subtitle-timing"><span>ڕێکخستنی کاتی ژێرنووس</span><button type="button" data-subtitle-offset="-2" aria-label="دوو چرکە زووتر">− 2s</button><span id="subtitle-offset" dir="ltr">0s</span><button type="button" data-subtitle-offset="2" aria-label="دوو چرکە دواتر">+ 2s</button></div><p id="menu-subtitle-hint" class="player-hint hidden">دوای تەواوبوونی وەرگێڕان دوگمەی زیادکردنی سۆرانی دابگرە. پلەیەرەکە دووبارە دەکرێتەوە و کوردی سۆرانی لە هەمان لیستی CC دەردەکەوێت.</p><p class="player-hint">ژێرنووسی فیلم خۆکارانە دەدۆزرێتەوە و بە Google وەردەگێڕدرێت بۆ سۆرانی. ئەگەر نەدۆزرایەوە، دەتوانیت فایلی SRT یان VTTی ئینگلیزی بار بکەیت؛ پێویست ناکات سۆرانی بێت. دەقی ژێرنووس بۆ Google دەنێردرێت و لەوانەیە کاتەکانی لەگەڵ وەشانی فیلمەکە جیاواز بن. ژێرنووسی ناو پلەیەر بکوژێنەوە بۆ ئەوەی دوو ژێرنووس نەردەکەوێت. بۆ شاشەی پڕ ئەم دوگمەیەی Kurd Movie بەکاربهێنە؛ شاشەی پڕی ناو پلەیەر ژێرنووسی Kurd Movie نیشان نادات.</p></div></div>`;
    modal.classList.remove('hidden'); document.body.classList.add('modal-open'); paintIcons();
    const frame = modal.querySelector('iframe'), session = playerSession;
    startEmbeddedPlayer(frame, session);
    startEmbeddedSubtitles(movie, session);
    frame.addEventListener('load', () => {
      if (session !== playerSession) return;
      document.querySelector('#embedded-loading')?.classList.add('hidden');
      const status = document.querySelector('#embedded-status');
      if (status) status.textContent = 'دوگمەی پەخش لە ناو پلەیەرەکە دابگرە.';
    });
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
function closePlayer() { if (embeddedMenuToken && nativeMenuAvailable()) MenuSubtitle.clear({ token: embeddedMenuToken }).catch(() => {}); embeddedMenuToken = null; embeddedMenuSource = null; embeddedSourceRequest++; embeddedSubtitles?.destroy(); embeddedSubtitles = null; clearTimeout(playerTimer); playerSession++; if (hls) { hls.destroy(); hls = null; } const video = document.querySelector('#video'); if (video) { video.pause(); video.removeAttribute('src'); video.load(); } Object.values(subtitleUrls).forEach(URL.revokeObjectURL); subtitleUrls = {}; originalCues = null; current = null; document.querySelector('#player-modal').innerHTML = ''; document.querySelector('#player-modal').classList.add('hidden'); document.querySelector('#player-modal').classList.remove('dimo-fullscreen'); document.body.classList.remove('modal-open'); }
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
  const timing = e.target.closest('[data-subtitle-offset]');
  if (timing && embeddedSubtitles) { embeddedOffset = Math.max(-120, Math.min(120, embeddedOffset + Number(timing.dataset.subtitleOffset))); embeddedSubtitles.setOffset(embeddedOffset); document.querySelector('#subtitle-offset').textContent = `${embeddedOffset > 0 ? '+' : ''}${embeddedOffset}s`; }
  const asianMore = e.target.closest('[data-asian-more]');
  if (asianMore) loadAsian(asianMore.dataset.asianMore);
  if (action === 'play-episode' && current?.mediaKind === 'series') {
    const season = Number(document.querySelector('#episode-season').value), episode = Number(document.querySelector('#episode-number').value);
    if (!Number.isInteger(season) || season < 1 || season > 999 || !Number.isInteger(episode) || episode < 1 || episode > 9999) toast('وەرز و ئەڵقەیەکی دروست هەڵبژێرە.');
    else { const nextMovie = { ...current, season, episode }; closePlayer(); openPlayer(nextMovie); }
  }
  const genre = e.target.closest('[data-genre]');
  if (genre) {
    discoverySeq++; clearTimeout(discoveryTimer);
    discoveryGenre = genres.some(([value]) => value === genre.dataset.genre) && genre.dataset.genre !== 'all' ? genre.dataset.genre : '';
    if (genre.classList.contains('shelf-more')) document.querySelector('#catalog').scrollIntoView({ behavior: 'smooth' });
    discovery = []; discoveryPage = 0; discoveryMore = false; discoveryLoading = false; discoveryAuto = true; discoveryQuery = '';
    document.querySelector('#catalog-search').value = '';
    document.querySelector('#more-movies').disabled = false;
    updateGenreButtons(); drawCatalog(); loadDiscovery('', 1);
  }
  if (action === 'retry-subtitles') { if (nativeMenuAvailable() && embeddedMenuSource) { const id = ++embeddedSourceRequest; translateForPlayerMenu(embeddedMenuSource, playerSession, id); } else if (embeddedHasSource) embeddedSubtitles?.retry(); else if (current) loadEmbeddedSource(current, playerSession); }
  if (action === 'enable-menu-subtitle' && embeddedMenuToken && current) { const frame = document.querySelector('#player-modal iframe'); if (frame) { startEmbeddedPlayer(frame, playerSession); frame.src = withSubtitleTrack(embeddedUrl(current), embeddedMenuToken, embeddedTime); document.querySelector('#embedded-subtitle-status').textContent = 'سۆرانی لە لیستی CCی پلەیەرەکەیە.'; document.querySelectorAll('[data-action="enable-menu-subtitle"]').forEach(button => button.classList.add('hidden')); } }
  if (action === 'subtitle-fullscreen') document.querySelector('#player-modal')?.classList.add('dimo-fullscreen');
  if (action === 'exit-subtitle-fullscreen') document.querySelector('#player-modal')?.classList.remove('dimo-fullscreen');
  if (action === 'retry-player') {
    const frame = document.querySelector('#player-modal iframe');
    if (frame) { embeddedSubtitles?.setTime(0); startEmbeddedPlayer(frame, playerSession); frame.src = frame.src; }
  }
  if (action === 'focus-search') { document.querySelector('#catalog').scrollIntoView({ behavior: 'smooth' }); document.querySelector('#catalog-search').focus({ preventScroll: true }); }
  if (action === 'check-update') checkForUpdate();
  if (action === 'download-update') downloadUpdate();
  if (action === 'library') libraryDialog();
  if (action === 'add') addDialog(); if (action === 'help') helpDialog(); if (action === 'close') closeModal(); if (action === 'close-player') closePlayer();
  const play = e.target.closest('[data-play]'); if (play) { if (play.closest('#modal')) closeModal(); const movie = findMovie(play.dataset.play); if (movie && isDonkeyPage(movie.url)) openDonkey(movie.url); else openPlayer(movie); }
  const del = e.target.closest('[data-delete]'); if (del && confirm('ئەم فیلمە لە کتێبخانە بسڕدرێتەوە؟')) { library = library.filter(m => m.id !== del.dataset.delete); saveLibrary(); libraryDialog(); toast('فیلمەکە سڕایەوە.'); }
  if (e.target.closest('#translate')) translateCues();
  if (e.target.closest('#more-movies')) loadDiscovery(discoveryQuery, discoveryPage + 1);
  if (e.target.id === 'modal') closeModal();
});
app.addEventListener('submit', e => {
  if (e.target.id !== 'add-form') return; e.preventDefault(); const form = new FormData(e.target); const title = String(form.get('title')).trim(), url = String(form.get('url')).trim(), subtitle = String(form.get('subtitle')).trim();
  if (!title || !validUrl(url) || (subtitle && !validUrl(subtitle))) { toast('ناو و لینکێکی دروست بنووسە.'); return; }
  library.unshift({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, title, url, subtitle: isDonkeyPage(url) ? '' : subtitle, type: 'فیلمی من' }); saveLibrary(); libraryDialog(); toast('فیلمەکە زیادکرا.');
});
app.addEventListener('input', e => {
  if (e.target.id !== 'catalog-search') return;
  const query = e.target.value;
  discoverySeq++; clearTimeout(discoveryTimer); discovery = []; discoveryPage = 0; discoveryMore = false; discoveryLoading = false; discoveryAuto = true; discoveryQuery = query;
  // Cinemeta's text search is global; do not imply it is filtered by genre.
  if (query.trim()) { discoveryGenre = ''; updateGenreButtons(); }
  document.querySelector('#more-movies').disabled = false;
  drawCatalog();
  document.querySelector('#discovery-status').textContent = 'گەڕان...';
  discoveryTimer = setTimeout(() => loadDiscovery(query, 1), 400);
});
app.addEventListener('change', async e => {
  if (e.target.id === 'embedded-language') embeddedSubtitles?.setTarget(e.target.value);
  if (e.target.id === 'embedded-subtitle-file') {
    const file = e.target.files[0], session = playerSession, requestId = ++embeddedSourceRequest;
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('فایلەکە زۆر گەورەیە.');
      const text = await file.text();
      if (session === playerSession && requestId === embeddedSourceRequest) { embeddedHasSource = true; if (nativeMenuAvailable()) { embeddedMenuSource = text; translateForPlayerMenu(text, session, requestId); } else embeddedSubtitles?.setCues(text); }
    } catch (error) { if (session === playerSession && requestId === embeddedSourceRequest) document.querySelector('#embedded-subtitle-status').textContent = error.message; }
  }
  if (e.target.id === 'subtitle-file') { const file = e.target.files[0], session = playerSession, requestId = ++subtitleRequest; if (!file) return; try { const text = await file.text(); if (session === playerSession && requestId === subtitleRequest) loadSubtitle(text); } catch (error) { if (session === playerSession && requestId === subtitleRequest) document.querySelector('#subtitle-status').textContent = error.message; } }
  if (e.target.id === 'subtitle-source' && e.target.value) loadSubtitleUrl(e.target.value);
  if (e.target.id === 'track-select') { const video = document.querySelector('#video'); Array.from(video.textTracks).forEach((t, i) => { t.mode = String(i) === e.target.value ? 'showing' : 'disabled'; }); }
  if (e.target.id === 'language') document.querySelector('#custom-language-label').classList.toggle('hidden', e.target.value !== 'custom');
});
window.addEventListener('message', event => {
  const frame = document.querySelector('#player-modal iframe');
  if (!frame || event.origin !== 'https://vidlink.pro' || event.source !== frame.contentWindow) return;
  if (event.data?.type === 'PLAYER_EVENT' && ['play', 'pause', 'seeked', 'ended', 'timeupdate'].includes(event.data?.data?.event)) {
    if (typeof event.data.data.currentTime === 'number' && Number.isFinite(event.data.data.currentTime) && event.data.data.currentTime >= 0) embeddedTime = event.data.data.currentTime;
    embeddedSubtitles?.setTime(event.data.data.currentTime);
  }
  if (event.data?.type === 'PLAYER_EVENT' && ['play', 'timeupdate'].includes(event.data?.data?.event)) {
    clearTimeout(playerTimer);
    document.querySelector('#embedded-loading')?.classList.add('hidden');
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (document.querySelector('#player-modal').classList.contains('dimo-fullscreen')) { document.querySelector('#player-modal').classList.remove('dimo-fullscreen'); return; } if (document.fullscreenElement) return; if (!document.querySelector('#modal').classList.contains('hidden')) closeModal(); else if (current) closePlayer(); } });
render();
