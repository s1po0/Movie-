package app.dimo.movies;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import java.util.HashMap;
import java.util.Map;

public final class SubtitleWebViewClient extends BridgeWebViewClient {
    public SubtitleWebViewClient(Bridge bridge) { super(bridge); }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
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
}
