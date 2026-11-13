// Direct HTTPS files and finite, non-DRM HLS streams are supported on Android.
// Provider pages and protected streams are not direct media URLs.
export function isOfflineDownloadable(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && /\.(mp4|webm|m3u8)$/i.test(parsed.pathname);
  } catch { return false; }
}

export function offlineSubtitle(translations, original, originalIsKurdish) {
  if (Array.isArray(translations?.ckb) && translations.ckb.length) return translations.ckb;
  if (originalIsKurdish && Array.isArray(original) && original.length) return original;
  return null;
}
