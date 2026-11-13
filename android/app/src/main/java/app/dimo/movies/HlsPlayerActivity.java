package app.dimo.movies;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import androidx.media3.common.Player;
import androidx.media3.common.text.CueGroup;
import androidx.annotation.OptIn;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.PlaceholderDataSource;
import androidx.media3.datasource.cache.CacheDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.offline.Download;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.ui.PlayerView;
import java.io.File;
import java.util.Collections;

/** Playback has no HTTP upstream: missing cache data fails rather than silently streaming. */
@OptIn(markerClass = UnstableApi.class)
public final class HlsPlayerActivity extends Activity {
    private ExoPlayer player;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        String id = getIntent().getStringExtra("id");
        if (id == null || !id.matches("[a-f0-9]{32}")) { finish(); return; }
        try {
            Download download = HlsDownloads.manager(this).getDownloadIndex().getDownload(id);
            File vtt = new File(getFilesDir(), "offline-" + id + ".vtt");
            if (download == null || download.state != Download.STATE_COMPLETED || !vtt.isFile()) { finish(); return; }
            MediaItem.SubtitleConfiguration subtitle = new MediaItem.SubtitleConfiguration.Builder(Uri.fromFile(vtt))
                .setMimeType(MimeTypes.TEXT_VTT).setLanguage("ckb").setSelectionFlags(androidx.media3.common.C.SELECTION_FLAG_DEFAULT).build();
            MediaItem media = download.request.toMediaItem().buildUpon().setSubtitleConfigurations(Collections.singletonList(subtitle)).build();
            DefaultDataSource.Factory localOnly = new DefaultDataSource.Factory(this, PlaceholderDataSource.FACTORY);
            CacheDataSource.Factory data = new CacheDataSource.Factory().setCache(HlsDownloads.cache(this)).setUpstreamDataSourceFactory(localOnly);
            player = new ExoPlayer.Builder(this).setMediaSourceFactory(new DefaultMediaSourceFactory(data)).build();
            if (BuildConfig.DEBUG) player.addListener(new Player.Listener() {
                @Override public void onPlaybackStateChanged(int state) { if (state == Player.STATE_READY) Log.i("HlsOfflineCheck", "ready"); }
                @Override public void onCues(CueGroup group) { if (!group.cues.isEmpty()) Log.i("HlsOfflineCheck", "cues"); }
            });
            PlayerView view = new PlayerView(this); view.setPlayer(player); setContentView(view);
            player.setMediaItem(media); player.prepare(); player.play();
        } catch (Exception error) { finish(); }
    }
    @Override protected void onDestroy() { if (player != null) player.release(); super.onDestroy(); }
}
