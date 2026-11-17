import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('native branding filter is valid JavaScript and skips provider scripts', () => {
  const java = readFileSync('android/app/src/main/java/app/dimo/movies/DonkeyActivity.java', 'utf8');
  const block = java.split('private static final String HIDE_PROVIDER_BRANDING =')[1].split('private WebView webView;')[0];
  const script = [...block.matchAll(/"(?:\\.|[^"\\])*"/g)].map(match => JSON.parse(match[0])).join('');
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /SCRIPT\|STYLE/);
  assert.match(script, /MutationObserver/);
});
