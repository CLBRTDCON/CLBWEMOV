// Elegibilidad del catálogo: descarta anuncios futuros, no certifica vídeo o idioma.
export function catalogEligible(meta,now=Date.now()) {
 if(!meta||typeof meta!=='object')return false;
 const status=String(meta.status||'').toUpperCase().replace(/[ -]/g,'_');
 if(['NOT_YET_RELEASED','UPCOMING','ANNOUNCED'].includes(status))return false;
 const fuzzy=meta.startDate;
 const rawDate=meta.released||meta.premiered||(fuzzy?.year&&fuzzy.month&&fuzzy.day?`${fuzzy.year}-${String(fuzzy.month).padStart(2,'0')}-${String(fuzzy.day).padStart(2,'0')}`:null);
 const released=typeof rawDate==='string'?Date.parse(rawDate):NaN;
 if(Number.isFinite(released)&&released>now)return false;
 const year=Number(String(meta.releaseInfo||meta.year||fuzzy?.year||'').slice(0,4));
 if(year>new Date(now).getUTCFullYear())return false;
 if(['CANCELLED','CANCELED'].includes(status)&&!Number.isFinite(released))return false;
 return true;
}
const catalogCache = new Map();
export async function cinemeta(path) {
  const cached = catalogCache.get(path);
  if (cached && cached.expires > Date.now()) return cached.data;
  let upstream = new URL(path, 'https://v3-cinemeta.strem.io/');
  const signal = AbortSignal.timeout(15000);
  let response;
  for (let hop = 0; hop < 4; hop++) {
    response = await fetch(upstream,{signal,redirect:'manual'});
    if (![301,302,303,307,308].includes(response.status)) break;
    const target = new URL(response.headers.get('location'), upstream);
    const liveMetadata=target.hostname==='cinemeta-live.strem.io' && target.pathname===upstream.pathname && /^\/meta\/(movie|series)\/tt\d{7,12}\.json$/.test(target.pathname) && !target.search;
    if (target.protocol !== 'https:' || target.username || target.password || target.hash || (target.port && target.port!=='443') || (!['v3-cinemeta.strem.io','cinemeta-catalogs.strem.io'].includes(target.hostname) && !liveMetadata)) throw new Error('redirect');
    await response.body?.cancel(); upstream = target;
  }
  if (!response.ok) throw new Error('upstream');
  const body = await response.text();
  if (body.length > 4_000_000) throw new Error('size');
  const data = JSON.parse(body);
  if (catalogCache.size >= 30) catalogCache.delete(catalogCache.keys().next().value);
  catalogCache.set(path,{data,expires:Date.now()+300000});
  return data;
}
export async function movieLookup(req,res) {
  const id = new URL(req.url,'https://app.invalid').searchParams.get('imdb');
  res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store');
  if (!/^tt\d{7,12}$/.test(id || '')) { res.writeHead(400); res.end(JSON.stringify({error:'ID IMDb inválido.'})); return; }
  try {
    const data = await cinemeta(`meta/movie/${id}.json`);
    const tmdb = Number(data.meta?.moviedb_id);
    if (!Number.isSafeInteger(tmdb) || tmdb <= 0) { res.writeHead(404); res.end(JSON.stringify({error:'No se encontró un ID TMDB para esta película. Prueba audio original o introduce el ID TMDB.'})); return; }
    res.end(JSON.stringify({id:String(tmdb),imdbId:id}));
  } catch { res.writeHead(502); res.end(JSON.stringify({error:'No se pudo resolver el identificador de la película. Reintenta.'})); }
}
export async function catalog(req, res) {
  const query = new URL(req.url, 'https://app.invalid').searchParams;
  const kind = query.get('kind');
  const year = query.get('year') === 'all' ? null : Number(query.get('year'));
  const search = (query.get('q') || '').trim();
  const skip = Number(query.get('skip') || 0);
  const currentYear = Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'America/Mexico_City'}).format(new Date()));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['popular','featured','recent','search'].includes(kind) || !Number.isInteger(skip) || skip < 0 || skip > 50000 || (year !== null && (!Number.isInteger(year) || year < 1920 || year > currentYear)) || (kind === 'recent' && year === null) || (kind === 'search' && (!search || search.length > 120 || /[\u0000-\u001f]/.test(search)))) { res.writeHead(400); res.end(JSON.stringify({error:'Filtros de catálogo inválidos.'})); return; }
  const route = kind === 'search' ? `top/search=${encodeURIComponent(search)}&skip=${skip}` : kind === 'recent' || year !== null ? `year/genre=${year}&skip=${skip}` : `${kind==='featured'?'imdbRating':'top'}/skip=${skip}`;
  try {
    const raw = await cinemeta(`catalog/movie/${route}.json`);
    if (!Array.isArray(raw.metas)) throw new Error('format');
    const movies = raw.metas.flatMap(m => {
      if (!catalogEligible(m) || !/^tt\d{7,12}$/.test(m.id || '') || typeof m.name !== 'string') return [];
      const released = Date.parse(m.released);
      const movieYear = kind === 'recent' ? (Number.isFinite(released) ? new Date(released).getUTCFullYear() : null) : Number(String(m.releaseInfo || m.year || '').slice(0,4));
      if (year !== null && movieYear !== year) return [];
      if (kind === 'recent' && (!Number.isFinite(released) || released > Date.now())) return [];
      let posterUrl = '';
      try { const url = new URL(m.poster); if (url.protocol === 'https:' && ['images.metahub.space','image.tmdb.org','m.media-amazon.com'].includes(url.hostname)) posterUrl = url.href; } catch {}
      const tmdb = Number(m.moviedb_id);
      return [{id:Number.isSafeInteger(tmdb) && tmdb > 0 ? String(tmdb) : m.id,imdbId:m.id,name:m.name.slice(0,200),year:kind === 'recent' ? String(new Date(released).getUTCFullYear()) : String(m.releaseInfo || m.year || '').slice(0,4),released:Number.isFinite(released) ? new Date(released).toISOString() : null,genres:(Array.isArray(m.genres) ? m.genres : []).filter(g=>typeof g==='string').slice(0,5),posterUrl}];
    });
    if (kind === 'recent') movies.sort((a,b)=>Date.parse(b.released)-Date.parse(a.released));
    res.end(JSON.stringify({movies,nextSkip:skip+raw.metas.length,hasMore:raw.metas.length>0,source:'Cinemeta'}));
  } catch { res.writeHead(502); res.end(JSON.stringify({error:'Cinemeta no respondió correctamente. Reintenta en unos momentos.'})); }
}
