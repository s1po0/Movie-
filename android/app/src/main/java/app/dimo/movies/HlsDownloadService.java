package app.dimo.movies;

import android.app.Notification;
import androidx.annotation.OptIn;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.offline.Download;
import androidx.media3.exoplayer.offline.DownloadManager;
import androidx.media3.exoplayer.offline.DownloadNotificationHelper;
import androidx.media3.exoplayer.offline.DownloadService;
import androidx.media3.exoplayer.scheduler.Scheduler;
import java.util.List;

@OptIn(markerClass = UnstableApi.class)
public final class HlsDownloadService extends DownloadService {
    private static final String CHANNEL = "hls_downloads";
    public HlsDownloadService() {
        super(921, DEFAULT_FOREGROUND_NOTIFICATION_UPDATE_INTERVAL, CHANNEL, R.string.hls_download_channel, 0);
    }
    @Override protected DownloadManager getDownloadManager() { return HlsDownloads.manager(this); }
    @Override protected Scheduler getScheduler() { return null; }
    @Override protected Notification getForegroundNotification(List<Download> downloads, int notMetRequirements) {
        return new DownloadNotificationHelper(this, CHANNEL).buildProgressNotification(this,
            android.R.drawable.stat_sys_download, null, null, downloads, notMetRequirements);
    }
}
