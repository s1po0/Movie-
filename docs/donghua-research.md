# Donghua playback investigation

This is a snapshot of live third-party behaviour, not a guarantee of rights,
availability, subtitles, playback in Iraq, or playback on the user's device.
The tests ran from a GitHub Actions runner using headless Chromium unless noted.
Every item in the table below was tested at episode **1**, using the AniList ID
and the same sandboxed MegaVid embed shape as the app. A video was counted as
playing only when its clock advanced and its decoded dimensions were nonzero.
The title was not visually reviewed against the actual content, and no later
episodes, Android devices, or Sorani subtitle synchronization were established
by this matrix. CI diagnostic: `43773712572`.

| AniList ID | Catalog title | Result |
|---|---|---|
| 117012 | Swallowed Star | Error 232011, zero decoded frames |
| 134283 | Tunshi Xingkong 2 | Error 232011, zero decoded frames |
| 166219 | Tunshi Xingkong 4 | Episode not found |
| 101920 | Soul Land | Advancing, 854×480 |
| 103543 | Douluo Dalu: Jingying Sai | Advancing, 854×480 |
| 137683 | Soul Land 2: The Peerless Tang Clan | Advancing, 1920×1080 |
| 102464 | Fights Break Sphere S1 | Episode not found |
| 102463 | Fights Break Sphere S2 | Advancing, 854×480 |
| 137728 | Dou Po Cangqiong: Nian Fan | Advancing, 1920×804 |
| 137653 | Renegade Immortal | Advancing, 1920×816 |
| 185121 | Renegade Immortal: Battle of Gods | Episode not found |
| 217627 | Renegade Immortal: Slaying the Blood Progenitor | Advancing, 1152×480 |

This directly contradicts any suggestion that the earlier Link Click/Legend of
Hei Android test established broad Donghua coverage. The player provider fails
some very popular series even when metadata exists. Provider-origin subtitle
tracks for another title could not be fetched by the parent frame because of
CORS, and no timing events were observed. The primary MegaVid path therefore
does not currently provide Sorani translation. Real Android tests in earlier
CI `43766489662` covered Link Click and Legend of Hei only, not this 3D matrix.

## Dedicated sources

* DonghuaWorld, DonghuaStream, AnimeXin and AnimeKhor returned Cloudflare 403
  to Node HTTP requests from CI `43773132401`. Search-engine page retrievals
  succeeding elsewhere do **not** establish app accessibility. DonghuaWorld's
  search for Swallowed Star returned a movie and a differently named series;
  automatically taking the first fuzzy match would misidentify the content.
* LMAnime returned live search and episode pages from CI. Its Swallowed Star
  series page listed 249 links in CI `43773132401`, using an absolute episode
  numbering scheme. The provider groups titles differently from AniList: e.g.
  AniList Swallowed Star 117012 lists 26 episodes and has distinct entries for
  later parts. It would be unsafe to apply an unverified numerical offset.
* LMAnime's own Renegade Immortal page listed only episodes 1–10 despite a
  metadata label saying 180; its Soul Land series page listed 1–6 despite
  saying 26. Its alternative 'temporary' listings may differ. The episode
  list is not evidence the videos are still present or the labels are correct.
* LMAnime episode 1, 100 and 200 of Swallowed Star, Renegade Immortal episode 1,
  and Throne of Seal episode 200 exposed Dailymotion embeds whose metadata was
  accessible from CI `43773318392`. The metadata said `protected_delivery`
  was false, but attempting to fetch the master manifest as a Node client
  returned **HTTP 403** for all five. No playback or download was established.
  Advertised encoding labels therefore cannot prove 720p is actually playable.
  Swallowed Star episode 1 and Renegade Immortal episode 1 exposed no separate
  caption tracks; other sampled entries advertised `en-auto`, which is not
  proof of correct or synchronized transcription. Some source pages describe
  subtitles embedded in the video and cannot be translated as text.
* The source's mirror names and language labels refer to distinct uploads, not
  necessarily separately accessible subtitle tracks. Geo restrictions, deleted
  videos, rights, ads, third-party scripts and unreliable servers remain risks.
  A visible episode link or a metadata response is not evidence of playback.
* DonghuaFilm's old domain led to a new site requiring sign-in. Dongsub returned
  429; a tested ZerDonghua deployment returned 402. Deltax's tested domain did
  not connect. These are observations for the runner, not global conclusions.

## Constraints for a real fix

A usable fallback requires a reachable source and a verified identity/episode
mapping, rather than guessing by display title or concatenating absolute and
season episode numbers. Validate selected series, season/part and exact episode
against independent metadata and representative video content. Then test actual
media advancement in the installed Android app, not merely iframe loads or
metadata; test multiple early/middle/late episodes, a fresh network in the
user's geography, and failure handling. Independently confirm available text
tracks and synchronized Sorani overlay on the exact video, real 720p variants,
and 1DM/offline export where supported. Hardcoded subtitles cannot be extracted
as text with the existing translation path. Source licensing/permissions and
terms must be assessed before integrating a provider. Until these are verified,
there is no proven replacement for the broken Swallowed Star source and no new
APK should be described as fixing Donghua.

Reproducible diagnostics: `scripts/donghua-3d-coverage-probe.mjs`,
`scripts/donghua-research-probe.mjs`, `scripts/donghua-lm-probe.mjs` and the
matching opt-in jobs in `.github/workflows/android-apk.yml`. External providers
change frequently; rerun rather than relying on these results indefinitely.
