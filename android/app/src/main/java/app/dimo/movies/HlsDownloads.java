package app.dimo.movies;

import android.content.Context;
import androidx.annotation.OptIn;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.database.StandaloneDatabaseProvider;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.cache.NoOpCacheEvictor;
import androidx.media3.datasource.cache.SimpleCache;
import androidx.media3.exoplayer.offline.DownloadManager;
import java.io.File;
import java.util.concurrent.Executors;

/** One process-wide, non-evicting cache for user-managed offline downloads. */
@OptIn(markerClass = UnstableApi.class)
final class HlsDownloads {
    private static StandaloneDatabaseProvider database;
    private static SimpleCache cache;
    private static DownloadManager manager;
    static synchronized SimpleCache cache(Context context) {
        Context app = context.getApplicationContext();
        if (database == null) database = new StandaloneDatabaseProvider(app);
        if (cache == null) cache = new SimpleCache(new File(app.getFilesDir(), "hls-offline"), new NoOpCacheEvictor(), database);
        return cache;
    }
    static DefaultHttpDataSource.Factory http() {
        return new DefaultHttpDataSource.Factory().setAllowCrossProtocolRedirects(false)
                .setConnectTimeoutMs(15000).setReadTimeoutMs(30000);
    }
    static synchronized DownloadManager manager(Context context) {
        if (manager == null) {
            SimpleCache downloadCache = cache(context);
            manager = new DownloadManager(context.getApplicationContext(), database, downloadCache, http(), Executors.newFixedThreadPool(3));
        }
        return manager;
    }
}
