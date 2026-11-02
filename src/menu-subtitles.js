import { parseSubtitles, toVtt } from './subtitles.js';
import { translationGroups, translateGroup } from './translate.js';

// A whole VTT must be ready before the external player's subtitle menu can
// load it. Keep the original timecodes and bound concurrency and retry count.
export async function translateMenuSubtitles(text, request, { isCurrent = () => true, onProgress = () => {} } = {}) {
  if (typeof text !== 'string' || text.length > 2_000_000) throw new Error('Invalid subtitle file');
  const cues = parseSubtitles(text);
  if (!cues.length || cues.length > 6000) throw new Error('Invalid subtitle file');
  const groups = translationGroups(cues, 2600, 30);
  const results = new Array(groups.length);
  let next = 0, completed = 0, failure;
  const check = () => { if (!isCurrent() || failure) throw new Error('Translation cancelled'); };
  const retryingRequest = async line => {
    check();
    for (let attempt = 0; attempt < 2; attempt++) {
      try { const result = await request(line, 'ckb'); check(); return result; }
      catch (error) { check(); if (attempt) throw error; await new Promise(resolve => setTimeout(resolve, 500)); }
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
  await Promise.all([worker(), worker()]);
  if (failure) throw failure;
  check();
  return toVtt(results.flat());
}

export function subtitleTrackUrl(token) {
  if (!/^[a-f0-9]{32}$/.test(token)) throw new Error('Invalid subtitle token');
  return `https://vidlink.pro/dimo-sorani/${token}.vtt`;
}

export function withSubtitleTrack(embedUrl, token, time = 0) {
  const url = new URL(embedUrl);
  if (url.origin !== 'https://vidlink.pro' || !/^\/movie\/(?:\d{1,12}|tt\d{5,12})$/.test(url.pathname)) throw new Error('Invalid player');
  url.searchParams.set('sub_file', subtitleTrackUrl(token));
  url.searchParams.set('sub_label', 'کوردی سۆرانی');
  if (Number.isFinite(time) && time > 0) url.searchParams.set('startAt', String(Math.floor(time)));
  return url.href;
}
