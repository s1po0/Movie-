package app.dimo.movies;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import androidx.annotation.OptIn;
import androidx.core.content.FileProvider;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.util.Clock;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.PlaceholderDataSource;
import androidx.media3.datasource.cache.CacheDataSource;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.transformer.Composition;
import androidx.media3.transformer.DefaultDecoderFactory;
import androidx.media3.transformer.ExoPlayerAssetLoader;
import androidx.media3.transformer.ExportException;
import androidx.media3.transformer.ExportResult;
import androidx.media3.transformer.InAppMuxer;
import androidx.media3.transformer.Transformer;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Makes a normal video and a separate matching subtitle in public Downloads/Kurd Movie. */
@OptIn(markerClass = UnstableApi.class)
final class SharedFileExport {
    private static Transformer active;
    static void start(Context context, String id, String title, MediaItem media, File subtitle, boolean hls, PluginCall call) {
        if (!GalleryExport.reserve(id)) { OfflinePlugin.exportFinished(context, id, false, null, null); call.reject("Another export is in progress"); return; }
        Context app = context.getApplicationContext();
        File temporary = new File(app.getCacheDir(), "shared-export-" + id + ".mp4");
        try {
            byte[] source = readSubtitle(subtitle);
            byte[] srt = toSrt(new String(source, StandardCharsets.UTF_8)).getBytes(StandardCharsets.UTF_8);
            String safe = title.replaceAll("[\\\\/:*?\\\"<>|\\p{Cntrl}]", " ").trim();
            if (safe.isEmpty()) safe = "Kurd Movie";
            if (safe.length() > 75) safe = safe.substring(0, 75);
            final String name = safe + " - " + UUID.randomUUID().toString().substring(0, 8);
            if (temporary.exists() && !temporary.delete()) throw new IllegalStateException("Temporary file unavailable");
            DefaultDataSource.Factory local = new DefaultDataSource.Factory(app, PlaceholderDataSource.FACTORY);
            androidx.media3.datasource.DataSource.Factory data = hls
                ? new CacheDataSource.Factory().setCache(HlsDownloads.cache(app)).setUpstreamDataSourceFactory(local) : local;
            ExoPlayerAssetLoader.Factory loader = new ExoPlayerAssetLoader.Factory(app,
                new DefaultDecoderFactory.Builder(app).build(), Clock.DEFAULT, new DefaultMediaSourceFactory(data));
            // No video effects or subtitle track: Transformer creates a normal, unburned MP4.
            active = new Transformer.Builder(app).setAssetLoaderFactory(loader)
                .setMuxerFactory(new InAppMuxer.Factory.Builder().build())
                .setVideoMimeType(MimeTypes.VIDEO_H264).setAudioMimeType(MimeTypes.AUDIO_AAC)
                .addListener(new Transformer.Listener() {
                    @Override public void onCompleted(Composition composition, ExportResult result) {
                        new Thread(() -> {
                            try {
                                if (temporary.length() <= 0) throw new IllegalStateException("Empty MP4");
                                Uri video = Build.VERSION.SDK_INT >= 29
                                    ? publishScoped(app, temporary, name, srt) : publishLegacy(app, temporary, name, srt);
                                OfflinePlugin.exportFinished(app, id, true, name, video.toString());
                                JSObject response = new JSObject(); response.put("saved", true);
                                response.put("name", name); response.put("folder", "Download/Kurd Movie"); call.resolve(response);
                            } catch (Exception error) {
                                OfflinePlugin.exportFinished(app, id, false, null, null);
                                if ((app.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) android.util.Log.e("SeparateExportDebug", "Save failed", error);
                                call.reject("Saving files failed (" + error.getClass().getSimpleName() + ")", error);
                            } finally { temporary.delete(); active = null; GalleryExport.clear(); }
                        }, "shared-export-copy").start();
                    }
                    @Override public void onError(Composition composition, ExportResult result, ExportException error) {
                        temporary.delete(); active = null; GalleryExport.clear();
                        OfflinePlugin.exportFinished(app, id, false, null, null); call.reject("Converting video failed", error);
                    }
                }).build();
            active.start(media, temporary.getAbsolutePath());
        } catch (Exception error) {
            temporary.delete(); active = null; GalleryExport.clear();
            OfflinePlugin.exportFinished(app, id, false, null, null); call.reject("Unable to prepare separate files", error);
        }
    }
    private static byte[] readSubtitle(File file) throws Exception {
        if (!file.isFile() || file.length() <= 0 || file.length() > 2_000_000) throw new IllegalArgumentException("Invalid subtitle");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (FileInputStream in = new FileInputStream(file)) { byte[] b = new byte[8192]; int n; while ((n=in.read(b)) != -1) out.write(b, 0, n); }
        return out.toByteArray();
    }
    static String toSrt(String vtt) {
        Pattern time = Pattern.compile("^(\\d{2,}):(\\d{2}):(\\d{2})[.,](\\d{3})\\s+-->\\s+(\\d{2,}):(\\d{2}):(\\d{2})[.,](\\d{3}).*$");
        StringBuilder out = new StringBuilder(); int number = 0;
        for (String block : vtt.replace("\r", "").split("\\n[ \\t]*\\n")) {
            String[] lines = block.split("\\n");
            for (int i=0; i<lines.length; i++) {
                Matcher m = time.matcher(lines[i].trim()); if (!m.matches()) continue;
                StringBuilder text = new StringBuilder();
                for (int j=i+1; j<lines.length; j++) { if (text.length()>0) text.append('\n'); text.append(lines[j]); }
                if (text.length()==0) break;
                out.append(++number).append('\n').append(stamp(m,1)).append(" --> ").append(stamp(m,5)).append('\n').append(text).append("\n\n");
                break;
            }
        }
        if (number == 0 || number > 6000) throw new IllegalArgumentException("Invalid subtitle cues");
        return out.toString();
    }
    private static String stamp(Matcher m, int i) { return String.format(Locale.ROOT, "%s:%s:%s,%s",m.group(i),m.group(i+1),m.group(i+2),m.group(i+3)); }
    private static Uri publishScoped(Context c, File file, String name, byte[] srt) throws Exception {
        ContentResolver resolver = c.getContentResolver(); Uri video = null, sub = null;
        try {
            video = insert(resolver, name + ".mp4", "video/mp4"); sub = insert(resolver, name + ".srt", "application/x-subrip");
            try (FileInputStream in = new FileInputStream(file); OutputStream out = resolver.openOutputStream(video, "w")) {
                if (out == null) throw new IllegalStateException(); byte[] b = new byte[65536]; int n; while ((n=in.read(b)) != -1) out.write(b,0,n);
            }
            try (OutputStream out = resolver.openOutputStream(sub, "w")) { if (out == null) throw new IllegalStateException(); out.write(srt); }
            ContentValues ready = new ContentValues(); ready.put(MediaStore.Downloads.IS_PENDING, 0);
            if (resolver.update(sub, ready, null, null) != 1 || resolver.update(video, ready, null, null) != 1) throw new IllegalStateException("Cannot publish files");
            return video;
        } catch (Exception error) {
            if (video != null) resolver.delete(video,null,null); if (sub != null) resolver.delete(sub,null,null); throw error;
        }
    }
    private static Uri insert(ContentResolver resolver, String name, String mime) {
        ContentValues v = new ContentValues(); v.put(MediaStore.Downloads.DISPLAY_NAME,name); v.put(MediaStore.Downloads.MIME_TYPE,mime);
        v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Kurd Movie"); v.put(MediaStore.Downloads.IS_PENDING,1);
        Uri result = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,v); if (result == null) throw new IllegalStateException("Cannot create file"); return result;
    }
    @SuppressWarnings("deprecation") private static Uri publishLegacy(Context c, File file, String name, byte[] srt) throws Exception {
        File folder = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "Kurd Movie");
        if (!folder.isDirectory() && !folder.mkdirs()) throw new IllegalStateException("Cannot create download directory");
        File video = new File(folder,name + ".mp4"), sub = new File(folder,name + ".srt");
        boolean createdVideo = false, createdSub = false;
        try {
            createdVideo = video.createNewFile(); if (!createdVideo) throw new IllegalStateException("File exists");
            createdSub = sub.createNewFile(); if (!createdSub) throw new IllegalStateException("File exists");
            try (FileInputStream in = new FileInputStream(file); FileOutputStream out = new FileOutputStream(video)) {
                byte[] b = new byte[65536]; int n; while ((n=in.read(b)) != -1) out.write(b,0,n);
            }
            try (FileOutputStream out = new FileOutputStream(sub)) { out.write(srt); }
            MediaScannerConnection.scanFile(c,new String[]{video.getAbsolutePath(),sub.getAbsolutePath()},new String[]{"video/mp4","application/x-subrip"},null);
            return FileProvider.getUriForFile(c,c.getPackageName()+".fileprovider",video);
        } catch (Exception error) { if (createdVideo) video.delete(); if (createdSub) sub.delete(); throw error; }
    }
}
