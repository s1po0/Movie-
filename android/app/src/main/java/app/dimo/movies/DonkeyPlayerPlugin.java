package app.dimo.movies;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DonkeyPlayer")
public class DonkeyPlayerPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String address = call.getString("url", "https://donkey.to/");
        Uri uri = Uri.parse(address);
        String host = uri.getHost();
        if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null ||
                !(host.equalsIgnoreCase("donkey.to") || host.equalsIgnoreCase("www.donkey.to"))) {
            call.reject("Invalid Donkey URL");
            return;
        }
        Intent intent = new Intent(getActivity(), DonkeyActivity.class);
        intent.putExtra("url", address);
        getActivity().startActivity(intent);
        call.resolve();
    }
}
