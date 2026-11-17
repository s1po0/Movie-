import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('startup fallback shows a retry action if the app fails to load', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const message = { textContent: '' }, button = { hidden: true };
  let startup = { querySelector: selector => selector === 'span' ? message : button };
  let onError, onTimeout;
  const document = { querySelector: () => startup };
  const window = { addEventListener: (name, fn) => { if (name === 'error') onError = fn; } };
  runInNewContext(script, { document, window, setTimeout: fn => { onTimeout = fn; } });
  assert.equal(typeof onError, 'function');
  assert.equal(typeof onTimeout, 'function');
  onError();
  assert.match(message.textContent, /بار نەبوو/);
  assert.equal(button.hidden, false);
  // After the app has rendered, the timeout must not replace its contents.
  startup = null;
  assert.doesNotThrow(onTimeout);
});
