// AniList IDs identify one particular anime entry/part, not a TMDB season.
// An embed URL is only a request to the provider, not proof of availability.
export function donghuaAnimeUrl(anilistId, episode = 1) {
  if (!Number.isSafeInteger(anilistId) || anilistId < 1 || anilistId > 999999999999 ||
      !Number.isInteger(episode) || episode < 1 || episode > 9999) throw new Error('Invalid Donghua episode');
  return `https://megavid.buzz/ani/${anilistId}/${episode}/sub`;
}
