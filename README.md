# DIMO — فیلم و دراما

A Sorani-first Android streaming player built with Capacitor. The searchable catalogue combines curated films with Cinemeta movie metadata, including a paginated Horror category. A title in search results does not guarantee that a playable stream exists; neither the catalogue nor the playback source covers every movie. Curated Archive titles use direct MP4 links. External provider links can be saved in the library or opened from the catalogue, but on Android they open the provider website inside an isolated in-app WebView; in a browser they open in a new tab. Playback is provided by that site, not the DIMO player, and may be unavailable or blocked by the site. Visible provider branding is filtered on the main page; cross-origin frames and external browser tabs cannot be changed by the app. DIMO subtitle translation does not work inside that website. Movies are streamed from the source rather than stored in the app; availability may change and internet is required. Some Archive files are large. Use only streams and subtitles you have permission to access in your location.

Sintel and Tears of Steel use HLS. Film credits and the corresponding Creative Commons licence are shown in the player; multilingual sidecar subtitles from [NoMercy Media](https://github.com/NoMercy-Entertainment/nomercy-media/blob/master/Films/ATTRIBUTION.md) are adaptations. Video streams are from Fastmotion. English is loaded by default when available, and other provided languages can be selected in the player. Subtitle timing may differ between editions.

His Girl Friday and the Sherlock Holmes episodes also attempt to load English subtitles automatically (the Archive captions are machine-generated). If the subtitle server or browser CORS blocks them, load an SRT/VTT file manually. Remote stream manifests and subtitle files were checked, but playback and subtitle synchronization have not been tested on Android.

The app caches recent catalog metadata in memory and loads its HLS library only when needed. The Dark Knight and Cinemeta results use a third-party player that may display ads or block playback. Its full-player ad overlay can also intercept taps on the caption controls; DIMO cannot reliably remove this overlay. On Android, DIMO attempts to fetch the player's English subtitle, falls back to a free subtitle source when necessary, and translates the whole track with Google to Sorani. When ready, choose the button to add Sorani to the player's own CC menu; the player reloads, attempting to preserve playback position. The generated VTT is held in memory and is served only to the WebView at an unguessable temporary URL. Translation uses a small number of paced concurrent requests and keeps the last three translated source tracks in memory for the current app session. It can still take a while, fail or be rate-limited, and independent subtitle editions may not be synchronized. The menu integration cannot access or translate each individual track in the cross-origin player; it adds one Sorani translation of the fetched source. Browser previews use a separate overlay instead, because they cannot intercept the provider's requests. The isolated external-site WebView is not supported.

## Run and build

Requirements: Node.js 20+, Android Studio, Android SDK 35, and JDK 21 (Android Studio's bundled JDK works). An internet connection is required for streams and translation.

```sh
npm ci
npm test
npm run android:sync
npm run android:open
```

In Android Studio let Gradle sync, then run on an Android device/emulator or use **Build > Build Bundle(s) / APK(s) > Build APK(s)**. Alternatively, after syncing and configuring the Android SDK, run `cd android && ./gradlew assembleDebug`; the APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`. Re-run `npm run android:sync` after changing the web app. For a browser preview use `npm run dev`.

## Subtitles and translation

Load a local `.srt` or `.vtt` file from the player, or provide an HTTPS subtitle URL when adding a movie. Select available Archive subtitle files or an uploaded original, then choose a target language and translate. The original and latest translation are selectable as tracks, and translations are cached while the player is open. An original subtitle file is required for translation; it cannot create subtitles for a film with no text track. For embedded movies on Android, DIMO translates a whole source subtitle to Sorani and adds it to the player's CC menu after you activate it. Browser previews translate incrementally as an overlay using player time messages. If lookup fails, you can provide a matching SRT/VTT file. The isolated external-site WebView does not support either approach. Choose a listed target language or enter a Google-supported language code. Subtitle text is sent to Google's free web translation endpoint without an API key. This is an **unofficial** endpoint: Google may change, limit or discontinue it, so availability and language coverage are not guaranteed. It requires internet. The Android app uses Capacitor HTTP; browser previews may be blocked by cross-origin restrictions.

Streams and subtitle URLs must be direct HTTPS links. Browser playback, and HLS playlists/segments on Android's WebView, require the source server to allow cross-origin access (CORS); DRM-protected sites and normal movie-page links are not supported. Availability and formats depend on the source and device. Local subtitle loading does not need CORS; native Android subtitle URL loading uses Capacitor's HTTP client.

## Android updates

The app checks for published GitHub releases tagged `nali-v<versionCode>` containing `Nali.apk`. It downloads an update using Android's download manager after the user agrees; Android still requires the user to approve installation. An in-place upgrade requires a higher version code and the **same signing certificate**. The CI build uses an ephemeral debug key unless persistent signing is configured, so existing debug APKs and independently built APKs may not update over one another. Do not distribute debug builds as secure production releases.

For maintainers: configure repository Actions secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD` through GitHub's secret settings (never commit the key). The build uses these for debug APKs when present. Back up the key securely and use it for every future update; increment `versionCode` in `android/app/build.gradle` and publish a matching `nali-v<versionCode>` release with an uploaded `Nali.apk` asset. Changing keys prevents in-place updates.
