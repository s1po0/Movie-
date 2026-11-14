import jschardet from 'jschardet';

// Decode user-selected subtitle files locally. Encoding guesses can be wrong;
// when confidence is low, fail instead of translating replacement characters.
export function decodeSubtitle(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (!data.length || data.length > 2_000_000) throw new Error('فایلی ژێرنووس بەتاڵە یان زۆر گەورەیە.');
  const strictDecode = encoding => new TextDecoder(encoding, { fatal: true }).decode(data).replace(/^\uFEFF/, '');
  try {
    if (data[0] === 0xff && data[1] === 0xfe) return strictDecode('utf-16le');
    if (data[0] === 0xfe && data[1] === 0xff) return strictDecode('utf-16be');
    const utf8 = strictDecode('utf-8');
    if (utf8.includes('\u0000')) throw new Error('Binary or UTF-16 without BOM');
    return utf8;
  } catch { /* Detect common non-UTF encodings when UTF-8 decoding fails. */ }
  const { encoding, confidence } = jschardet.detect(data);
  if (!encoding || confidence < 0.6) throw new Error('کۆدی فایلی ژێرنووس نەناسرا؛ تکایە بە UTF-8 پاشەکەوتی بکە.');
  try {
    const labels = { CP932: 'shift_jis', CP936: 'gbk', CP949: 'euc-kr', CP950: 'big5' };
    const text = strictDecode(labels[encoding.toUpperCase()] || encoding);
    if (text.includes('\u0000') || text.includes('\uFFFD')) throw new Error('Invalid text');
    return text;
  } catch { throw new Error('کۆدی فایلی ژێرنووس پشتگیری ناکرێت؛ تکایە بە UTF-8 پاشەکەوتی بکە.'); }
}
