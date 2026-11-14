import { parseSubtitles, toVtt, validateSubtitleTimings } from './subtitles.js';
import { translationGroups, translateGroup, soraniRtl, assertSoraniScript } from './translate.js';

// A whole VTT must be ready before the external player's subtitle menu can
// load it. Keep the original timecodes and bound concurrency and retry count.
export async function translateMenuSubtitles(text, request, {
  isCurrent = () => true,
  onProgress = () => {},
  // A small shared request cadence avoids bursting the unofficial endpoint.
  target = 'ckb',
  concurrency = 3,
  minSpacingMs = 120,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  if (typeof text !== 'string' || text.length > 2_000_000) throw new Error('Invalid subtitle file');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 3 || !Number.isFinite(minSpacingMs) || minSpacingMs < 0) throw new Error('Invalid translation settings');
  const cues = parseSubtitles(text);
  if (!cues.length || cues.length > 6000) throw new Error('Invalid subtitle file');
  validateSubtitleTimings(cues);
  const groups = translationGroups(cues, 2600, 30);
  const results = new Array(groups.length);
  let next = 0, completed = 0, failure, nextRequestAt = 0;
  const check = () => { if (!isCurrent() || failure) throw new Error('Translation cancelled'); };
  const retryingRequest = async line => {
    check();
    for (let attempt = 0; attempt < 4; attempt++) {
      // Reserve a global slot synchronously, including individual-line fallbacks.
      const now = Date.now();
      const slot = Math.max(now, nextRequestAt);
      nextRequestAt = slot + minSpacingMs;
      if (slot > now) await sleep(slot - now);
      check();
      try { const result = await request(line, target); check(); return result; }
      catch (error) { check(); if (attempt === 3) throw error; await sleep([800, 2500, 5000][attempt]); check(); }
    }
  };
  async function worker() {
    try {
      while (true) {
        check();
        const index = next++;
        if (index >= groups.length) return;
        results[index] = await translateGroup(groups[index], retryingRequest);
        check(); onProgress(++completed, groups.length);
      }
    } catch (error) { failure ||= error; }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, groups.length) }, () => worker()));
  if (failure) throw failure;
  check();
  const translated = results.flat();
  if (target === 'ckb') { assertSoraniScript(translated); return toVtt(soraniRtl(translated)); }
  return toVtt(translated);
}

// Reopening the same film during this app session can reuse its translated
// track, but different subtitle editions must never share a cached result.
export function createMenuTranslationCache(maxEntries = 3) {
  const entries = new Map();
  return {
    get(text) {
      const value = entries.get(text);
      if (value === undefined) return undefined;
      entries.delete(text); entries.set(text, value);
      return value;
    },
    set(text, vtt) {
      entries.delete(text); entries.set(text, vtt);
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
    },
  };
}

export function subtitleTrackUrl(token) {
  if (!/^[a-f0-9]{32}$/.test(token)) throw new Error('Invalid subtitle token');
  return `https://vidlink.pro/dimo-sorani/${token}.vtt`;
}

export function withSubtitleTrack(embedUrl, token, time = 0) {
  const url = new URL(embedUrl);
  if (url.origin !== 'https://vidlink.pro' || !(/^\/movie\/(?:\d{1,12}|tt\d{5,12})$/.test(url.pathname) || /^\/tv\/\d{1,12}\/[1-9]\d{0,2}\/[1-9]\d{0,3}$/.test(url.pathname))) throw new Error('Invalid player');
  url.searchParams.set('sub_file', subtitleTrackUrl(token));
  url.searchParams.set('sub_label', 'کوردی سۆرانی');
  if (Number.isFinite(time) && time > 0) url.searchParams.set('startAt', String(Math.floor(time)));
  return url.href;
}
