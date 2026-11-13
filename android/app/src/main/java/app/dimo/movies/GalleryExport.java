package app.dimo.movies;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.PorterDuff;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextDirectionHeuristics;
import android.text.TextPaint;
import androidx.annotation.OptIn;
import androidx.media3.common.Effect;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.util.Clock;
import androidx.media3.common.util.Size;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.PlaceholderDataSource;
import androidx.media3.datasource.cache.CacheDataSource;
import androidx.media3.effect.BitmapOverlay;
import androidx.media3.effect.OverlayEffect;
import androidx.media3.effect.OverlaySettings;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.transformer.Composition;
import androidx.media3.transformer.DefaultDecoderFactory;
import androidx.media3.transformer.EditedMediaItem;
import androidx.media3.transformer.Effects;
import androidx.media3.transformer.ExoPlayerAssetLoader;
import androidx.media3.transformer.ExportException;
import androidx.media3.transformer.ExportResult;
import androidx.media3.transformer.Transformer;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.io.File;
import java.io.FileInputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Creates a public MP4 with the stored subtitles burned in. Android 10+ only. */
@OptIn(markerClass = UnstableApi.class)
final class GalleryExport {
    private static String activeId;
    private static Transformer activeTransformer;
    static synchronized boolean isExporting(String id) { return id.equals(activeId); }
    private static synchronized boolean reserve(String id) { if (activeId != null) return false; activeId = id; return true; }
    private static synchronized void clear() { activeId = null; activeTransformer = null; }

