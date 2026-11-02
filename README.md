# DIMO — فیلم و دراما

A Sorani-first Android streaming player built with Capacitor. The searchable catalogue combines curated films with Cinemeta movie metadata, including a paginated Horror category. A title in search results does not guarantee that a playable stream exists; neither the catalogue nor the playback source covers every movie. Curated Archive titles use direct MP4 links. External provider links can be saved in the library or opened from the catalogue, but on Android they open the provider website inside an isolated in-app WebView; in a browser they open in a new tab. Playback is provided by that site, not the DIMO player, and may be unavailable or blocked by the site. Visible provider branding is filtered on the main page; cross-origin frames and external browser tabs cannot be changed by the app. DIMO subtitle translation does not work inside that website. Movies are streamed from the source rather than stored in the app; availability may change and internet is required. Some Archive files are large. Use only streams and subtitles you have permission to access in your location.

Sintel and Tears of Steel use HLS. Film credits and the corresponding Creative Commons licence are shown in the player; multilingual sidecar subtitles from [NoMercy Media](https://github.com/NoMercy-Entertainment/nomercy-media/blob/master/Films/ATTRIBUTION.md) are adaptations. Video streams are from Fastmotion. English is loaded by default when available, and other provided languages can be selected in the player. Subtitle timing may differ between editions.

His Girl Friday and the Sherlock Holmes episodes also attempt to load English subtitles automatically (the Archive captions are machine-generated). If the subtitle server or browser CORS blocks them, load an SRT/VTT file manually. Remote stream manifests and subtitle files were checked, but playback and subtitle synchronization have not been tested on Android.

The app caches recent catalog metadata in memory and loads its HLS library only when an HLS link is opened. The Dark Knight and Cinemeta search results open a third-party player inside the app. The player can be reloaded from the app if it stalls; actual video speed depends on the provider and connection. The embedded player cannot run with an iframe sandbox and may show ads or open other pages. DIMO can overlay a local SRT/VTT subtitle file, optionally translated to Sorani (ckb) or another language, using the provider's playback-time messages. Turn off the provider's own captions to avoid duplicates. The app tries to find an English subtitle automatically using free subtitle services and sends it to Google for translation to Sorani. Some titles have no usable subtitle; a matching local English file may be needed, and different editions may have different timing. Use DIMO's fullscreen button for the overlay; the provider's own fullscreen and picture-in-picture do not include it. A GitHub-hosted browser test verified movie playback and a translated Sorani overlay with a supplied test subtitle; it has not been tested on Android. The provider may block embedding or remove the film. This is not a direct M3U8 integration or the full requested site catalogue.

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

Load a local `.srt` or `.vtt` file from the player, or provide an HTTPS subtitle URL when adding a movie. Select available Archive subtitle files or an uploaded original, then choose a target language and translate. The original and latest translation are selectable as tracks, and translations are cached while the player is open. An original subtitle file is required for translation; it cannot create subtitles for a film with no text track. For embedded movies, upload matching SRT/VTT subtitles if automatic lookup fails. Translations are requested incrementally around the playhead and may lag if the connection or translation service is slow; the provider must send playback-time messages. The isolated external-site WebView does not support this overlay. Choose a listed target language or enter a Google-supported language code. Subtitle text is sent to Google's free web translation endpoint without an API key. This is an **unofficial** endpoint: Google may change, limit or discontinue it, so availability and language coverage are not guaranteed. It requires internet. The Android app uses Capacitor HTTP; browser previews may be blocked by cross-origin restrictions.

Streams and subtitle URLs must be direct HTTPS links. Browser playback, and HLS playlists/segments on Android's WebView, require the source server to allow cross-origin access (CORS); DRM-protected sites and normal movie-page links are not supported. Availability and formats depend on the source and device. Local subtitle loading does not need CORS; native Android subtitle URL loading uses Capacitor's HTTP client.
