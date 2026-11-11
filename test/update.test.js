import test from 'node:test';
import assert from 'node:assert/strict';
import { findUpdate } from '../src/update.js';
const release = (version, options = {}) => ({tag_name:`kurd-movie-v${version}`, draft:false, assets:[{name:'Kurd-Movie.apk',state:'uploaded',browser_download_url:`https://github.com/s1po0/Movie-/releases/download/kurd-movie-v${version}/Kurd-Movie.apk`}], ...options});
test('finds the latest published update from the exact trusted release path', () => {
  assert.deepEqual(findUpdate([release(16), release(15), release(17,{draft:true}), release(99,{tag_name:'runak-debug-v99'})], 14), {version:16,url:'https://github.com/s1po0/Movie-/releases/download/kurd-movie-v16/Kurd-Movie.apk'});
  assert.equal(findUpdate([release(14), release(13)], 14), null);
  assert.equal(findUpdate([release(99,{tag_name:'nali-v99'})], 14), null);
  assert.equal(findUpdate([release(15,{assets:[{name:'Kurd-Movie.apk',state:'uploaded',browser_download_url:'https://evil.example/Kurd-Movie.apk'}]})], 14), null);
  assert.throws(() => findUpdate({}, 14));
});
