// Inspect advertised HLS variants and one high-resolution segment without retaining signed URLs.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const keep=setInterval(()=>{},1000);
const fetchTimed=(u,o={})=>fetch(u,{...o,signal:AbortSignal.timeout(60000)});
try {
 const m=await (await fetchTimed('https://www.dailymotion.com/player/metadata/video/k3jnwKOGjrLyixEG4nc')).json();
 const stream=m.qualities.auto.find(x=>/mpegurl/i.test(x.type));
 const masterResponse=await fetchTimed(stream.url); if(!masterResponse.ok) throw Error(`Master HTTP ${masterResponse.status}`);
 const lines=(await masterResponse.text()).split(/\r?\n/);
 const variants=[];
 for(let i=0;i<lines.length;i++) if(lines[i].startsWith('#EXT-X-STREAM-INF:')) {
   const resolution=lines[i].match(/RESOLUTION=(\d+x\d+)/)?.[1]; const bandwidth=lines[i].match(/BANDWIDTH=(\d+)/)?.[1];
   const path=lines.slice(i+1).find(x=>x.trim()&&!x.startsWith('#')); if(resolution&&path) variants.push({resolution,bandwidth,url:new URL(path.trim(),masterResponse.url).href});
 }
 console.log(`::notice title=Available actual qualities::${variants.map(v=>`${v.resolution} (${v.bandwidth} bps)`).join(', ')}`);
 const chosen=variants.find(x=>Number(x.resolution.split('x')[0])>=3000);
 if(!chosen) {console.log('::notice title=4K availability::No 4K variant in this episode master manifest.'); process.exitCode=1;}
 else {
  const playlist=await fetchTimed(chosen.url);if(!playlist.ok)throw Error(`4K manifest HTTP ${playlist.status}`);
  const text=await playlist.text();if(/#EXT-X-KEY:(?!METHOD=NONE)/.test(text))throw Error('Protected 4K stream');
  const init=text.match(/#EXT-X-MAP:URI="([^"]+)"/)?.[1];
  const segment=text.split(/\r?\n/).find(line=>line.trim()&&!line.startsWith('#'));
  if(!init||!segment) throw Error('Missing init or first 4K segment');
  const buffers=[];
  for(const path of [init,segment]) {const r=await fetchTimed(new URL(path,playlist.url).href);if(!r.ok)throw Error(`4K segment HTTP ${r.status}`);const b=Buffer.from(await r.arrayBuffer());if(b.length>30_000_000)throw Error('Segment too large');buffers.push(b);}
  writeFileSync('/tmp/donghua-4k-sample.mp4',Buffer.concat(buffers));
  const metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height','-of','json','/tmp/donghua-4k-sample.mp4'],{encoding:'utf8'}));
  console.log(`::notice title=Actual high quality sample::${JSON.stringify(metadata.streams)}`);
 }
} catch(error) {console.log(`::error title=Donghua quality test::${error.message}`);process.exitCode=1;}
finally {clearInterval(keep);}
