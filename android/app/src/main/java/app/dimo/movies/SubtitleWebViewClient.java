package app.dimo.movies;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public final class SubtitleWebViewClient extends BridgeWebViewClient {
    private final Bridge appBridge;
    public SubtitleWebViewClient(Bridge bridge) { super(bridge); this.appBridge = bridge; }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if ("https".equals(uri.getScheme()) && "localhost".equals(uri.getHost()) && uri.getPort() == -1 &&
                "GET".equals(request.getMethod()) && uri.getQuery() == null && uri.getPath() != null &&
                uri.getPath().matches("/_offline/[a-f0-9]{32}\\.(mp4|webm)")) {
            return offlineResponse(uri, request);
        }
        MenuSubtitlePlugin.Track track = MenuSubtitlePlugin.getTrack();
        if (track != null && "GET".equals(request.getMethod()) && "https".equals(uri.getScheme()) &&
            "vidlink.pro".equals(uri.getHost()) && uri.getPort() == -1 && uri.getUserInfo() == null &&
            ("/dimo-sorani/" + track.token + ".vtt").equals(uri.getPath()) && uri.getQuery() == null) {
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "https://vidlink.pro");
            headers.put("Cache-Control", "no-store");
            return new WebResourceResponse("text/vtt", "UTF-8", 200, "OK", headers, new ByteArrayInputStream(track.body));
        }
        return super.shouldInterceptRequest(view, request);
    }

    private WebResourceResponse offlineResponse(Uri uri, WebResourceRequest request) {
        String name = uri.getLastPathSegment();
        String id = name.substring(0, 32), ext = name.substring(33);
        File file = OfflinePlugin.playable(appBridge.getContext(), id, ext);
        if (file == null) return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
        long size = file.length(), start = 0, end = size - 1;
        String range = request.getRequestHeaders().get("Range");
        if (range == null) range = request.getRequestHeaders().get("range");
        try {
            if (range != null) {
                if (!range.matches("bytes=\\d*-\\d*") || range.equals("bytes=-")) throw new IllegalArgumentException();
                String[] parts = range.substring(6).split("-", -1);
                if (parts[0].isEmpty()) { long suffix = Long.parseLong(parts[1]); if (suffix <= 0) throw new IllegalArgumentException(); start = Math.max(0, size - suffix); }
                else { start = Long.parseLong(parts[0]); if (!parts[1].isEmpty()) end = Math.min(end, Long.parseLong(parts[1])); }
                if (start >= size || end < start) throw new IllegalArgumentException();
            }
            FileInputStream stream = new FileInputStream(file); stream.getChannel().position(start);
            final long count = end - start + 1;
            InputStream limited = new FilterInputStream(stream) {
                long left = count;
                @Override public int read() throws IOException { if (left == 0) return -1; int n = super.read(); if (n >= 0) left--; return n; }
                @Override public int read(byte[] b, int off, int len) throws IOException { if (left == 0) return -1; int n = super.read(b, off, (int)Math.min(len, left)); if (n > 0) left -= n; return n; }
            };
            Map<String, String> headers = new HashMap<>(); headers.put("Accept-Ranges", "bytes"); headers.put("Content-Length", String.valueOf(count)); headers.put("Cache-Control", "no-store");
            if (range != null) headers.put("Content-Range", "bytes " + start + "-" + end + "/" + size);
            return new WebResourceResponse(ext.equals("mp4") ? "video/mp4" : "video/webm", null, range == null ? 200 : 206, range == null ? "OK" : "Partial Content", headers, limited);
        } catch (IllegalArgumentException error) {
            Map<String, String> headers = new HashMap<>(); headers.put("Content-Range", "bytes */" + size);
            return new WebResourceResponse("text/plain", "UTF-8", 416, "Range Not Satisfiable", headers, new ByteArrayInputStream(new byte[0]));
        } catch (IOException error) { return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", new HashMap<>(), new ByteArrayInputStream(new byte[0])); }
    }
}
