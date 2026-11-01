# DIMO — فیلم و دراما

A Sorani-first Android streaming player built with Capacitor. Add your own direct HTTPS MP4, WebM or HLS stream, load an SRT/VTT subtitle file or URL, select available caption tracks, and translate loaded subtitles using a free Google Translate web endpoint. A couple of publicly hosted sample videos are included. The discovery section lists titles visible on the reference Amanj TV page and links to that page; it does not include direct streams or guarantee that a listed title can be played there. The poster images are hosted by TMDB. Movies are links, not downloads or a built-in commercial catalogue; use only streams and subtitles you have permission to access.

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

Load a local `.srt` or `.vtt` file from the player, or provide an HTTPS subtitle URL when adding a movie. Select the original or translated track in the player. Embedded caption tracks are selectable when exposed by the stream/player; translation requires a separately loaded SRT/VTT file. Choose a listed target language or enter a Google-supported language code. Subtitle text is sent to Google's free web translation endpoint without an API key. This is an **unofficial** endpoint: Google may change, limit or discontinue it, so availability and language coverage are not guaranteed. It requires internet. The Android app uses Capacitor HTTP; browser previews may be blocked by cross-origin restrictions.

Streams and subtitle URLs must be direct HTTPS links. Browser playback, and HLS playlists/segments on Android's WebView, require the source server to allow cross-origin access (CORS); DRM-protected sites and normal movie-page links are not supported. Availability and formats depend on the source and device. Local subtitle loading does not need CORS; native Android subtitle URL loading uses Capacitor's HTTP client.