    static void start(Context context, String id, String title, MediaItem media, File subtitle, boolean hls, PluginCall call) {
        if (Build.VERSION.SDK_INT < 29) { call.reject("Gallery export requires Android 10 or later"); return; }
        if (!reserve(id)) { call.reject("Another gallery export is in progress"); return; }
        Context app = context.getApplicationContext();
        File output = new File(app.getCacheDir(), "gallery-export-" + id + ".mp4");
        try {
            if (subtitle.length() <= 0 || subtitle.length() > 2_000_000) throw new IllegalArgumentException("Invalid subtitle");
            byte[] data = new byte[(int) subtitle.length()];
            try (FileInputStream in = new FileInputStream(subtitle)) {
                int n = 0; while (n < data.length) { int count = in.read(data, n, data.length - n); if (count < 0) break; n += count; }
                if (n != data.length) throw new IllegalArgumentException("Incomplete subtitle");
            }
            SubtitleOverlay overlay = new SubtitleOverlay(new String(data, StandardCharsets.UTF_8));
            if (output.exists() && !output.delete()) throw new IllegalStateException("Cannot clear temporary file");
            DefaultDataSource.Factory local = new DefaultDataSource.Factory(app, PlaceholderDataSource.FACTORY);
            androidx.media3.datasource.DataSource.Factory source = hls
                ? new CacheDataSource.Factory().setCache(HlsDownloads.cache(app)).setUpstreamDataSourceFactory(local)
                : local;
            DefaultMediaSourceFactory mediaSource = new DefaultMediaSourceFactory(source);
            ExoPlayerAssetLoader.Factory loader = new ExoPlayerAssetLoader.Factory(app, new DefaultDecoderFactory.Builder(app).build(), Clock.DEFAULT, mediaSource);
            List<Effect> effects = Collections.singletonList(new OverlayEffect(Collections.singletonList(overlay)));
            EditedMediaItem edited = new EditedMediaItem.Builder(media).setEffects(new Effects(Collections.emptyList(), effects)).build();
            activeTransformer = new Transformer.Builder(app).setAssetLoaderFactory(loader)
                .setVideoMimeType(MimeTypes.VIDEO_H264).setAudioMimeType(MimeTypes.AUDIO_AAC)
                .addListener(new Transformer.Listener() {
                    @Override public void onCompleted(Composition composition, ExportResult result) {
                        // A separate thread copies the finished file, keeping the UI responsive.
                        new Thread(() -> {
                            Uri uri = null;
                            try {
                                if (output.length() <= 0) throw new IllegalStateException("Empty export");
                                ContentResolver resolver = app.getContentResolver();
                                ContentValues values = new ContentValues();
                                values.put(MediaStore.Video.Media.DISPLAY_NAME, safeName(title) + ".mp4");
                                values.put(MediaStore.Video.Media.MIME_TYPE, "video/mp4");
                                values.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/Kurd Movie");
                                values.put(MediaStore.Video.Media.IS_PENDING, 1);
                                uri = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values);
                                if (uri == null) throw new IllegalStateException("Cannot create gallery item");
                                try (FileInputStream in = new FileInputStream(output); OutputStream out = resolver.openOutputStream(uri, "w")) {
                                    if (out == null) throw new IllegalStateException("Cannot open gallery item");
                                    byte[] buf = new byte[65536]; int n; while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
                                }
                                ContentValues publish = new ContentValues(); publish.put(MediaStore.Video.Media.IS_PENDING, 0);
                                if (resolver.update(uri, publish, null, null) != 1) throw new IllegalStateException("Cannot publish gallery item");
                                JSObject response = new JSObject(); response.put("saved", true); call.resolve(response);
                            } catch (Exception error) {
                                if (uri != null) app.getContentResolver().delete(uri, null, null);
                                call.reject("Gallery export failed", error);
                            } finally { output.delete(); clear(); }
                        }, "gallery-copy").start();
                    }
                    @Override public void onError(Composition composition, ExportResult result, ExportException error) {
                        output.delete(); clear(); call.reject("Video conversion failed", error);
                    }
                }).build();
            activeTransformer.start(edited, output.getAbsolutePath());
        } catch (Exception error) { output.delete(); clear(); call.reject("Unable to export gallery video", error); }
    }
    private static String safeName(String text) {
        String safe = text.replaceAll("[\\\\/:*?\\\"<>|\\p{Cntrl}]", " ").trim();
        if (safe.isEmpty()) safe = "Kurd Movie";
        return safe.length() > 100 ? safe.substring(0, 100) : safe;
    }
    private static final class Cue { long start, end; String text; Cue(long s, long e, String t) { start=s; end=e; text=t; } }
    /** Reuse a transparent bitmap and update it only at cue boundaries. */
    private static final class SubtitleOverlay extends BitmapOverlay {
        private static final Pattern TIME = Pattern.compile("^(\\d{2,}):(\\d{2}):(\\d{2})[.,](\\d{3})\\s+-->\\s+(\\d{2,}):(\\d{2}):(\\d{2})[.,](\\d{3}).*$");
        private final List<Cue> cues = new ArrayList<>();
        private Bitmap bitmap; private int width=640, height=140, font=30; private String last;
        SubtitleOverlay(String vtt) {
            String[] blocks = vtt.replace("\r", "").split("\\n[ \\t]*\\n");
            for (String block : blocks) {
                String[] lines = block.split("\\n");
                for (int i=0; i<lines.length; i++) {
                    Matcher m = TIME.matcher(lines[i].trim()); if (!m.matches()) continue;
                    long start = time(m,1), end = time(m,5); StringBuilder text = new StringBuilder();
                    for (int j=i+1; j<lines.length; j++) { if (text.length()>0) text.append('\n'); text.append(lines[j]); }
                    if (end > start && text.length() > 0) cues.add(new Cue(start, end, text.toString()));
                    break;
                }
            }
            if (cues.isEmpty() || cues.size() > 6000) throw new IllegalArgumentException("Invalid subtitles");
        }
        private static long time(Matcher m, int n) { return (Long.parseLong(m.group(n))*3600_000L + Long.parseLong(m.group(n+1))*60_000L + Long.parseLong(m.group(n+2))*1000L + Long.parseLong(m.group(n+3))) * 1000; }
        @Override public void configure(Size video) {
            width = Math.max(1, (int)(video.getWidth() * .9)); height = Math.max(1, (int)(video.getHeight() * .28)); font = Math.max(14, (int)(video.getHeight() * .045));
            bitmap = null; last = null;
        }
        @Override public Bitmap getBitmap(long us) {
            StringBuilder text = new StringBuilder();
            for (Cue cue : cues) if (us >= cue.start && us < cue.end) { if (text.length()>0) text.append('\n'); text.append(cue.text); }
            String current = text.toString();
            if (bitmap == null) bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            if (!current.equals(last)) {
                last = current; Canvas canvas = new Canvas(bitmap); canvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR);
                if (!current.isEmpty()) {
                    TextPaint paint = new TextPaint(TextPaint.ANTI_ALIAS_FLAG); paint.setColor(Color.WHITE); paint.setTextSize(font); paint.setShadowLayer(font*.15f, 1, 2, Color.BLACK);
                    StaticLayout layout = StaticLayout.Builder.obtain(current, 0, current.length(), paint, width)
                        .setAlignment(Layout.Alignment.ALIGN_CENTER).setTextDirection(TextDirectionHeuristics.FIRSTSTRONG_RTL).setIncludePad(false).build();
                    canvas.save(); canvas.translate(0, Math.max(0, height - layout.getHeight())); layout.draw(canvas); canvas.restore();
                }
            }
            return bitmap;
        }
        @Override public OverlaySettings getOverlaySettings(long us) {
            return new OverlaySettings.Builder().setBackgroundFrameAnchor(0, -.84f).setOverlayFrameAnchor(0, -1).build();
        }
    }
}
