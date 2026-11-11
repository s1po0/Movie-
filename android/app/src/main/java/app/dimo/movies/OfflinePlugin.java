package app.dimo.movies;

import android.app.DownloadManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Downloads only user-supplied direct files. Provider pages/HLS are not downloadable. */
@CapacitorPlugin(name = "Offline")
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
                JSONObject item = new JSONObject(); item.put("id", id); item.put("title", title); item.put("ext", ext); item.put("downloadId", downloadId);
                JSONArray all = entries(c); all.put(item); save(c, all);
                JSObject result = new JSObject(); result.put("id", id); call.resolve(result);
            } catch (Exception error) {
                if (downloadId >= 0) manager(c).remove(downloadId); subtitle(c, id).delete();
                call.reject("Unable to start download", error);
            }
        }
    }
    @PluginMethod public void list(PluginCall call) {
        Context c = getContext(); JSArray result = new JSArray();
        synchronized (LOCK) {
            JSONArray a = entries(c);
            for (int i = a.length() - 1; i >= 0; i--) {
                JSONObject o = a.optJSONObject(i); if (o == null || !safeId(o.optString("id"))) continue;
                JSObject row = new JSObject(); row.put("id", o.optString("id")); row.put("title", o.optString("title"));
                int state = status(c, o, row);
                row.put("state", complete(c, o) ? "ready" : state == DownloadManager.STATUS_FAILED || state == DownloadManager.STATUS_SUCCESSFUL ? "failed" : "downloading");
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
                if (item == null || !complete(c, item)) throw new IllegalStateException();
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                try (FileInputStream in = new FileInputStream(subtitle(c, id))) { byte[] buffer = new byte[8192]; int n; while ((n = in.read(buffer)) != -1) { out.write(buffer, 0, n); if (out.size() > 8_000_000) throw new IllegalStateException(); } }
                JSObject result = new JSObject(); result.put("title", item.optString("title")); result.put("subtitle", out.toString("UTF-8"));
                result.put("url", "https://localhost/_offline/" + id + "." + item.optString("ext")); call.resolve(result);
            } catch (Exception error) { call.reject("Offline item is unavailable", error); }
        }
    }
    @PluginMethod public void remove(PluginCall call) {
        Context c = getContext(); String id = call.getString("id", "");
        if (!safeId(id)) { call.reject("Invalid item"); return; }
        synchronized (LOCK) {
            JSONArray a = entries(c), remaining = new JSONArray();
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.optJSONObject(i); if (o == null) continue;
                if (id.equals(o.optString("id"))) {
                    manager(c).remove(o.optLong("downloadId"));
                    try { video(c, id, o.optString("ext")).delete(); } catch (Exception ignored) { }
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
