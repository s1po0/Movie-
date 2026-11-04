import test from 'node:test';
import assert from 'node:assert/strict';
import { findUpdate } from '../src/update.js';
const release = (version, options = {}) => ({tag_name:`nali-v${version}`, draft:false, assets:[{name:'Nali.apk',state:'uploaded',browser_download_url:`https://github.com/s1po0/Movie-/releases/download/nali-v${version}/Nali.apk`}], ...options});
test('finds the latest published update from the exact trusted release path', () => {
  assert.deepEqual(findUpdate([release(16), release(15), release(17,{draft:true}), release(99,{tag_name:'runak-debug-v99'})], 14), {version:16,url:'https://github.com/s1po0/Movie-/releases/download/nali-v16/Nali.apk'});
  assert.equal(findUpdate([release(14), release(13)], 14), null);
  assert.equal(findUpdate([release(15,{assets:[{name:'Nali.apk',state:'uploaded',browser_download_url:'https://evil.example/Nali.apk'}]})], 14), null);
  assert.throws(() => findUpdate({}, 14));
});
