package app.dimo.movies;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DonkeyPlayerPlugin.class);
        registerPlugin(MenuSubtitlePlugin.class);
        registerPlugin(UpdaterPlugin.class);
        registerPlugin(OfflinePlugin.class);
        super.onCreate(savedInstanceState);
        getBridge().getWebView().setWebViewClient(new SubtitleWebViewClient(getBridge()));
    }
}
