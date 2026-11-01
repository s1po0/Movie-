import './style.css';
import Hls from 'hls.js';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { createIcons, icons } from 'lucide';
import { parseSubtitles, toVtt } from './subtitles.js';
import { translationGroups, translationUrl, translatedText, translateGroup } from './translate.js';
import { referenceUrl, searchReferenceMovies } from './catalog.js';
import { openMovies } from './movies.js';

const languages = [['ckb','کوردی سۆرانی'],['en','English'],['ar','العربية'],['ku','Kurdî (Kurmancî)'],['tr','Türkçe'],['fa','فارسی'],['fr','Français'],['de','Deutsch'],['es','Español'],['hi','हिन्दी'],['ja','日本語'],['ko','한국어'],['zh-CN','中文']];
const app = document.querySelector('#app');
let library = readLibrary();
let current = null, hls = null, subtitleUrls = {}, originalCues = null, playerSession = 0, subtitleVersion = 0;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function readLibrary() { try { const value = JSON.parse(localStorage.getItem('dimo-library') || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function saveLibrary() { localStorage.setItem('dimo-library', JSON.stringify(library)); }
function icon(name, cls = '') { return `<i data-lucide="${name}" class="${cls}"></i>`; }
function paintIcons() { createIcons({ icons }); }
function render() {
  const cards = [...openMovies, ...library];
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
            <div class="hero-actions"><button class="primary" data-play="sample-bunny">${icon('play')} دەست بە بینین بکە</button><button class="ghost" data-action="add">${icon('plus')} فیلم زیاد بکە</button></div>
          </div><div class="hero-index"><span>01</span><div></div> YOUR CINEMA, YOUR WAY</div>
        </section>
        <div class="feature-strip"><div>${icon('clapperboard')} <span>فیلم و دراما</span></div><div>${icon('captions')} <span>ژێرنووسی دڵخواز</span></div><div>${icon('languages')} <span>وەرگێڕان بۆ چەند زمانێک</span></div><div>${icon('smartphone')} <span>لە مۆبایلەکەتدا</span></div></div>
        <section class="library" id="library">
          <div class="section-head"><div><span class="overline">FREE TO WATCH</span><h2>فیلم بۆ سەیرکردن <span>✦</span></h2><p>فیلمە بەخۆڕاییەکان و فیلمە زیادکراوەکانت، لە ناو DIMO دا.</p></div><button class="text-button" data-action="add">زیادکردنی فیلم ${icon('arrow-up-left')}</button></div>
          <div class="cards">${cards.map((movie, i) => `<article class="movie-card"><button class="poster ${escapeHtml(movie.color || ['gold','plum','blue'][i%3])}" ${movie.poster ? `style="background-image:linear-gradient(0deg, #101510a8, transparent 55%),url('${escapeHtml(movie.poster)}');background-size:cover;background-position:center"` : ''} data-play="${escapeHtml(movie.id)}" aria-label="سەیرکردنی ${escapeHtml(movie.title)}"><span class="poster-label">${movie.credit ? 'FREE MOVIE' : 'MY MOVIE'}</span><span class="poster-art">${icon('clapperboard')}</span><span class="poster-play">${icon('play')}</span><span class="poster-bottom">DIMO <span>✦</span></span></button><div class="card-info"><div><h3 dir="auto">${escapeHtml(movie.title)}</h3><p>${escapeHtml(movie.type || 'فیلمی من')} <span>•</span> STREAMING</p></div>${movie.credit ? '' : `<button class="delete" data-delete="${escapeHtml(movie.id)}" aria-label="سڕینەوەی ${escapeHtml(movie.title)}">${icon('trash-2')}</button>`}</div></article>`).join('')}<button class="add-card" data-action="add"><span>${icon('plus')}</span><strong>فیلمێکی نوێ زیاد بکە</strong><small>لینکی خۆت دابنێ</small></button></div>
        </section>
        <section class="catalog" id="catalog">
          <div class="section-head catalog-head"><div><span class="overline">DISCOVER MOVIES</span><h2>فیلمەکان <span>✦</span></h2><p>فیلمە ناسراوەکان لە ماڵپەڕی Amanj TV بدۆزەرەوە.</p></div><label class="catalog-search"><span class="sr-only">گەڕان بە ناوی فیلم</span>${icon('search')}<input id="catalog-search" type="search" placeholder="گەڕان بە ناوی فیلم..." autocomplete="off"></label></div>
          <p class="catalog-notice">ئەم لیستە لە ماڵپەڕی سەرچاوە وەرگیراوە؛ کردنەوەی فیلمەکان تۆ دەبات بۆ ماڵپەڕەکە، نەک پلەیەری DIMO.</p>
          <div id="catalog-cards" class="catalog-cards">${catalogCards('')}</div>
          <p id="catalog-empty" class="catalog-empty hidden">هیچ فیلمێک بەم ناوە نەدۆزرایەوە.</p>
        </section>
        <section class="note"><div class="note-icon">${icon('sparkles')}</div><div><strong>هەر چیرۆکێک، بە زمانی خۆت.</strong><p>ژێرنووسێک بار بکە و بە Google Translate وەری بگێڕە بۆ زمانی دڵخوازت.</p></div><button class="text-button" data-action="help">چۆن کار دەکات؟ ${icon('arrow-up-left')}</button></section>
      </main>
      <footer><span class="footer-brand">DIMO<span>.</span></span><span>دروستکراوە بۆ خۆشەویستانی فیلم <b>✦</b></span><span>YOUR STORIES, YOUR WAY</span></footer>
    </div>
    <div class="overlay hidden" id="modal" role="dialog" aria-modal="true"></div>
    <div class="overlay hidden player-overlay" id="player-modal" role="dialog" aria-modal="true"></div>
    <div class="toast hidden" role="status"></div>`;
  paintIcons();
}
function catalogCards(query) {
  return searchReferenceMovies(query).map(movie => `<article class="catalog-card"><a href="${referenceUrl}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(movie.title)} — کردنەوەی ماڵپەڕی Amanj TV"><div class="catalog-poster"><img src="${escapeHtml(movie.poster)}" alt="" loading="lazy"><span class="catalog-badge">${movie.rating ? `★ ${escapeHtml(movie.rating)}` : escapeHtml(movie.year)}</span><span class="catalog-open">${icon('external-link')}</span></div><h3 dir="auto">${escapeHtml(movie.title)}</h3><p dir="auto">${escapeHtml(movie.year)} · Amanj TV ↗</p></a></article>`).join('');
}
function openModal(content) { const m = document.querySelector('#modal'); m.innerHTML = `<div class="dialog">${content}</div>`; m.classList.remove('hidden'); paintIcons(); }
function closeModal() { document.querySelector('#modal').classList.add('hidden'); }
function addDialog() {
  openModal(`<div class="dialog-header"><div><span class="overline">YOUR COLLECTION</span><h2>فیلمێک زیاد بکە</h2></div><button class="icon-button" data-action="close" aria-label="داخستن">${icon('x')}</button></div><p class="dialog-desc">لینکی ڕاستەوخۆی فیلم یان ستریمێک دابنێ کە مافی بینینت هەیە.</p><form id="add-form"><label>ناوی فیلم <input required name="title" maxlength="100" placeholder="ناوی فیلمەکە بنووسە"></label><label>لینکی ستریم <input required name="url" type="url" dir="ltr" placeholder="https://example.com/movie.m3u8"></label><label>لینکی ژێرنووس <span class="optional">ئیختیاری · SRT / VTT</span><input name="subtitle" type="url" dir="ltr" placeholder="https://example.com/subtitle.srt"></label><p class="form-hint">لینکەکە دەبێت HTTPS و ڕاستەوخۆ بۆ MP4، WebM یان HLS (.m3u8) بێت؛ لینکی ماڵپەڕی فیلم کار ناکات.</p><button class="primary full" type="submit">${icon('plus')} زیادکردن بۆ کتێبخانە</button></form>`);
}
function helpDialog() { openModal(`<div class="dialog-header"><div><span class="overline">HOW IT WORKS</span><h2>چۆن کار دەکات؟</h2></div><button class="icon-button" data-action="close" aria-label="داخستن">${icon('x')}</button></div><div class="help-list"><p><b>١</b><span>لینکی ڕاستەوخۆی ستریمەکەت زیاد بکە و فیلمەکە بکەرەوە.</span></p><p><b>٢</b><span>فایلی ژێرنووسی SRT یان VTT هەڵبژێرە، یان لینکی ژێرنووس دابنێ.</span></p><p><b>٣</b><span>زمان هەڵبژێرە و دوگمەی وەرگێڕان دابگرە؛ پێویست بە کلیل یان پارەدان نییە.</span></p></div><p class="form-hint">ژێرنووسەکان بۆ Google دەنێردرێن. خزمەتگوزارییە بەخۆڕاییەکە فەرمی نییە؛ لەوانەیە سنووردار بکرێت یان بوەستێت. هەندێک ستریم یان زمان لەوانەیە پشتگیری نەکرێت.</p>`); }
function toast(message) { const el = document.querySelector('.toast'); el.textContent = message; el.classList.remove('hidden'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.add('hidden'), 4500); }
function validUrl(url) { try { return new URL(url).protocol === 'https:'; } catch { return false; } }
function findMovie(id) { return [...library, ...openMovies].find(m => m.id === id); }
function openPlayer(movie) {
  if (!movie) return;
  playerSession++; current = movie; originalCues = null;
  const modal = document.querySelector('#player-modal');
  modal.innerHTML = `<div class="player-dialog"><div class="player-head"><div><span class="overline">NOW PLAYING</span><h2 dir="auto">${escapeHtml(movie.title)}</h2></div><button class="icon-button" data-action="close-player" aria-label="داخستن">${icon('x')}</button></div><div class="video-wrap"><video id="video" controls playsinline></video></div><div id="player-message" class="player-message">${movie.credit ? `${escapeHtml(movie.credit)} · <a href="https://creativecommons.org/licenses/${movie.id === 'sample-dream' ? 'by/2.5/' : 'by/3.0/'}" target="_blank" rel="noopener noreferrer">License ↗</a>` : 'ئەگەر ستریمەکە کار نەکرد، لینکی ڕاستەوخۆ و مافی بەکارهێنانی بپشکنە.'}</div><div class="subtitle-panel"><div class="sub-heading"><div><span class="sub-icon">${icon('captions')}</span><div><h3>ژێرنووس</h3><p id="subtitle-status">ژێرنووسێک هەڵبژێرە یان بار بکە</p></div></div><label class="upload-button">${icon('upload')} بارکردنی فایل<input id="subtitle-file" type="file" accept=".srt,.vtt,text/vtt,text/plain" hidden></label></div><div class="sub-controls"><label>ژێرنووسی بەردەست<select id="track-select"><option value="off">کوژاندنەوە</option></select></label><label>زمانی وەرگێڕان<select id="language">${languages.map(([code, name]) => `<option value="${code}">${escapeHtml(name)}</option>`).join('')}<option value="custom">زمانێکی تر…</option></select></label><label id="custom-language-label" class="hidden">کۆدی زمان <input id="custom-language" dir="ltr" placeholder="e.g. it"></label></div><details class="translate-details"><summary>${icon('languages')} وەرگێڕانی ژێرنووس بە Google</summary><p>فایلی ژێرنووس بار بکە و زمان هەڵبژێرە. وەرگێڕان بەخۆڕاییە و پێویستی بە کلیل نییە؛ ژێرنووسەکان بۆ Google دەنێردرێن.</p><div class="translate-row"><button class="primary" id="translate">${icon('sparkles')} وەرگێڕان</button></div><p id="translation-status" class="form-hint" role="status"></p></details></div></div>`;
  modal.classList.remove('hidden'); document.body.classList.add('modal-open'); paintIcons();
  const video = document.querySelector('#video');
  video.addEventListener('error', () => { document.querySelector('#player-message').textContent = 'ستریمەکە کار نەکرد. لینک، ئینتەرنێت و پشتگیری فرۆمات بپشکنە.'; });
  if (/\.m3u8(?:[?#]|$)/i.test(movie.url) && Hls.isSupported()) { hls = new Hls(); hls.loadSource(movie.url); hls.attachMedia(video); hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) document.querySelector('#player-message').textContent = 'ستریمەکە بار نەبوو؛ لینک و دەستڕاگەیشتنی CORS بپشکنە.'; }); }
  else video.src = movie.url;
  video.textTracks.addEventListener('addtrack', refreshTracks);
  video.textTracks.addEventListener('removetrack', refreshTracks);
  video.play().catch(() => {});
  if (movie.subtitle) loadSubtitleUrl(movie.subtitle);
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
function loadSubtitle(text) { const cues = parseSubtitles(text); if (!cues.length) throw new Error('هیچ ژێرنووسێک نەدۆزرایەوە. فایلی SRT یان VTT دروست هەڵبژێرە.'); originalCues = cues; subtitleVersion++; installCues(cues, 'ژێرنووسی ڕەسەن'); document.querySelector('#subtitle-status').textContent = `${cues.length} دێڕی ژێرنووس بارکرا`; }
async function loadSubtitleUrl(url) {
  const session = playerSession;
  try { let text; if (Capacitor.isNativePlatform()) { const result = await CapacitorHttp.get({ url, responseType: 'text' }); if (result.status < 200 || result.status >= 300) throw new Error(); text = result.data; } else { const response = await fetch(url); if (!response.ok) throw new Error(); text = await response.text(); } if (session === playerSession) loadSubtitle(text); } catch { if (session === playerSession) document.querySelector('#subtitle-status').textContent = 'ژێرنووس بار نەبوو؛ لینکەکە بپشکنە یان فایل بار بکە.'; }
}
async function translateCues() {
  const status = document.querySelector('#translation-status'), button = document.querySelector('#translate');
  const selection = document.querySelector('#language').value, target = selection === 'custom' ? document.querySelector('#custom-language').value.trim() : selection;
  if (!originalCues) { status.textContent = 'سەرەتا فایلی ژێرنووس بار بکە.'; return; }
  if (!/^[a-zA-Z]{2,3}(?:-[a-zA-Z]{2,4})?$/.test(target)) { status.textContent = 'کۆدی زمانێکی دروست بنووسە.'; return; }
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
    installCues(translated, `Google · ${target}`, 'translated'); status.textContent = 'وەرگێڕان تەواو بوو.'; document.querySelector('#subtitle-status').textContent = `وەرگێڕدراوە بۆ ${target}`;
  } catch (error) { if (stillCurrent()) status.textContent = `وەرگێڕان سەرکەوتوو نەبوو: ${error.message}`; }
  finally { if (session === playerSession) { button.disabled = false; if (version !== subtitleVersion) status.textContent = 'ژێرنووسەکە گۆڕدرا؛ دووبارە وەرگێڕان دەست پێ بکە.'; } }
}
app.addEventListener('click', e => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'add') addDialog(); if (action === 'help') helpDialog(); if (action === 'close') closeModal(); if (action === 'close-player') closePlayer();
  const play = e.target.closest('[data-play]'); if (play) openPlayer(findMovie(play.dataset.play));
  const del = e.target.closest('[data-delete]'); if (del && confirm('ئەم فیلمە لە کتێبخانە بسڕدرێتەوە؟')) { library = library.filter(m => m.id !== del.dataset.delete); saveLibrary(); render(); toast('فیلمەکە سڕایەوە.'); }
  if (e.target.closest('#translate')) translateCues();
  if (e.target.id === 'modal') closeModal();
});
app.addEventListener('submit', e => {
  if (e.target.id !== 'add-form') return; e.preventDefault(); const form = new FormData(e.target); const title = String(form.get('title')).trim(), url = String(form.get('url')).trim(), subtitle = String(form.get('subtitle')).trim();
  if (!title || !validUrl(url) || (subtitle && !validUrl(subtitle))) { toast('ناو و لینکێکی دروست بنووسە.'); return; }
  library.unshift({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, title, url, subtitle, type: 'فیلمی من' }); saveLibrary(); closeModal(); render(); toast('فیلمەکە زیادکرا.');
});
app.addEventListener('input', e => {
  if (e.target.id !== 'catalog-search') return;
  const matches = searchReferenceMovies(e.target.value);
  document.querySelector('#catalog-cards').innerHTML = catalogCards(e.target.value);
  document.querySelector('#catalog-empty').classList.toggle('hidden', matches.length > 0);
  paintIcons();
});
app.addEventListener('change', async e => {
  if (e.target.id === 'subtitle-file') { const file = e.target.files[0], session = playerSession; if (!file) return; try { const text = await file.text(); if (session === playerSession) loadSubtitle(text); } catch (error) { if (session === playerSession) document.querySelector('#subtitle-status').textContent = error.message; } }
  if (e.target.id === 'track-select') { const video = document.querySelector('#video'); Array.from(video.textTracks).forEach((t, i) => { t.mode = String(i) === e.target.value ? 'showing' : 'disabled'; }); }
  if (e.target.id === 'language') document.querySelector('#custom-language-label').classList.toggle('hidden', e.target.value !== 'custom');
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!document.querySelector('#modal').classList.contains('hidden')) closeModal(); else if (current) closePlayer(); } });
render();
