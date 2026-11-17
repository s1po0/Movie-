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
    private static final String HIDE_PROVIDER_BRANDING =
            "(function(){" +
            "if(window.__dimoBrandFilter)return;window.__dimoBrandFilter=true;" +
            "var re=/\\bdonkey(?:\\.to)?\\b/gi;" +
            "var css=document.createElement('style');" +
            "css.textContent=\"header a[href='/'] img,header a[href='/'] svg,nav a[href='/'] img,nav a[href='/'] svg,header img[src*='logo' i],nav img[src*='logo' i],img[alt*='donkey' i],svg[aria-label*='donkey' i]{visibility:hidden!important}\";" +
            "(document.head||document.documentElement).appendChild(css);" +
            "function clean(n){" +
            "if(n.nodeType===3){var v=n.nodeValue.replace(re,'');if(v!==n.nodeValue)n.nodeValue=v;return;}" +
            "if(n.nodeType!==1)return;" +
            "if(/^(SCRIPT|STYLE|TEXTAREA|INPUT|VIDEO|AUDIO)$/.test(n.tagName))return;" +
            "if(/^(IMG|svg)$/i.test(n.tagName)&&/donkey/i.test((n.getAttribute('alt')||'')+' '+(n.getAttribute('aria-label')||'')))n.style.setProperty('visibility','hidden','important');" +
            "['alt','title','aria-label'].forEach(function(a){if(n.hasAttribute(a)){var v=n.getAttribute(a),r=v.replace(re,'');if(r!==v)n.setAttribute(a,r);}});" +
            "for(var c=n.firstChild;c;c=c.nextSibling)clean(c);" +
            "}" +
            "clean(document.documentElement);document.title='DIMO';" +
            "new MutationObserver(function(records){records.forEach(function(r){" +
            "if(r.type==='childList')r.addedNodes.forEach(clean);else clean(r.target);" +
            "});if(/donkey/i.test(document.title))document.title='DIMO';}).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['alt','title','aria-label']});" +
            "})();";

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
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // The provider runs without a native bridge. Only remove visible branding;
                // leave page scripts, links and video content untouched.
                view.evaluateJavascript(HIDE_PROVIDER_BRANDING, null);
            }
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
