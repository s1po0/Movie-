import { asianCatalogUrl, asianCatalogResults, subtitleIndexUrl, hasEnglishSubtitle } from '../src/asian-catalog.js';
try {
  const fetchJson = async url => { const r = await fetch(url, {signal: AbortSignal.timeout(25000)}); if (!r.ok) throw Error(`${r.status} ${url}`); return r.json(); };
  for (const region of ['korean','japanese','chinese']) {
    const batches = await Promise.all(Array.from({length:8}, (_,i) => fetchJson(asianCatalogUrl(region,i+1))));
    const candidates = batches.flatMap(data => asianCatalogResults(region,data));
    let verified = 0; let example;
    for (const movie of candidates) {
      try { if (hasEnglishSubtitle(await fetchJson(subtitleIndexUrl(movie)))) { verified++; example ||= movie.title; } } catch { /* source may fail */ }
    }
    console.log(`::notice title=Asian catalog ${region}::${candidates.length} candidates; ${verified} with an English subtitle index; example ${example || 'none'}`);
    if (!verified) throw Error(`No verified subtitle candidates found in first 8 pages for ${region}`);
  }
} catch(error) { console.log(`::error title=Asian catalog live check::${String(error.message).replace(/\n/g,' ')}`); process.exitCode=1; }
