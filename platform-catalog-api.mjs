import {seriesApi} from './series-api.mjs';
import {catalogEligible,catalog} from './catalog-api.mjs';
import {invoke} from './kids-api.mjs';
import {animeApi} from './anime-api.mjs';
const origin='https://7a82163c306e-stremio-netflix-catalog-addon.baby-beamup.club';
export const platformCatalogs={movie:[['atp','Apple TV+'],['nfx','Netflix'],['hbm','HBO Max'],['dnp','Disney+'],['amp','Prime Video']],series:[['atp','Apple TV+'],['nfx','Netflix'],['hbm','HBO Max'],['dnp','Disney+'],['amp','Prime Video']],anime:[['cru','Crunchyroll'],['nfx','Netflix · Anime'],['anilist','AniList'],['kitsu','Kitsu']]};
export function netflixAnime(meta){const genres=Array.isArray(meta.genres)?meta.genres:Array.isArray(meta.genre)?meta.genre:[];const countries=Array.isArray(meta.country)?meta.country:String(meta.country||'').split(/[,;|]/);return genres.some(g=>/^(?:Animation|Anime|Animación)$/i.test(g))&&/^(?:Japan|Japón|JP)$/i.test(String(countries[0]||'').trim());}
const images=new Set(['images.metahub.space','image.tmdb.org','m.media-amazon.com','images.justwatch.com']);
function poster(value){try{const u=new URL(value);return u.protocol==='https:'&&images.has(u.hostname)?u.href:'';}catch{return '';}}
export function createPlatformCatalogApi({fetcher=fetch,anime=animeApi,movies=catalog,series=seriesApi,now=Date.now}={}){
 const cache=new Map(),pending=new Map();
 async function feed(kind,platform,skip){const key=[kind,platform,skip].join(':');const old=cache.get(key);if(old?.expires>now())return old.value;if(pending.has(key))return pending.get(key);
 const task=(async()=>{const r=await fetcher(`${origin}/catalog/${kind}/${platform}/skip=${skip}.json`,{signal:AbortSignal.timeout(15000),redirect:'error'});if(!r.ok)throw Error();const text=await r.text();if(text.length>4000000)throw Error();const d=JSON.parse(text);if(!Array.isArray(d.metas))throw Error();const value=d.metas.slice(0,100);if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{value,expires:now()+300000});return value;})().finally(()=>pending.delete(key));pending.set(key,task);return task;}
 function normalize(m,kind,platform,year){
  const type=kind==='movie'?'movie':'series';
  if(kind==='anime'&&platform==='nfx'&&!netflixAnime(m))return null;
  if(!catalogEligible(m,now())||m.type!==type||!/^tt\d{7,12}$/.test(m.id||'')||typeof m.name!=='string')return null;
  const y=Number(String(m.releaseInfo||m.year||m.released||'').slice(0,4))||null;
  if(year!=='all'&&y!==Number(year))return null;
  return {id:m.id,imdbId:m.id,name:m.name.slice(0,200),year:y,released:Number.isFinite(Date.parse(m.released))?new Date(m.released).toISOString():null,posterUrl:poster(m.poster),genres:(Array.isArray(m.genres)?m.genres:[]).filter(g=>typeof g==='string').slice(0,6),kind:type,section:kind,platforms:[platform],catalog:platformCatalogs[kind].find(([id])=>id===platform)[1]};
 }
 async function releases(kind,year,current){
  const key='releases:'+kind+':'+year,old=cache.get(key);if(old?.expires>now())return old.value;if(pending.has(key))return pending.get(key);
  const task=(async()=>{
   const years=year==='all'?[current,current-1]:[Number(year)];
   const tasks=platformCatalogs[kind].map(async([id])=>(await feed(kind,id,0)).map(m=>normalize(m,kind,id,year)).filter(Boolean));
   for(const y of years)tasks.push(invoke(kind==='movie'?movies:series,(kind==='movie'?'/api/catalog?':'/api/series/catalog?')+new URLSearchParams({kind:'recent',platform:'internet',year:y,skip:0})).then(d=>(d.movies||d.series||[]).map(i=>({...i,kind,section:kind}))));
   const results=await Promise.allSettled(tasks);if(results.every(r=>r.status==='rejected'))throw Error('No respondieron las fuentes de estrenos.');
   const merged=new Map();for(const i of results.flatMap(r=>r.status==='fulfilled'?r.value:[])){
    if(!years.includes(Number(i.year))||!catalogEligible(i,now()))continue;
    const id=i.imdbId||i.id,previous=merged.get(id);merged.set(id,previous?{...i,...previous,released:previous.released||i.released||null,platforms:[...new Set([...(previous.platforms||[]),...(i.platforms||[])])]}:i);
   }
   const date=i=>Number.isFinite(Date.parse(i.released))?Date.parse(i.released):Date.UTC(Number(i.year),0,1);
   const value=[...merged.values()].sort((a,b)=>date(b)-date(a)||a.name.localeCompare(b.name,'es'));
   if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{value,expires:now()+300000});return value;
  })().finally(()=>pending.delete(key));pending.set(key,task);return task;
 }
 return async(req,res)=>{let status=200,data;try{const p=new URL(req.url,'http://local').searchParams,kind=p.get('kind'),platform=p.get('platform'),skip=Number(p.get('skip')||0),year=p.get('year')||'all',current=new Date(now()).getUTCFullYear();
 if(!Object.hasOwn(platformCatalogs,kind)||!Number.isSafeInteger(skip)||skip<0||skip>50000||(year!=='all'&&(!/^\d{4}$/.test(year)||Number(year)<1920||Number(year)>current))){status=400;throw Error();}
 if(!platform){data={platforms:[...(['movie','series'].includes(kind)?[{id:'releases',name:'Estrenos'}]:[]),...(['movie','series'].includes(kind)&&year==='all'?[{id:'recommended',name:`Recomendadas · ${current-1}–${current}`}]:[]),...platformCatalogs[kind].map(([id,name])=>({id,name}))]};}
 else if(['movie','series'].includes(kind)&&platform==='releases'){const all=await releases(kind,year,current);data={items:all.slice(skip,skip+100),nextSkip:skip+100,hasMore:skip+100<all.length};}
 else if(['movie','series'].includes(kind)&&platform==='recommended'){const results=await Promise.all([current,current-1].map(y=>kind==='movie'?invoke(movies,'/api/catalog?'+new URLSearchParams({kind:'recent',year:y,skip:0})):invoke(series,'/api/series/catalog?'+new URLSearchParams({platform:'internet',year:y,skip:0}))));data={items:[...new Map(results.flatMap(d=>d.movies||d.series).map(i=>[i.imdbId||i.id,{...i,kind,section:kind}])).values()].slice(0,160),nextSkip:0,hasMore:false};}
 else if(!platformCatalogs[kind].some(([id])=>id===platform)){status=400;throw Error();}
 else if(kind==='anime'&&['anilist','kitsu'].includes(platform)){const d=await invoke(anime,'/api/anime/catalog?'+new URLSearchParams({source:platform,year,skip,sort:'popular'}));data={items:d.series.map(i=>({...i,kind:'anime',section:'anime'})),nextSkip:d.nextSkip,hasMore:d.hasMore};}
 else{const type=kind==='movie'?'movie':'series',metas=await feed(type,platform,skip);const items=metas.map(m=>normalize(m,kind,platform,year)).filter(Boolean);data={items,nextSkip:skip+100,hasMore:metas.length>0,pageKey:JSON.stringify(metas.map(m=>m?.id||''))};}
 }catch{if(status===200)status=502;data={error:status===400?'Filtros de plataforma inválidos.':'Esta plataforma no respondió. Puedes reintentar.'};}res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
}
