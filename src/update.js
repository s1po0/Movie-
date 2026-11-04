// Only releases published by this project's update channel are eligible.
export const releaseApi = 'https://api.github.com/repos/s1po0/Movie-/releases?per_page=30';
export function findUpdate(releases, installedVersion) {
  if (!Array.isArray(releases) || !Number.isSafeInteger(installedVersion) || installedVersion < 1) throw new Error('Invalid release data');
  let newest = null;
  for (const release of releases) {
    if (release?.draft) continue;
    const match = /^nali-v([1-9]\d*)$/.exec(release?.tag_name || '');
    if (!match) continue;
    const version = Number(match[1]);
    if (!Number.isSafeInteger(version) || version <= installedVersion || (newest && version <= newest.version)) continue;
    const expected = `https://github.com/s1po0/Movie-/releases/download/nali-v${version}/Nali.apk`;
    const apk = Array.isArray(release.assets) && release.assets.find(asset => asset.name === 'Nali.apk' && asset.state === 'uploaded' && asset.browser_download_url === expected);
    if (apk) newest = { version, url: expected };
  }
  return newest;
}
