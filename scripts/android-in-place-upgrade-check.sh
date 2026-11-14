#!/usr/bin/env bash
# The two test APKs must use the same signing key and increasing versionCodes.
# This checks an actual Android package upgrade and preservation of private app data.
set -euo pipefail
adb install /tmp/kurd-upgrade-old.apk
adb shell run-as app.dimo.movies sh -c "'mkdir -p files && echo preserved-data > files/upgrade-check'"
adb install -r /tmp/kurd-upgrade-new.apk
result=$(adb shell run-as app.dimo.movies cat files/upgrade-check | tr -d '\r')
test "$result" = preserved-data
adb shell dumpsys package app.dimo.movies | grep -q "versionCode=$EXPECTED_VERSION "
echo '::notice title=Android in-place upgrade::The same-key newer APK installed over the older APK and preserved private app data.'
