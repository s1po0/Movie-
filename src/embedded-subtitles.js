import { parseSubtitles } from './subtitles.js';
import { translateGroup, translationGroups } from './translate.js';

function seconds(time) {
  const parts = time.split(':').map(Number);
  return parts.length === 3 && parts.every(Number.isFinite) ? parts[0] * 3600 + parts[1] * 60 + parts[2] : NaN;
}

// Translate small groups ahead of the playhead rather than sending a whole movie
// at once. A generation invalidates in-flight work after a seek/source change.
export function createEmbeddedSubtitles({ request, onText, onStatus }) {
  let cues = [], groups = [], translated = new Map(), generation = 0, target = 'ckb';
  let time = 0, position = 0, offset = 0, alreadySorani = false, busy = false, failed = false, destroyed = false;
  function render() {
    if (destroyed) return;
    const active = cues.filter(c => c.from <= time && c.to > time);
    onText(target === 'off' ? '' : active.map(c => alreadySorani && target === 'ckb' ? c.text : translated.get(c)).filter(Boolean).join('\n'));
  }
  function pump() {
    if (destroyed || busy || failed || target === 'off' || (alreadySorani && target === 'ckb')) return;
    let group = groups.find(g => g.some(({ cue }) => cue.to > time && cue.from <= time + 90 && !translated.has(cue)));
    // Prime the next line even when a movie begins with a long silent intro.
    if (!group && !cues.some(c => c.to > time && translated.has(c))) {
      group = groups.find(g => g.some(({ cue }) => cue.to > time && !translated.has(cue)));
    }
    if (!group) return;
    busy = true;
    const version = generation, lang = target;
    onStatus('وەرگێڕانی ژێرنووس بۆ زمانی هەڵبژێردراو...');
    translateGroup(group, text => request(text, lang)).then(result => {
      if (destroyed || version !== generation) return;
      result.forEach((cue, index) => translated.set(group[index].cue, cue.text));
      onStatus('ژێرنووس ئامادەیە.');
      render();
    }).catch(() => {
      if (destroyed || version !== generation) return;
      failed = true;
      onStatus('وەرگێڕان سەرکەوتوو نەبوو؛ ئینتەرنێت بپشکنە و دووبارە هەوڵ بدە.');
    }).finally(() => {
      busy = false;
      if (!destroyed) pump();
    });
  }
  return {
    setCues(text, isSorani = false) {
      const parsed = parseSubtitles(text).map(c => ({ ...c, from: seconds(c.start), to: seconds(c.end) }))
        .filter(c => Number.isFinite(c.from) && Number.isFinite(c.to) && c.to > c.from).sort((a, b) => a.from - b.from);
      if (!parsed.length) throw new Error('هیچ ژێرنووسێکی دروست لە فایلەکەدا نەدۆزرایەوە.');
      const nextGroups = translationGroups(parsed, 1000, 8);
      generation++; cues = parsed; groups = nextGroups; translated = new Map(); alreadySorani = isSorani; failed = false;
      onStatus(`${cues.length} دێڕی ژێرنووس بارکرا.`); render(); pump();
    },
    setTarget(value) { generation++; target = value; translated = new Map(); failed = false; render(); pump(); },
    setTime(value) { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return; position = value; time = Math.max(0, position - offset); render(); pump(); },
    setOffset(value) { if (typeof value !== 'number' || !Number.isFinite(value)) return; offset = Math.max(-120, Math.min(120, value)); time = Math.max(0, position - offset); render(); pump(); },
    retry() { failed = false; pump(); },
    clear() { generation++; cues = []; groups = []; translated = new Map(); failed = false; render(); },
    destroy() { generation++; destroyed = true; },
  };
}
