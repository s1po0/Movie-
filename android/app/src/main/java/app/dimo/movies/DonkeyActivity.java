package app.dimo.movies;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/** A separate WebView: remote pages never receive access to the Capacitor bridge. */
public class DonkeyActivity extends Activity {
    private WebView webView;
    private FrameLayout root;
    private View fullScreenView;
    private WebChromeClient.CustomViewCallback fullScreenCallback;
    private WebChromeClient chrome;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        setContentView(root);
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                String host = uri.getHost();
                return !"https".equalsIgnoreCase(uri.getScheme()) || host == null ||
                        !(host.equalsIgnoreCase("donkey.to") || host.equalsIgnoreCase("www.donkey.to"));
            }
        });
        chrome = new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullScreenView != null) { callback.onCustomViewHidden(); return; }
                fullScreenView = view;
                fullScreenCallback = callback;
                webView.setVisibility(View.GONE);
                root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            }
            @Override
            public void onHideCustomView() {
                if (fullScreenView == null) return;
                root.removeView(fullScreenView);
                fullScreenView = null;
                webView.setVisibility(View.VISIBLE);
                if (fullScreenCallback != null) fullScreenCallback.onCustomViewHidden();
                fullScreenCallback = null;
            }
        };
        webView.setWebChromeClient(chrome);
        String address = getIntent().getStringExtra("url");
        webView.loadUrl(address == null ? "https://donkey.to/" : address);
    }

    @Override
    public void onBackPressed() {
        if (fullScreenView != null) { chrome.onHideCustomView(); return; }
        if (webView.canGoBack()) { webView.goBack(); return; }
        super.onBackPressed();
    }

    @Override
    protected void onPause() {
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (fullScreenView != null) chrome.onHideCustomView();
        root.removeView(webView);
        webView.destroy();
        super.onDestroy();
    }
}
