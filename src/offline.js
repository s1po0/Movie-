// Only direct, non-HLS HTTPS files can be handled by Android DownloadManager.
// Embedded providers and encrypted/adaptive streams are deliberately excluded.
export function isOfflineDownloadable(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && /\.(mp4|webm)$/i.test(parsed.pathname);
  } catch { return false; }
}

export function offlineSubtitle(translations, original, originalIsKurdish) {
  if (Array.isArray(translations?.ckb) && translations.ckb.length) return translations.ckb;
  if (originalIsKurdish && Array.isArray(original) && original.length) return original;
  return null;
}
