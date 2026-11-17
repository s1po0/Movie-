package idm.internet.download.manager;
import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
public class Downloader extends Activity {
  @Override public void onCreate(Bundle state) { super.onCreate(state);
    Log.i("OneDmFixture", "download=" + getIntent().getDataString() + " filename=" + getIntent().getStringExtra("extra_filename") + " editor=" + getIntent().getBooleanExtra("force_editor", false));
  }
}
