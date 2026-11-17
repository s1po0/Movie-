// Narul is a separate provider. Users choose its own series and episode rather
// than assuming a cross-provider season offset or silently matching by title.
import {lmDailymotionPlayer} from './donghua-direct.js';
import {dailymotionMedia, manifestQualityLevels} from './animecube.js';
const BASE = 'https://naruldonghua.com';
function siteUrl(value, base = BASE) {
  try {
    const u = new URL(value, base);
    return u.protocol === 'https:' && u.hostname === 'naruldonghua.com' && !u.username && !u.password && !u.port && !u.hash ? u : null;
  } catch { return null; }
}
function page(html, Parser = globalThis.DOMParser) {
  if (typeof html !== 'string' || html.length > 2_000_000 || typeof Parser !== 'function') throw new Error('Invalid source page');
  return new Parser().parseFromString(html, 'text/html');
}
export function narulSearchUrl(query) {
  const q=String(query||'').trim().slice(0,100); if(q.length<2) throw new Error('Search requires at least two characters');
  const u=new URL(BASE);u.searchParams.set('s',q);return u.href;
}
export function narulSearchResults(html, Parser) {
  const found=[],seen=new Set();
  for(const a of page(html,Parser).querySelectorAll('.bsx > a')) {
    const u=siteUrl(a.getAttribute('href')),title=(a.getAttribute('title')||a.querySelector('h2')?.textContent||'').trim();
    if(!u||u.search||!/^\/[a-z0-9][a-z0-9-]*\/$/i.test(u.pathname)||/-episode-\d+/i.test(u.pathname)||!title||seen.has(u.href)) continue;
    seen.add(u.href);found.push({title:title.slice(0,200),url:u.href});if(found.length>=30)break;
  } return found;
}
export function narulEpisodes(html,seriesUrl,Parser) {
  if(!siteUrl(seriesUrl))throw new Error('Invalid series');const episodes=[],seen=new Set();
  for(const a of page(html,Parser).querySelectorAll('.eplister a')) {
    const u=siteUrl(a.getAttribute('href'),seriesUrl),n=a.querySelector('.epl-num')?.textContent?.trim(),title=(a.querySelector('.epl-title')?.textContent||a.textContent||'').trim();
    if(!u||u.search||!/\/[^/]*episode-\d+[a-z0-9-]*\/?$/i.test(u.pathname)||!/^\d{1,4}$/.test(n||'')||!title||seen.has(u.href))continue;
    seen.add(u.href);episodes.push({number:Number(n),title:title.slice(0,200),url:u.href});
  } return episodes.sort((a,b)=>a.number-b.number);
}
export function narulDailymotionPlayers(html,Parser) {
  const doc=page(html,Parser),heading=doc.querySelector('h1')?.textContent||'',players=new Set();
  for(const option of doc.querySelectorAll('select option')) {
    const label=option.textContent.trim();
    // Bare DM is accepted only on pages that label the episode English.
    if(!/english/i.test(label) && !(/^(DM|Dailymotion)$/i.test(label) && /english/i.test(heading))) continue;
    const value=option.getAttribute('value')||'';
    if(!value||value.length>16384||!/^[a-z0-9+/=\s]+$/i.test(value))continue;
    try {const decoded=atob(value); const url=lmDailymotionPlayer(decoded,Parser); if(url)players.add(url)} catch { /* malformed option */ }
  } return [...players];
}
export async function narulResolveEpisode(episodeUrl,getText,Parser,getJson) {
  const ep=siteUrl(episodeUrl);
  if(!ep||ep.search||!/\/[^/]*episode-\d+[a-z0-9-]*\/?$/i.test(ep.pathname)||typeof getText!=='function'||typeof getJson!=='function')throw new Error('Invalid episode');
  for(const player of narulDailymotionPlayers(await getText(ep.href),Parser))try {
    const m=await dailymotionMedia(player,getJson),qualityLevels=manifestQualityLevels(await getText(m.streamUrl));
    if(!qualityLevels.length)continue;
    return {url:m.streamUrl,subtitleLanguage:m.subtitleLanguage,subtitles:m.subtitleTracks.map(t=>({url:t.url,language:t.language,label:`Dailymotion · ${t.language}${t.language.endsWith('-auto')?' · خۆکار':''}`})),qualityLevels,autoTranslateForOffline:true};
  } catch { /* try another approved player for the same episode */ }
  throw new Error('No supported direct source for this episode');
}
