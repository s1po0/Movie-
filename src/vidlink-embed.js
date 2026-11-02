// Only identifiers are accepted; the embedded player remains on its own origin.
export function movieEmbedUrl(id) {
  const text = String(id);
  if (!/^(?:\d{1,12}|tt\d{5,12})$/.test(text)) throw new Error('Invalid movie identifier');
  return `https://vidlink.pro/movie/${text}`;
}
