import {catalogEligible} from './catalog-api.mjs';
import {cinemeta} from './catalog-api.mjs';
import {animeApi} from './anime-api.mjs';
import {seriesApi} from './series-api.mjs';
import {tvApi} from './tv-api.mjs';
const kinds=['movie','series','anime','tv'];
const titles={movie:'Una tarde de película',series:'Un episodio más',anime:'Pequeños mundos de anime',tv:'La tele de los peques'};
// Selección explícita: Family también contiene sátira para adultos. Solo IDs;
// títulos, imágenes, sinopsis y episodios se consultan en Internet.
export const childrenSeries=['tt7678620','tt3121722','tt0426769','tt0206512','tt0852863','tt1942683','tt0235917','tt0487849','tt6385540','tt0983983','tt0784896','tt0063951','tt1710177','tt5531466','tt1865718','tt2580046','tt1877889','tt0168366'];
const spanishNames={tt3121722:'PAW Patrol · Patrulla Canina',tt0206512:'Bob Esponja',tt0852863:'Phineas y Ferb',tt1942683:'El increíble mundo de Gumball',tt0235917:'Dora la exploradora',tt0983983:'La oveja Shaun',tt0784896:'La casa de Mickey Mouse',tt0063951:'Plaza Sésamo',tt1710177:'Los Octonautas',tt5531466:'Patoaventuras',tt1877889:'Las Tortugas Ninja'};
const blocked=new Set(['adult','horror','thriller','crime','war','ecchi','hentai','gore','mature','erotica','psychological']);
export function kidsEligible(meta,kind,classified=false){
  if(!catalogEligible(meta))return false;
  const genres=Array.isArray(meta.genres)?meta.genres:Array.isArray(meta.genre)?meta.genre:[];
  const names=genres.filter(g=>typeof g==='string').map(g=>g.toLowerCase());
  if(meta.is_nsfw||meta.isAdult||names.some(g=>blocked.has(g)))return false;
  if(kind==='series'){if(!names.includes('kids')&&!childrenSeries.includes(meta.id||meta.imdb_id))return false;}
  else if(!classified&&!names.includes(kind==='anime'?'kids':'family'))return false;
  const year=Number(String(meta.year||meta.releaseInfo||'').slice(0,4));if(year>new Date().getFullYear())return false;
  const released=Date.parse(meta.released);return !Number.isFinite(released)||released<=Date.now();
}
function poster(value){try{const u=new URL(value);return u.protocol==='https:'&&['images.metahub.space','image.tmdb.org','m.media-amazon.com','media.kitsu.app','media.kitsu.io'].includes(u.hostname)?u.href:'';}catch{return '';}}
export async function invoke(handler,url,meta=cinemeta){
  let status=200,body;await handler({url,method:'GET'},{setHeader(){},writeHead(s){status=s;},end(v){body=v;}},meta);
  const data=JSON.parse(body);if(status>=400)throw Error(data.error||'La fuente no respondió.');return data;
}
export function createKidsApi({metadata=cinemeta,anime=animeApi,series=seriesApi,tv=tvApi,fetcher=(...args)=>globalThis.fetch(...args)}={}){
  // El detalle de Cinemeta a veces recorta géneros: se conserva la clasificación
  // Family observada en el catálogo, solo en memoria y durante una hora.
  const classifiedMovies=new Map();
  async function page(kind,q,skip,theme,year,sort='popular'){
    let raw,items,nextSkip,hasMore,total=null,warning;
    if(kind==='tv'){
      const d=await invoke(tv,'/api/tv/catalog?'+new URLSearchParams({country:'all',category:'kids',q,skip}));
      return {kind,title:titles[kind],items:d.channels.map(c=>({...c,kind:'tv',posterUrl:'',genres:['Kids']})),nextSkip:d.nextSkip,hasMore:d.hasMore,total:d.total,stale:d.stale};
    }
    if(kind==='series'){
      // La búsqueda recorre la selección completa; no solo los títulos ya visibles.
      const batch=q||sort==='recent'?childrenSeries:childrenSeries.slice(skip,skip+12);
      const results=await Promise.allSettled(batch.map(async id=>{const d=await metadata(`meta/series/${id}.json`);if(d.meta?.id!==id)throw Error('Identidad de serie incorrecta.');return d;}));
      raw=results.filter(r=>r.status==='fulfilled').map(r=>r.value.meta).filter(Boolean);
      if(batch.length&&results.every(r=>r.status==='rejected'))throw Error('No se pudo cargar la selección de series infantiles.');
      if(results.some(r=>r.status==='rejected'))warning='No todas las fichas de series respondieron.';
      if(q){const normalize=v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();raw=raw.filter(m=>normalize((m.name||'')+' '+(spanishNames[m.id]||'')).includes(normalize(q)));}
      nextSkip=q?childrenSeries.length:skip+batch.length;hasMore=!q&&nextSkip<childrenSeries.length;
    }else if(kind==='anime'){
      const d=await invoke(anime,'/api/anime/catalog?'+new URLSearchParams({source:'kitsu',genre:'Kids',q,skip,year:'all',sort}),metadata);
      raw=d.series;nextSkip=d.nextSkip;hasMore=d.hasMore;
    }else{
      const extras=new URLSearchParams({skip:String(skip)});if(q)extras.set('search',q);else extras.set('genre','Family');
      const route=`top/${extras}`;
      const d=await metadata(`catalog/${kind}/${route}.json`);if(!Array.isArray(d.metas))throw Error('El catálogo familiar no respondió correctamente.');
      raw=d.metas;nextSkip=skip+raw.length;hasMore=raw.length>0;
    }
    items=raw.filter(m=>kidsEligible(m,kind)).flatMap(m=>{
      const id=kind==='anime'?m.id:m.imdbId||m.id||m.imdb_id;
      if(!(kind==='anime'?/^kitsu:\d{1,10}$/:/^tt\d{7,12}$/).test(id||'')||typeof m.name!=='string')return [];
      const genres=(m.genres||m.genre||[]).filter(g=>typeof g==='string');
      const itemYear=Number(String(m.year||m.releaseInfo||'').slice(0,4))||null;
      if(year!=='all'&&itemYear!==Number(year))return [];
      if(theme==='animation'&&kind!=='anime'&&!genres.includes('Animation')||theme==='adventure'&&!genres.includes('Adventure'))return [];
      if(kind==='movie'){if(classifiedMovies.size>=5000)classifiedMovies.delete(classifiedMovies.keys().next().value);classifiedMovies.set(id,Date.now()+3600000);}
      return [{id,kind,name:(kind==='series'?spanishNames[id]||m.name:m.name).slice(0,200),year:itemYear,released:Number.isFinite(Date.parse(m.released))?new Date(m.released).toISOString():null,genres,posterUrl:poster(m.posterUrl||m.poster),format:m.format||null}];
    });
    if(sort==='recent')items=items.filter(i=>i.released?Date.parse(i.released)<=Date.now():kind==='anime'&&Number.isInteger(i.year)&&i.year<=new Date().getFullYear()).sort((a,b)=>Date.parse(b.released)-Date.parse(a.released));
    return {kind,title:titles[kind],items,nextSkip,hasMore,total,warning};
  }
  return async function kidsApi(req,res){
    const u=new URL(req.url,'https://app.invalid');
    const send=(s,data)=>{res.writeHead(s,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
    const kind=u.searchParams.get('kind')||'all';
    if(u.pathname==='/api/kids/detail'){
      const id=u.searchParams.get('id');
      if(!['movie','series','anime'].includes(kind)||!(kind==='anime'?/^kitsu:\d{1,10}$/:/^tt\d{7,12}$/).test(id||'')){send(400,{error:'Título infantil inválido.'});return;}
      try{
        if(kind==='anime'){
          // La ficha conserva los géneros; se valida también al abrir, no solo en la lista.
          const raw=await fetcher(`https://anime-kitsu.strem.fun/meta/anime/${id}.json`,{signal:AbortSignal.timeout(15000),redirect:'error'});
          if(!raw.ok)throw Error('No se pudo comprobar la ficha infantil.');const text=await raw.text();if(text.length>4_000_000)throw Error('Ficha demasiado grande.');
          const meta=JSON.parse(text).meta;if(!meta||meta.id!==id||!kidsEligible(meta,'anime')){send(422,{error:'Esta ficha no tiene clasificación infantil compatible.'});return;}
          const data=await invoke(anime,`/api/anime/detail?id=${id}`,metadata);send(200,data);return;
        }
        const {meta}=await metadata(`meta/${kind}/${id}.json`);
        if(!meta||meta.id!==id||!kidsEligible(meta,kind,kind==='movie'&&classifiedMovies.get(id)>Date.now())){send(422,{error:'Esta ficha no tiene clasificación familiar compatible. Vuelve a cargar el catálogo Kids.'});return;}
        if(kind==='series'){const d=await invoke(series,`/api/series/detail?id=${id}`,metadata);send(200,{...d,name:spanishNames[id]||d.name});return;}
        const n=Number(meta.moviedb_id);
        send(200,{id,imdbId:id,tmdbId:Number.isSafeInteger(n)&&n>0?String(n):null,kind:'movie',playbackType:'movie',name:meta.name,description:String(meta.description||'').slice(0,4000),episodes:[]});
      }catch(error){send(502,{error:error.message});}return;
    }
    if(u.pathname!=='/api/kids/catalog'){send(404,{error:'Ruta no encontrada.'});return;}
    const sort=u.searchParams.get('sort')||'popular';
    const q=(u.searchParams.get('q')||'').trim(),skip=Number(u.searchParams.get('skip')||0),theme=u.searchParams.get('theme')||'all',year=u.searchParams.get('year')||'all';
    if(!['popular','recent'].includes(sort)||!['all',...kinds].includes(kind)||q.length>120||/[\u0000-\u001f]/.test(q)||!Number.isInteger(skip)||skip<0||skip>50000||!['all','animation','adventure'].includes(theme)||(year!=='all'&&(!/^\d{4}$/.test(year)||Number(year)<1920||Number(year)>new Date().getFullYear()))){send(400,{error:'Filtros Kids inválidos.'});return;}
    const selected=kind==='all'?kinds.filter(k=>k!=='tv'||sort!=='recent'&&theme==='all'&&year==='all'):[kind],results=await Promise.allSettled(selected.map(k=>page(k,q,skip,theme,year,sort)));
    const sections=[],warnings=[];results.forEach((r,i)=>{if(r.status==='fulfilled'){sections.push(r.value);if(r.value.warning)warnings.push({kind:selected[i],message:r.value.warning});}else warnings.push({kind:selected[i],message:r.reason.message});});
    send(sections.length?200:502,{sections,warnings,error:sections.length?undefined:'No se pudieron consultar los catálogos infantiles. Reintenta.'});
  };
}
export const kidsApi=createKidsApi();
