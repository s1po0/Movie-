package app.dimo.movies;

import android.app.DownloadManager;
import android.Manifest;
import android.os.Build;
import android.content.Context;
import android.content.Intent;
import androidx.annotation.OptIn;
import androidx.media3.common.MediaItem;
import androidx.media3.common.C;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.offline.Download;
import androidx.media3.exoplayer.offline.DownloadHelper;
import androidx.media3.exoplayer.offline.DownloadRequest;
import androidx.media3.exoplayer.offline.DownloadService;
import java.io.IOException;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.util.AtomicFile;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Downloads direct media and unprotected, finite HLS streams. */
@OptIn(markerClass = UnstableApi.class)
@CapacitorPlugin(name = "Offline", permissions = { @Permission(alias = "legacyStorage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE }) })
public final class OfflinePlugin extends Plugin {
    private static final String PREFS = "offline-v1";
    private static final Object LOCK = new Object();
    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    private static DownloadManager manager(Context c) { return (DownloadManager) c.getSystemService(Context.DOWNLOAD_SERVICE); }
    private static JSONArray entries(Context c) {
        try { return new JSONArray(prefs(c).getString("items", "[]")); } catch (Exception ignored) { return new JSONArray(); }
    }
    private static void save(Context c, JSONArray a) { prefs(c).edit().putString("items", a.toString()).commit(); }
    private static boolean safeId(String id) { return id != null && id.matches("[a-f0-9]{32}"); }
    private static File video(Context c, String id, String ext) {
        if (!safeId(id) || !("mp4".equals(ext) || "webm".equals(ext))) throw new IllegalArgumentException();
        File root = c.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (root == null) throw new IllegalStateException();
        return new File(root, "offline-" + id + "." + ext);
    }
    private static File subtitle(Context c, String id) {
        if (!safeId(id)) throw new IllegalArgumentException();
        return new File(c.getFilesDir(), "offline-" + id + ".vtt");
    }
    private static JSONObject find(Context c, String id) {
        JSONArray a = entries(c);
        for (int i = 0; i < a.length(); i++) { JSONObject o = a.optJSONObject(i); if (o != null && id.equals(o.optString("id"))) return o; }
        return null;
    }
    private static int status(Context c, JSONObject o, JSObject out) {
        try (Cursor cursor = manager(c).query(new DownloadManager.Query().setFilterById(o.optLong("downloadId")))) {
            if (cursor == null || !cursor.moveToFirst()) return DownloadManager.STATUS_FAILED;
            int state = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            if (out != null) {
                out.put("bytes", cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)));
                out.put("total", cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)));
            }
            return state;
        } catch (Exception ignored) { return DownloadManager.STATUS_FAILED; }
    }
    private static boolean complete(Context c, JSONObject o) {
        try { return status(c, o, null) == DownloadManager.STATUS_SUCCESSFUL && video(c, o.optString("id"), o.optString("ext")).length() > 0 && subtitle(c, o.optString("id")).isFile(); }
        catch (Exception ignored) { return false; }
    }
    @PluginMethod public void start(PluginCall call) {
        String title = call.getString("title", "").trim(), url = call.getString("url", ""), vtt = call.getString("subtitle", "");
        Uri uri = Uri.parse(url); String path = uri.getPath() == null ? "" : uri.getPath().toLowerCase(java.util.Locale.ROOT);
        String ext = path.endsWith(".mp4") ? "mp4" : path.endsWith(".webm") ? "webm" : "";
        if (path.endsWith(".m3u8")) {
            int maxHeight = call.getInt("maxHeight", 720);
            if (maxHeight != 360 && maxHeight != 380 && maxHeight != 480 && maxHeight != 720 && maxHeight != 1080 && maxHeight != 1440 && maxHeight != 2160) { call.reject("Invalid quality"); return; }
            startHls(call, title, uri, vtt, maxHeight); return;
        }
        if (title.isEmpty() || title.length() > 200 || !"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null || ext.isEmpty() || !vtt.startsWith("WEBVTT\n") || vtt.length() > 2_000_000) {
            call.reject("A direct HTTPS MP4/WebM and a subtitle are required"); return;
        }
        Context c = getContext(); String id = UUID.randomUUID().toString().replace("-", ""); long downloadId = -1;
        synchronized (LOCK) {
            try {
                try (FileOutputStream output = new FileOutputStream(subtitle(c, id))) { output.write(vtt.getBytes(StandardCharsets.UTF_8)); }
                DownloadManager.Request req = new DownloadManager.Request(uri);
                req.setTitle(title); req.setDescription("Kurd Movie offline");
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalFilesDir(c, Environment.DIRECTORY_DOWNLOADS, "offline-" + id + "." + ext);
                downloadId = manager(c).enqueue(req);
                JSONObject item = new JSONObject(); item.put("id", id); item.put("title", title); item.put("ext", ext); item.put("downloadId", downloadId); item.put("export", call.getBoolean("autoExport", false) ? "pending" : "none");
                JSONArray all = entries(c); all.put(item); save(c, all);
                JSObject result = new JSObject(); result.put("id", id); call.resolve(result);
            } catch (Exception error) {
                if (downloadId >= 0) manager(c).remove(downloadId); subtitle(c, id).delete();
                call.reject("Unable to start download", error);
            }
        }
    }

    private void startHls(PluginCall call, String title, Uri uri, String vtt, int maxHeight) {
        if (title.isEmpty() || title.length() > 200 || !"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null || !vtt.startsWith("WEBVTT\n") || vtt.length() > 2_000_000) {
            call.reject("An HTTPS HLS stream and a subtitle are required"); return;
        }
        Context c = getContext().getApplicationContext();
        String id = UUID.randomUUID().toString().replace("-", "");
        getActivity().runOnUiThread(() -> {
            try {
                MediaItem media = new MediaItem.Builder().setMediaId(id).setUri(uri).setMimeType(MimeTypes.APPLICATION_M3U8).build();
                DownloadHelper helper = DownloadHelper.forMediaItem(media,
                    DownloadHelper.getDefaultTrackSelectorParameters(c).buildUpon().setMaxVideoSize(Integer.MAX_VALUE, maxHeight).setExceedVideoConstraintsIfNecessary(false).build(),
                    new DefaultRenderersFactory(c), HlsDownloads.http());
                helper.prepare(new DownloadHelper.Callback() {
                    @Override public void onPrepared(DownloadHelper prepared) {
                        try {
                            boolean hasVideo = false;
                            for (int p = 0; p < prepared.getPeriodCount(); p++) {
                                androidx.media3.exoplayer.trackselection.MappingTrackSelector.MappedTrackInfo info = prepared.getMappedTrackInfo(p);
                                for (int r = 0; r < info.getRendererCount(); r++)
                                    if (info.getRendererType(r) == C.TRACK_TYPE_VIDEO && !prepared.getTrackSelections(p, r).isEmpty()) hasVideo = true;
                            }
                            if (!hasVideo) throw new IllegalStateException("No playable video at this quality");
                            DownloadRequest request = prepared.getDownloadRequest(null).copyWithId(id);
                            try (FileOutputStream out = new FileOutputStream(subtitle(c, id))) { out.write(vtt.getBytes(StandardCharsets.UTF_8)); }
                            JSONObject item = new JSONObject(); item.put("id", id); item.put("title", title); item.put("ext", "m3u8"); item.put("export", call.getBoolean("autoExport", false) ? "pending" : "none");
                            synchronized (LOCK) { JSONArray all = entries(c); all.put(item); save(c, all); }
                            DownloadService.sendAddDownload(c, HlsDownloadService.class, request, false);
                            JSObject result = new JSObject(); result.put("id", id); call.resolve(result);
                        } catch (Exception error) {
                            synchronized (LOCK) { JSONArray all = entries(c), keep = new JSONArray(); for (int i = 0; i < all.length(); i++) { JSONObject row = all.optJSONObject(i); if (row != null && !id.equals(row.optString("id"))) keep.put(row); } save(c, keep); }
                            subtitle(c, id).delete(); call.reject("Unable to start HLS download", error);
                        } finally { prepared.release(); }
                    }
                    @Override public void onPrepareError(DownloadHelper prepared, IOException error) {
                        prepared.release(); call.reject("HLS stream unavailable or unsupported", error);
                    }
                });
            } catch (Exception error) { call.reject("Unable to prepare HLS", error); }
        });
    }
    private static Download hlsDownload(Context c, String id) {
        try { return HlsDownloads.manager(c).getDownloadIndex().getDownload(id); }
        catch (Exception ignored) { return null; }
    }
    @PluginMethod public void list(PluginCall call) {
        Context c = getContext(); JSArray result = new JSArray();
        synchronized (LOCK) {
            JSONArray a = entries(c);
            for (int i = a.length() - 1; i >= 0; i--) {
                JSONObject o = a.optJSONObject(i); if (o == null || !safeId(o.optString("id"))) continue;
                JSObject row = new JSObject(); row.put("id", o.optString("id")); row.put("title", o.optString("title"));
                row.put("export", o.optString("export", "none")); row.put("exportName", o.optString("exportName", ""));
                if ("m3u8".equals(o.optString("ext"))) {
                    Download d = hlsDownload(c, o.optString("id"));
                    row.put("kind", "hls");
                    if (d != null) {
                        row.put("bytes", d.getBytesDownloaded()); row.put("total", d.contentLength);
                        float percentage = d.getPercentDownloaded();
                        if (!Float.isNaN(percentage) && !Float.isInfinite(percentage) && percentage >= 0 && percentage <= 100) row.put("percent", percentage);
                        if (d.state == Download.STATE_QUEUED) row.put("phase", "queued");
                        else if (d.state == Download.STATE_STOPPED) row.put("phase", "paused");
                    }
                    row.put("state", d == null ? "downloading" : d.state == Download.STATE_COMPLETED && subtitle(c, o.optString("id")).isFile() ? "ready" : d.state == Download.STATE_FAILED ? "failed" : "downloading");
                } else {
                    row.put("kind", "file");
                    int state = status(c, o, row);
                    if (state == DownloadManager.STATUS_PENDING) row.put("phase", "queued");
                    else if (state == DownloadManager.STATUS_PAUSED) row.put("phase", "paused");
                    row.put("state", complete(c, o) ? "ready" : state == DownloadManager.STATUS_FAILED || state == DownloadManager.STATUS_SUCCESSFUL ? "failed" : "downloading");
                }
                result.put(row);
            }
        }
        JSObject response = new JSObject(); response.put("items", result); call.resolve(response);
    }
    @PluginMethod public void open(PluginCall call) {
        Context c = getContext(); String id = call.getString("id", "");
        synchronized (LOCK) {
            try {
                JSONObject item = find(c, id);
                if (item != null && "m3u8".equals(item.optString("ext"))) {
                    Download d = hlsDownload(c, id);
                    if (d == null || d.state != Download.STATE_COMPLETED || !subtitle(c, id).isFile()) throw new IllegalStateException();
                    Intent intent = new Intent(getActivity(), HlsPlayerActivity.class); intent.putExtra("id", id); getActivity().startActivity(intent);
                    JSObject result = new JSObject(); result.put("nativePlayer", true); call.resolve(result); return;
                }
                if (item == null || !complete(c, item)) throw new IllegalStateException();
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                try (FileInputStream in = new FileInputStream(subtitle(c, id))) { byte[] buffer = new byte[8192]; int n; while ((n = in.read(buffer)) != -1) { out.write(buffer, 0, n); if (out.size() > 8_000_000) throw new IllegalStateException(); } }
                JSObject result = new JSObject(); result.put("title", item.optString("title")); result.put("subtitle", out.toString("UTF-8"));
                result.put("url", "https://localhost/_offline/" + id + "." + item.optString("ext")); call.resolve(result);
            } catch (Exception error) { call.reject("Offline item is unavailable", error); }
        }
    }
    @PluginMethod public void getSubtitle(PluginCall call) {
        Context c = getContext(); String id = call.getString("id", "");
        if (!safeId(id)) { call.reject("Invalid item"); return; }
        synchronized (LOCK) {
            try {
                if (find(c, id) == null) throw new IllegalStateException();
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                try (FileInputStream in = new FileInputStream(subtitle(c, id))) {
                    byte[] buffer = new byte[8192]; int n;
                    while ((n = in.read(buffer)) != -1) { out.write(buffer, 0, n); if (out.size() > 8_000_000) throw new IllegalStateException(); }
                }
                JSObject result = new JSObject(); result.put("subtitle", out.toString("UTF-8")); call.resolve(result);
            } catch (Exception error) { call.reject("Subtitle is unavailable", error); }
        }
    }
    @PluginMethod public void updateSubtitle(PluginCall call) {
        Context c = getContext(); String id = call.getString("id", ""), vtt = call.getString("subtitle", "");
        if (!safeId(id) || !vtt.startsWith("WEBVTT\n") || vtt.length() > 2_000_000 || !vtt.contains(" --> ")) { call.reject("Invalid subtitle"); return; }
        synchronized (LOCK) {
            if (find(c, id) == null || GalleryExport.isExporting(id)) { call.reject("Item is unavailable or being exported"); return; }
            AtomicFile file = new AtomicFile(subtitle(c, id)); FileOutputStream out = null;
            try {
                out = file.startWrite(); out.write(vtt.getBytes(StandardCharsets.UTF_8)); file.finishWrite(out);
                JSONArray a = entries(c); for (int i = 0; i < a.length(); i++) { JSONObject item = a.optJSONObject(i); if (item != null && id.equals(item.optString("id")) && "done".equals(item.optString("export"))) item.put("export", "stale"); }
                save(c, a); call.resolve();
            }
            catch (Exception error) { if (out != null) file.failWrite(out); call.reject("Subtitle could not be saved", error); }
        }
    }
    static void exportFinished(Context c, String id, boolean success, String name, String uri) {
        synchronized (LOCK) {
            JSONArray a = entries(c);
            for (int i = 0; i < a.length(); i++) {
                JSONObject item = a.optJSONObject(i); if (item == null || !id.equals(item.optString("id"))) continue;
                try {
                    item.put("export", success ? "done" : "failed");
                    if (success) { item.put("exportName", name); item.put("exportUri", uri); }
                    save(c, a);
                } catch (Exception ignored) { }
                break;
            }
        }
    }
    @PluginMethod public void exportFiles(PluginCall call) {
        String id = call.getString("id", "");
        if (!safeId(id)) { call.reject("Invalid item"); return; }
        if (Build.VERSION.SDK_INT < 29 && getPermissionState("legacyStorage") != PermissionState.GRANTED) {
            requestPermissionForAlias("legacyStorage", call, "legacyStorageResult"); return;
        }
        startSharedExport(call);
    }
    @PermissionCallback private void legacyStorageResult(PluginCall call) {
        if (getPermissionState("legacyStorage") == PermissionState.GRANTED) startSharedExport(call);
        else { exportFinished(getContext(), call.getString("id", ""), false, null, null); call.reject("Storage permission denied"); }
    }
    private void startSharedExport(PluginCall call) {
        Context c = getContext(); String id = call.getString("id", "");
        getActivity().runOnUiThread(() -> {
            synchronized (LOCK) {
                try {
                    JSONObject item = find(c, id);
                    if (item == null || !subtitle(c, id).isFile()) throw new IllegalStateException();
                    String ext = item.optString("ext"); boolean hls = "m3u8".equals(ext); MediaItem media;
                    if (hls) {
                        Download d = hlsDownload(c, id);
                        if (d == null || d.state != Download.STATE_COMPLETED) throw new IllegalStateException();
                        media = d.request.toMediaItem();
                    } else {
                        if (!complete(c, item)) throw new IllegalStateException();
                        media = MediaItem.fromUri(Uri.fromFile(video(c, id, ext)));
                    }
                    if (GalleryExport.isExporting(id)) throw new IllegalStateException("Export already running");
                    SharedFileExport.start(c, id, item.optString("title"), media, subtitle(c, id), hls, call);
                } catch (Exception error) { exportFinished(c, id, false, null, null); call.reject("Offline item cannot be exported", error); }
            }
        });
    }
    @PluginMethod public void openExternal(PluginCall call) {
        Context c = getContext(); String id = call.getString("id", ""), address;
        if (!safeId(id)) { call.reject("Invalid item"); return; }
        synchronized (LOCK) { JSONObject item = find(c, id); address = item == null ? "" : item.optString("exportUri", ""); }
        try {
            Uri uri = Uri.parse(address);
            if (!"content".equals(uri.getScheme())) throw new IllegalArgumentException();
            try (android.content.res.AssetFileDescriptor descriptor = c.getContentResolver().openAssetFileDescriptor(uri, "r")) { if (descriptor == null) throw new IllegalStateException(); }
            Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "video/mp4").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(intent, "Open video")); call.resolve();
        } catch (Exception error) { call.reject("Exported video is unavailable", error); }
    }
    @PluginMethod public void exportGallery(PluginCall call) {
        Context c = getContext(); String id = call.getString("id", "");
        if (!safeId(id)) { call.reject("Invalid item"); return; }
        getActivity().runOnUiThread(() -> {
            synchronized (LOCK) {
                try {
                    JSONObject item = find(c, id);
                    if (item == null || !subtitle(c, id).isFile()) throw new IllegalStateException();
                    String ext = item.optString("ext"); boolean hls = "m3u8".equals(ext);
                    MediaItem media;
                    if (hls) {
                        Download d = hlsDownload(c, id);
                        if (d == null || d.state != Download.STATE_COMPLETED) throw new IllegalStateException();
                        media = d.request.toMediaItem();
                    } else {
                        if (!complete(c, item)) throw new IllegalStateException();
                        media = MediaItem.fromUri(Uri.fromFile(video(c, id, ext)));
                    }
                    GalleryExport.start(c, id, item.optString("title"), media, subtitle(c, id), hls, call);
                } catch (Exception error) { call.reject("Offline item is unavailable", error); }
            }
        });
    }
    @PluginMethod public void remove(PluginCall call) {
        Context c = getContext(); String id = call.getString("id", "");
        if (!safeId(id)) { call.reject("Invalid item"); return; }
        if (GalleryExport.isExporting(id)) { call.reject("Gallery export in progress"); return; }
        synchronized (LOCK) {
            JSONArray a = entries(c), remaining = new JSONArray();
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.optJSONObject(i); if (o == null) continue;
                if (id.equals(o.optString("id"))) {
                    if ("m3u8".equals(o.optString("ext"))) DownloadService.sendRemoveDownload(c, HlsDownloadService.class, id, false);
                    else { manager(c).remove(o.optLong("downloadId"));
                    try { video(c, id, o.optString("ext")).delete(); } catch (Exception ignored) { } }
                    subtitle(c, id).delete();
                } else remaining.put(o);
            }
            save(c, remaining); call.resolve();
        }
    }
    static File playable(Context c, String id, String ext) {
        synchronized (LOCK) { JSONObject o = find(c, id); return o != null && ext.equals(o.optString("ext")) && complete(c, o) ? video(c, id, ext) : null; }
    }
}
