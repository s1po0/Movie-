package app.dimo.movies;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.media.MediaScannerConnection;
import android.media.MediaCodec.BufferInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.provider.MediaStore;
import androidx.annotation.OptIn;
import androidx.core.content.FileProvider;
import androidx.media3.common.MediaItem;
import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.Metadata;
import androidx.media3.container.Mp4OrientationData;
import androidx.media3.muxer.Mp4Muxer;
import androidx.media3.muxer.Muxer;
import com.google.common.collect.ImmutableList;
import java.nio.ByteBuffer;
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

/** Makes a normal video and a separate matching subtitle in public Movies/Kurd Movie. */
@OptIn(markerClass = UnstableApi.class)
final class SharedFileExport {
    private static Transformer active;
    static void start(Context context, String id, String title, MediaItem media, File subtitle, boolean hls, PluginCall call) {
        if (!GalleryExport.reserve(id)) { OfflinePlugin.exportFinished(context, id, false, null, null); call.reject("Another export is in progress"); return; }
        Context app = context.getApplicationContext();
        File temporary = new File(app.getCacheDir(), "shared-export-" + id + ".mp4");
        ScopedTarget target = null;
        try {
            byte[] source = readSubtitle(subtitle);
            byte[] srt = toSrt(new String(source, StandardCharsets.UTF_8)).getBytes(StandardCharsets.UTF_8);
            String safe = title.replaceAll("[\\\\/:*?\\\"<>|\\p{Cntrl}]", " ").trim();
            if (safe.isEmpty()) safe = "Kurd Movie";
            if (safe.length() > 75) safe = safe.substring(0, 75);
            final String name = safe + " - " + UUID.randomUUID().toString().substring(0, 8);
            if (temporary.exists() && !temporary.delete()) throw new IllegalStateException("Temporary file unavailable");
            // Android 10+: write the MP4 directly to our pending shared-storage entry.
            // It becomes visible to file managers only after both files are complete.
            target = Build.VERSION.SDK_INT >= 29 ? ScopedTarget.create(app, name, srt) : null;
            final ScopedTarget scoped = target;
            final String outputPath = temporary.getAbsolutePath();
            DefaultDataSource.Factory local = new DefaultDataSource.Factory(app, PlaceholderDataSource.FACTORY);
            androidx.media3.datasource.DataSource.Factory data = hls
                ? new CacheDataSource.Factory().setCache(HlsDownloads.cache(app)).setUpstreamDataSourceFactory(local) : local;
            ExoPlayerAssetLoader.Factory loader = new ExoPlayerAssetLoader.Factory(app,
                new DefaultDecoderFactory.Builder(app).build(), Clock.DEFAULT, new DefaultMediaSourceFactory(data));
            // No video effects or subtitle track: Transformer creates a normal, unburned MP4.
            active = new Transformer.Builder(app).setAssetLoaderFactory(loader)
                .setMuxerFactory(new SharedMuxerFactory(scoped))
                .setVideoMimeType(MimeTypes.VIDEO_H264).setAudioMimeType(MimeTypes.AUDIO_AAC)
                .addListener(new Transformer.Listener() {
                    @Override public void onCompleted(Composition composition, ExportResult result) {
                        new Thread(() -> {
                            try {
                                if (scoped == null && temporary.length() <= 0) throw new IllegalStateException("Empty MP4");
                                Uri video = scoped != null ? scoped.publish() : publishLegacy(app, temporary, name, srt);
                                OfflinePlugin.exportFinished(app, id, true, name, video.toString());
                                JSObject response = new JSObject(); response.put("saved", true);
                                response.put("name", name); response.put("folder", "Movies/Kurd Movie"); call.resolve(response);
                            } catch (Exception error) {
                                if (scoped != null) scoped.discard();
                                OfflinePlugin.exportFinished(app, id, false, null, null);
                                if ((app.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) android.util.Log.e("SeparateExportDebug", "Save failed", error);
                                call.reject("Saving files failed (" + error.getClass().getSimpleName() + ")", error);
                            } finally { temporary.delete(); active = null; GalleryExport.clear(); }
                        }, "shared-export-copy").start();
                    }
                    @Override public void onError(Composition composition, ExportResult result, ExportException error) {
                        if (scoped != null) scoped.discard();
                        temporary.delete(); active = null; GalleryExport.clear();
                        if ((app.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) android.util.Log.e("SeparateExportDebug", "Conversion failed", error);
                        OfflinePlugin.exportFinished(app, id, false, null, null); call.reject("Converting video failed", error);
                    }
                }).build();
            try { active.start(media, outputPath); }
            catch (Exception error) { if (scoped != null) scoped.discard(); throw error; }
        } catch (Exception error) {
            if (target != null) target.discard();
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
    // InAppMuxer normally opens a filename itself, which cannot reopen /proc/self/fd
    // under Android's storage sandbox. Give Mp4Muxer a duplicate of the MediaStore fd.
    private static final class SharedMuxerFactory implements Muxer.Factory {
        private final ScopedTarget scoped;
        private final InAppMuxer.Factory fallback = new InAppMuxer.Factory.Builder().build();
        SharedMuxerFactory(ScopedTarget scoped) { this.scoped = scoped; }
        @Override public ImmutableList<String> getSupportedSampleMimeTypes(@C.TrackType int type) {
            return fallback.getSupportedSampleMimeTypes(type);
        }
        @Override public Muxer create(String path) throws Muxer.MuxerException {
            if (scoped == null) return fallback.create(path);
            final Mp4Muxer muxer;
            try {
                ParcelFileDescriptor copy = ParcelFileDescriptor.dup(scoped.descriptor.getFileDescriptor());
                muxer = new Mp4Muxer.Builder(new ParcelFileDescriptor.AutoCloseOutputStream(copy)).build();
            } catch (Exception error) { throw new Muxer.MuxerException("Cannot write shared MP4", error); }
            return new Muxer() {
                @Override public TrackToken addTrack(Format format) throws MuxerException {
                    TrackToken track = muxer.addTrack(format);
                    if (MimeTypes.isVideo(format.sampleMimeType)) muxer.addMetadataEntry(new Mp4OrientationData(format.rotationDegrees));
                    return track;
                }
                @Override public void writeSampleData(TrackToken track, ByteBuffer data, BufferInfo info) throws MuxerException { muxer.writeSampleData(track, data, info); }
                @Override public void addMetadataEntry(Metadata.Entry metadata) { muxer.addMetadataEntry(metadata); }
                @Override public void close() throws MuxerException { muxer.close(); }
            };
        }
    }
    private static final class ScopedTarget {
        final ContentResolver resolver;
        final Uri video, subtitle;
        final ParcelFileDescriptor descriptor;
        private ScopedTarget(ContentResolver resolver, Uri video, Uri subtitle, ParcelFileDescriptor descriptor) {
            this.resolver = resolver; this.video = video; this.subtitle = subtitle; this.descriptor = descriptor;
        }
        static ScopedTarget create(Context context, String name, byte[] srt) throws Exception {
            ContentResolver resolver = context.getContentResolver(); Uri video = null, subtitle = null;
            ParcelFileDescriptor descriptor = null;
            try {
                video = insert(resolver, MediaStore.Video.Media.EXTERNAL_CONTENT_URI, name + ".mp4", "video/mp4");
                subtitle = insert(resolver, MediaStore.Files.getContentUri("external"), name + ".srt", "application/x-subrip");
                try (OutputStream out = resolver.openOutputStream(subtitle, "w")) {
                    if (out == null) throw new IllegalStateException("Cannot write subtitle"); out.write(srt);
                }
                descriptor = resolver.openFileDescriptor(video, "rw");
                if (descriptor == null) throw new IllegalStateException("Cannot open shared video");
                return new ScopedTarget(resolver, video, subtitle, descriptor);
            } catch (Exception error) {
                if (descriptor != null) try { descriptor.close(); } catch (Exception ignored) {}
                if (video != null) resolver.delete(video, null, null);
                if (subtitle != null) resolver.delete(subtitle, null, null);
                throw error;
            }
        }
        Uri publish() throws Exception {
            if (descriptor.getStatSize() <= 0) throw new IllegalStateException("Empty shared MP4");
            descriptor.close();
            ContentValues ready = new ContentValues(); ready.put(MediaStore.MediaColumns.IS_PENDING, 0);
            if (resolver.update(subtitle, ready, null, null) != 1 || resolver.update(video, ready, null, null) != 1)
                throw new IllegalStateException("Cannot publish files");
            return video;
        }
        void discard() {
            try { descriptor.close(); } catch (Exception ignored) {}
            try { resolver.delete(video, null, null); } catch (Exception ignored) {}
            try { resolver.delete(subtitle, null, null); } catch (Exception ignored) {}
        }
    }
    private static Uri insert(ContentResolver resolver, Uri collection, String name, String mime) {
        ContentValues v = new ContentValues(); v.put(MediaStore.Downloads.DISPLAY_NAME,name); v.put(MediaStore.Downloads.MIME_TYPE,mime);
        v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/Kurd Movie"); v.put(MediaStore.Downloads.IS_PENDING,1);
        Uri result = resolver.insert(collection,v); if (result == null) throw new IllegalStateException("Cannot create file"); return result;
    }
    @SuppressWarnings("deprecation") private static Uri publishLegacy(Context c, File file, String name, byte[] srt) throws Exception {
        File folder = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES), "Kurd Movie");
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
