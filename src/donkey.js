// Donkey URLs are web pages, not direct MP4/HLS links.
export function isDonkeyPage(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'donkey.to' || url.hostname === 'www.donkey.to');
  } catch { return false; }
}
export const donkeyHome = 'https://donkey.to/';
