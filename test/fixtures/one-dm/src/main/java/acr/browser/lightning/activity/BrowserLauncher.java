package acr.browser.lightning.activity;
import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
public class BrowserLauncher extends Activity {
  @Override public void onCreate(Bundle state) { super.onCreate(state);
    Log.i("OneDmFixture", "page=" + getIntent().getDataString());
  }
}
