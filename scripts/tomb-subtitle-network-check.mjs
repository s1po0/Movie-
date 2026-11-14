import { seriesSourceUrl, movieSources } from '../src/vidlink.js';
import { parseSubtitles } from '../src/subtitles.js';
const headers = [
  {name:'default'},
  {name:'referer',headers:{Referer:'https://vidlink.pro/'}},
  {name:'browser',headers:{'User-Agent':'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', Referer:'https://vidlink.pro/tv/206343/2/1', Accept:'*/*', Origin:'https://vidlink.pro'}},
];
await Promise.all(headers.map(async ({name, headers}) => {
  try {
    const response = await fetch(seriesSourceUrl('206343',2,1), {headers,signal:AbortSignal.timeout(20000)});
    if (!response.ok) { console.log(`::notice title=Episode API ${name}::HTTP ${response.status}`); return; }
    const captions = movieSources(await response.json()).subtitles;
    const track = captions.find(item => /english|\beng?\b/i.test(item.label));
    const text = track ? await fetch(track.url, {headers,signal:AbortSignal.timeout(20000)}).then(r => r.text()) : '';
    console.log(`::notice title=Episode API ${name}::HTTP ${response.status}; English cues ${parseSubtitles(text).length}`);
  } catch(error) { console.log(`::notice title=Episode API ${name}::network failure`); }
}));
