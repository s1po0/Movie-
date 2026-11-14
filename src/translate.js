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

export function translationUrl(text, target) {
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.search = new URLSearchParams({ client: 'gtx', sl: 'auto', tl: target, dt: 't', q: text });
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
  if (group.length === 1) return [{ ...group[0].cue, text: result.trim() }];
  const lines = result.split(/\r?\n/).map(line => line.trim());
  if (lines.length === group.length && lines.every(Boolean)) {
    return group.map((item, i) => ({ ...item.cue, text: lines[i] }));
  }
  // If Google rewrites the separators, translate individually rather than misalign cues.
  const translated = [];
  for (const item of group) translated.push({ ...item.cue, text: (await request(item.text)).trim() });
  return translated;
}
