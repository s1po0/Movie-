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

// HLS reports segment-based progress; byte totals are often unknown.
export function offlineProgress(item) {
  const bytes = Number.isFinite(item?.bytes) && item.bytes >= 0 ? item.bytes : null;
  const total = Number.isFinite(item?.total) && item.total > 0 ? item.total : null;
  const size = n => n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KiB` : `${(n / (1024 * 1024)).toFixed(1)} MiB`;
  let percent = null;
  if (item?.kind === 'hls' && Number.isFinite(item.percent) && item.percent >= 0 && item.percent <= 100) percent = item.percent;
  else if (item?.kind !== 'hls' && bytes !== null && total !== null) percent = bytes / total * 100;
  if (percent !== null) percent = Math.min(99.9, Math.max(0, percent)); // completed is shown separately
  const parts = [];
  if (percent !== null) parts.push(`${item?.kind === 'hls' ? 'نزیکەی ' : ''}${percent.toFixed(1)}%`);
  if (bytes !== null) parts.push(total !== null ? `${size(bytes)} / ${size(total)}` : size(bytes));
  return { percent, text: parts.join(' · ') };
}
