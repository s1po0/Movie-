const base = 'https://v3-cinemeta.strem.io/catalog/movie/top';
const seen = new Set();
for (const skip of [0, 25, 49, 50, 98, 100, 200, 1000]) {
  try {
    const response = await fetch(skip ? `${base}/skip=${skip}.json` : `${base}.json`, { signal: AbortSignal.timeout(25000) });
    const json = await response.json();
    const ids = json.metas.map(x => x.id);
    const overlap = ids.filter(id => seen.has(id)).length;
    ids.forEach(id => seen.add(id));
    console.log(`::notice title=Skip ${skip}::status ${response.status}, count ${ids.length}, first ${ids[0]}, last ${ids.at(-1)}, previous overlap ${overlap}`);
  } catch (e) { console.log(`::error title=Skip ${skip}::${e.message} ${e.cause?.message || ''}`); process.exitCode = 1; }
}
