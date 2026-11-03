package app.dimo.movies;

import android.app.DownloadManager;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Environment;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {
    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            JSObject result = new JSObject();
            result.put("versionCode", info.versionCode);
            result.put("versionName", info.versionName);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to read app version", error);
        }
    }

    @PluginMethod
    public void download(PluginCall call) {
        String value = call.getString("url", "");
        Uri uri = Uri.parse(value);
        if (!value.matches("https://github\\.com/s1po0/Movie-/releases/download/nali-v[1-9][0-9]*/Nali\\.apk") ||
                !"https".equals(uri.getScheme()) || !"github.com".equals(uri.getHost())) {
            call.reject("Invalid update URL");
            return;
        }
        try {
            DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Request request = new DownloadManager.Request(uri);
            request.setTitle("Nali update");
            request.setDescription("Tap when the download finishes to install the update");
            request.setMimeType("application/vnd.android.package-archive");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS,
                    "Nali-update-" + System.currentTimeMillis() + ".apk");
            manager.enqueue(request);
            call.resolve();
        } catch (Exception error) {
            call.reject("Unable to start update download", error);
        }
    }
}
