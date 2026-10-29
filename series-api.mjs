import {catalogEligible} from './catalog-api.mjs';
const base = 'https://7a82163c306e-stremio-netflix-catalog-addon.baby-beamup.club';
const platforms = {nfx:'Netflix',hbm:'HBO Max',dnp:'Disney+',amp:'Prime Video',atp:'Apple TV+',pmp:'Paramount+',hlu:'Hulu',pcp:'Peacock',stz:'Starz',bbc:'BBC iPlayer',vik:'Rakuten Viki',shd:'Shudder',mp9:'Movistar+',dpe:'Discovery+',cts:'Curiosity Stream',bbo:'BritBox',act:'Acorn TV',iqi:'iQIYI',cru:'Crunchyroll'};
const cache = new Map();
const episodeCache = new Map();
async function tvmazeEpisodes(imdb) {
  const previous = episodeCache.get(imdb);
  if (previous && previous.expires > Date.now()) return previous.data;
  const signal = AbortSignal.timeout(10000);
  async function get(path) {
    let url = new URL(path,'https://api.tvmaze.com');
    for (let hop=0; hop<3; hop++) {
      const response = await fetch(url,{signal,redirect:'manual'});
      if ([301,302,307,308].includes(response.status)) {
        const target = new URL(response.headers.get('location'),url);
        await response.body?.cancel();
        if(target.protocol!=='https:' || target.hostname!=='api.tvmaze.com') throw new Error('redirect');
        url=target; continue;
      }
      if(!response.ok) throw new Error('TVmaze unavailable');
      const body=await response.text();
      if(body.length>4_000_000) throw new Error('size');
      return JSON.parse(body);
    }
    throw new Error('redirect limit');
  }
  const show=await get(`/lookup/shows?imdb=${imdb}`);
  if(!Number.isSafeInteger(show?.id) || show.id<1 || show.externals?.imdb!==imdb) throw new Error('identity');
  const data=await get(`/shows/${show.id}/episodes`);
  if(!Array.isArray(data)) throw new Error('format');
  if(episodeCache.size>=30) episodeCache.delete(episodeCache.keys().next().value);
  episodeCache.set(imdb,{data,expires:Date.now()+300000});
  return data;
}
const posterHosts = ['images.metahub.space','image.tmdb.org','m.media-amazon.com','images.justwatch.com'];
function poster(value) { try { const url = new URL(value); return url.protocol === 'https:' && posterHosts.includes(url.hostname) ? url.href : ''; } catch { return ''; } }
function item(m, providerIds = []) {
  if (!catalogEligible(m) || (m.type && m.type !== 'series') || !/^tt\d{7,12}$/.test(m.id || '') || typeof m.name !== 'string') return null;
  const genres = (Array.isArray(m.genres) ? m.genres : Array.isArray(m.genre) ? m.genre : []).filter(g=>typeof g==='string').slice(0,6);
  const date = Date.parse(m.released);
  return {id:m.id,name:m.name.slice(0,200),year:Number(String(m.releaseInfo || m.year || '').slice(0,4)) || null,released:Number.isFinite(date) ? new Date(date).toISOString() : null,posterUrl:poster(m.poster),genres,platforms:providerIds};
}
async function feed(id) {
  const previous = cache.get(id);
  if (previous && previous.expires > Date.now()) return previous.items;
  const response = await fetch(`${base}/catalog/series/${id}.json`,{signal:AbortSignal.timeout(15000),redirect:'error'});
  if (!response.ok) throw new Error('platform unavailable');
  const body = await response.text();
  if (body.length > 4_000_000) throw new Error('size');
  const data = JSON.parse(body);
  if (!Array.isArray(data.metas)) throw new Error('format');
  const items = data.metas.map(m=>item(m,[id])).filter(Boolean);
  cache.set(id,{items,expires:Date.now()+300000});
  return items;
}
function send(res,status,value) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(JSON.stringify(value)); }
export async function seriesApi(req,res,cinemeta) {
  const url = new URL(req.url,'https://app.invalid');
  if (url.pathname === '/api/series/detail') {
    const id = url.searchParams.get('id');
    if (!/^tt\d{7,12}$/.test(id || '')) { send(res,400,{error:'ID de serie inválido.'}); return; }
    try {
      const data = await cinemeta(`meta/series/${id}.json`);
      const meta = data.meta;
      if (!meta || meta.type !== 'series') { send(res,404,{error:'No hay ficha de esa serie.'}); return; }
      const tmdb = Number(meta.moviedb_id);
      let videos=Array.isArray(meta.videos) ? meta.videos : [], episodeSource='Cinemeta', episodeWarning='';
      if(!videos.some(v=>Number(v.season)>0 && Number(v.episode ?? v.number)>0)) {
        try {
          const backup=await tvmazeEpisodes(id);
          if(backup.some(v=>Number(v.season)>0 && Number(v.number)>0)) {
            videos=backup.map(v=>({...v,released:v.airstamp || v.airdate})); episodeSource='TVmaze';
          } else episodeWarning='No se encontraron episodios regulares en la fuente de respaldo.';
        } catch { episodeWarning='No se pudo consultar el respaldo de episodios. Solo se muestran los datos disponibles.'; }
      }
      const seen = new Set();
      const episodes = videos.flatMap(v => {
        const season = Number(v.season), episode = Number(v.episode ?? v.number);
        const key = `${season}:${episode}`;
        if (!Number.isInteger(season) || season < 0 || season > 1000 || !Number.isInteger(episode) || episode < 1 || episode > 10000 || seen.has(key)) return [];
        seen.add(key);
        const date = Date.parse(v.released || v.firstAired);
        return [{season,episode,name:String(v.name || `Episodio ${episode}`).slice(0,200),released:Number.isFinite(date) ? new Date(date).toISOString() : null,upcoming:Number.isFinite(date) && date > Date.now()}];
      }).sort((a,b)=>a.season-b.season || a.episode-b.episode);
      send(res,200,{id,tmdbId:Number.isSafeInteger(tmdb) && tmdb>0 ? String(tmdb) : null,name:String(meta.name || id).slice(0,200),description:String(meta.description || '').slice(0,4000),posterUrl:poster(meta.poster),episodes,episodeSource,episodeWarning});
    } catch { send(res,502,{error:'No se pudieron consultar temporadas y episodios. Reintenta.'}); }
    return;
  }
  if (url.pathname !== '/api/series/catalog') { send(res,404,{error:'Ruta no encontrada.'}); return; }
  const platform = url.searchParams.get('platform') || 'all';
  const q = (url.searchParams.get('q') || '').trim();
  const yearText = url.searchParams.get('year') || 'all';
  const year = yearText === 'all' ? null : Number(yearText);
  const skip = Number(url.searchParams.get('skip') || 0);
  const genre = url.searchParams.get('genre') || 'all';
  const sort = url.searchParams.get('sort') || 'popular';
  const currentYear = Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'America/Mexico_City'}).format(new Date()));
  if ((platform !== 'all' && platform !== 'internet' && !Object.hasOwn(platforms,platform)) || q.length>120 || /[\u0000-\u001f]/.test(q) || !Number.isInteger(skip) || skip<0 || skip>50000 || (year !== null && (!Number.isInteger(year) || year<1920 || year>currentYear)) || genre.length>60 || !['popular','rating','recent'].includes(sort)) { send(res,400,{error:'Filtros de series inválidos.'}); return; }
  try {
    if(platform==='internet') {
      const selectedYear=year ?? (sort==='recent' && !q ? currentYear : null);
      const extras=new URLSearchParams({skip:String(skip)});
      let catalog=sort==='rating'?'imdbRating':'top';
      if(q) extras.set('search',q);
      else if(selectedYear!==null) {catalog='year';extras.set('genre',String(selectedYear));}
      else if(genre!=='all') extras.set('genre',genre);
      const data=await cinemeta(`catalog/series/${catalog}/${extras}.json`);
      if(!Array.isArray(data.metas)) throw new Error('format');
      let shows=data.metas.map(m=>item(m)).filter(Boolean);
      const genres=[...new Set(shows.flatMap(s=>s.genres))].sort();
      if(selectedYear!==null) shows=shows.filter(s=>s.year===selectedYear);
      if(genre!=='all') shows=shows.filter(s=>s.genres.includes(genre));
      if(sort==='recent') {
        shows=shows.filter(s=>!s.released || Date.parse(s.released)<=Date.now());
        shows.sort((a,b)=>(Date.parse(b.released)||Date.UTC(b.year||1900,0,1))-(Date.parse(a.released)||Date.UTC(a.year||1900,0,1)));
      }
      send(res,200,{series:shows,total:null,nextSkip:skip+data.metas.length,hasMore:data.metas.length>0,platforms:[],genres:['Action','Adventure','Animation','Biography','Comedy','Crime','Documentary','Drama','Family','Fantasy','History','Horror','Mystery','Romance','Sci-Fi','Sport','Thriller','War','Western','Reality-TV','Talk-Show','Game-Show'],warnings:[],region:'No verificada',source:'Cinemeta',paged:true});
      return;
    }
    const ids = req.mobile && platform!=='all' ? [platform] : Object.keys(platforms).filter(id=>platform==='cru' ? id==='cru' : id!=='cru');
    const feeds = await Promise.allSettled(ids.map(id=>feed(id)));
    const warnings = [], index = new Map(), counts = {};
    feeds.forEach((result,i) => {
      const id = ids[i];
      if (result.status === 'rejected') { warnings.push(`${platforms[id]} no respondió.`); counts[id] = null; return; }
      counts[id] = result.value.length;
    });
    // Intercalar plataformas evita que «Todas» muestre solo el primer proveedor.
    const rows = Math.max(0,...feeds.map(r=>r.status==='fulfilled'?r.value.length:0));
    for (let row=0; row<rows; row++) for (let i=0; i<ids.length; i++) {
      const series = feeds[i].status==='fulfilled' ? feeds[i].value[row] : null;
      if (!series) continue;
      const existing = index.get(series.id);
      if (existing) { if (!existing.platforms.includes(ids[i])) existing.platforms.push(ids[i]); }
      else index.set(series.id,{...series,platforms:[...series.platforms]});
    }
    if (platform !== 'all' && counts[platform] === null) throw new Error('selected provider unavailable');
    let shows;
    if (q) {
      const data = await cinemeta(`catalog/series/top/search=${encodeURIComponent(q)}.json`);
      if (!Array.isArray(data.metas)) throw new Error('search format');
      shows = data.metas.map(m=> {
        const known = index.get(m?.id);
        const found = item(m,known?.platforms || []);
        if (!found) return null;
        return {...found,year:found.year || known?.year || null,genres:found.genres.length ? found.genres : known?.genres || [],posterUrl:found.posterUrl || known?.posterUrl || '',released:found.released || known?.released || null};
      }).filter(Boolean);
    } else {
      if (feeds.every(r=>r.status==='rejected')) throw new Error('all unavailable');
      shows = [...index.values()];
    }
    if (platform !== 'all') shows = shows.filter(s=>s.platforms.includes(platform));
    const genres = [...new Set(shows.flatMap(s=>s.genres))].sort();
    if (year !== null) shows = shows.filter(s=>s.year===year);
    if (genre !== 'all') shows = shows.filter(s=>s.genres.includes(genre));
    if (sort === 'recent') {
      shows = shows.filter(s=>!s.released || Date.parse(s.released)<=Date.now());
      shows.sort((a,b)=>(Date.parse(b.released)||Date.UTC(b.year||1900,0,1))-(Date.parse(a.released)||Date.UTC(a.year||1900,0,1)));
    }
    const selected = shows.slice(skip,skip+36);
    send(res,200,{series:selected,total:shows.length,nextSkip:skip+selected.length,hasMore:skip+selected.length<shows.length,platforms:ids.map(id=>({id,name:platforms[id],count:counts[id]})),genres,warnings,region:'No verificada',source:'Streaming Catalogs + Cinemeta'});
  } catch { send(res,502,{error:'No se pudo consultar el catálogo de series. Reintenta en unos momentos.'}); }
}

export const platformNames = platforms;
