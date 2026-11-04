package app.dimo.movies;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;

// Only an unguessable per-player URL can read this in-memory subtitle. Nothing
// is written to disk or sent to a separate hosting service.
@CapacitorPlugin(name = "MenuSubtitle")
public class MenuSubtitlePlugin extends Plugin {
    static final class Track {
        final String token;
        final byte[] body;
        Track(String token, byte[] body) { this.token = token; this.body = body; }
    }
    private static volatile Track track;

    @PluginMethod
    public void setTrack(PluginCall call) {
        String token = call.getString("token", "");
        String text = call.getString("text", "");
        if (!token.matches("[a-f0-9]{32}") || !text.startsWith("WEBVTT\n") || text.length() > 2_000_000) {
            call.reject("Invalid subtitle track");
            return;
        }
        track = new Track(token, text.getBytes(StandardCharsets.UTF_8));
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        String token = call.getString("token", "");
        Track existing = track;
        if (existing != null && existing.token.equals(token)) track = null;
        call.resolve();
    }

    static Track getTrack() { return track; }
}
