// Google Translate's public web endpoint is unofficial and may change or rate-limit.
// Keep each request short; preserve subtitle timing by translating cue groups.
export function translationGroups(cues, maxLength = 1000, maxItems = 12) {
  const groups = []; let group = []; let length = 0;
  for (const cue of cues) {
    const text = cue.text.replace(/\s*\n\s*/g, ' ').trim();
    if (text.length > 4500) throw new Error('A subtitle line is too long to translate.');
    if (group.length && (group.length >= maxItems || length + text.length + 1 > maxLength)) {
      groups.push(group); group = []; length = 0;
    }
    group.push({ cue, text }); length += text.length + 1;
  }
  if (group.length) groups.push(group);
  return groups;
}

export function translationUrl(text, target, source = 'auto') {
  if (!/^(?:auto|[a-z]{2,3}(?:-[A-Za-z]{2,4})?)$/.test(source)) source = 'auto';
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.search = new URLSearchParams({ client: 'gtx', sl: source, tl: target, dt: 't', q: text });
  return url.toString();
}

export function translatedText(data) {
  if (typeof data === 'string') data = JSON.parse(data);
  if (!Array.isArray(data?.[0])) throw new Error('Invalid translation response');
  const result = data[0].map(part => Array.isArray(part) ? part[0] || '' : '').join('');
  if (!result) throw new Error('Empty translation response');
  return result;
}

export async function translateGroup(group, request) {
  const result = await request(group.map(item => item.text).join('\n'));
  if (typeof result !== 'string' || !result.trim()) throw new Error('Empty translation response');
  if (group.length === 1) return [{ ...group[0].cue, text: result.trim() }];
  const lines = result.split(/\r?\n/).map(line => line.trim());
  if (lines.length === group.length && lines.every(Boolean)) {
    return group.map((item, i) => ({ ...item.cue, text: lines[i] }));
  }
  // If Google rewrites the separators, translate individually rather than misalign cues.
  const translated = [];
  for (const item of group) {
    const line = await request(item.text);
    if (typeof line !== 'string' || !line.trim()) throw new Error('Empty translation response');
    translated.push({ ...item.cue, text: line.trim() });
  }
  return translated;
}

// A right-to-left base direction does not reverse text or Latin words. RLM works
// in common SRT/WebVTT players, including readers without CSS support.
export function soraniRtl(cues) {
  return cues.map(cue => ({ ...cue, text: cue.text.split('\n').map(line => {
    const clean = line.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');
    return clean.trim() ? `\u200f${clean}\u200f` : clean;
  }).join('\n') }));
}

// Catch a common failure mode: a service returns a whole untranslated Latin or
// CJK track while claiming success. This is not a translation-quality metric.
export function assertSoraniScript(cues) {
  const text = cues.map(c => c.text).join(' ');
  const letters = text.match(/\p{L}/gu) || [];
  const arabicLetters = text.match(/[\u0620-\u063f\u0641-\u064a\u066e-\u06d3\u06fa-\u06fc]/g) || [];
  if (letters.length >= 40 && arabicLetters.length / letters.length < 0.15) throw new Error('Translation did not return Sorani script');
}
