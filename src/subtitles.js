// Parse the common, text-based SRT and WebVTT formats without interpreting markup.
export function parseSubtitles(input) {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const blocks = text.split(/\n[ \t]*\n/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const timing = lines.findIndex(line => /^\s*(?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->\s+(?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3}/.test(line));
    if (timing < 0) continue;
    const [start, end] = lines[timing].trim().split(/\s+-->\s+/);
    const body = lines.slice(timing + 1).join('\n').replace(/<[^>]*>/g, '').trim();
    if (body) cues.push({ start: normalizeTime(start), end: normalizeTime(end.split(/\s+/)[0]), text: body });
  }
  return cues;
}
function normalizeTime(value) {
  const time = value.replace(',', '.');
  return time.split(':').length === 2 ? `00:${time}` : time;
}
export function toVtt(cues) {
  return `WEBVTT\n\n${cues.map(c => `${c.start} --> ${c.end}\n${c.text.replace(/-->/g, '→')}\n`).join('\n')}`;
}
export function batches(cues, maxChars = 24000, maxItems = 100) {
  const result = []; let batch = []; let size = 0;
  for (const cue of cues) {
    if (cue.text.length > maxChars) throw new Error('One subtitle line is too long to translate.');
    if (batch.length && (batch.length >= maxItems || size + cue.text.length > maxChars)) { result.push(batch); batch = []; size = 0; }
    batch.push(cue); size += cue.text.length;
  }
  if (batch.length) result.push(batch);
  return result;
}
