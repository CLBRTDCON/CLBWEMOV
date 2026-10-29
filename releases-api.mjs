import {catalog,catalogEligible} from './catalog-api.mjs';
import {seriesApi} from './series-api.mjs';
import {animeApi} from './anime-api.mjs';
import {kidsApi,invoke} from './kids-api.mjs';
export function latestTitles(items,limit=18,allowAnimeYear=false){
  const seen=new Set();return items.filter(i=>{
    if(!catalogEligible(i))return false;
    const exact=/^\d{4}-\d{2}-\d{2}/.test(i.released||'')&&Number.isFinite(Date.parse(i.released));
    if(exact?Date.parse(i.released)>Date.now():!(allowAnimeYear&&i.kind==='anime'&&Number.isInteger(i.year)&&i.year>=1920&&i.year<=new Date().getFullYear()))return false;
    const key=(i.kind||'')+':'+i.id;if(seen.has(key))return false;seen.add(key);return true;
  }).sort((a,b)=>(Date.parse(b.released)||Date.UTC(b.year,0,1))-(Date.parse(a.released)||Date.UTC(a.year,0,1))).slice(0,limit);
}
export function createReleasesApi({movies=catalog,series=seriesApi,anime=animeApi,kids=kidsApi}={}){
  const cache=new Map();
  return async(req,res)=>{
    const u=new URL(req.url,'https://app.invalid'),kind=u.searchParams.get('kind'),platform=u.searchParams.get('platform')||'internet',format=u.searchParams.get('format')||'all',theme=u.searchParams.get('theme')||'all',year=u.searchParams.get('year')||'all';
    const send=(s,data)=>{res.writeHead(s,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    const current=new Date().getFullYear();
    const selection=u.searchParams.get('selection')||'all';
    if(!['movie','series','anime','kids'].includes(kind)||!/^\w{1,20}$/.test(platform)||!/^\w{1,20}$/.test(format)||!['all','animation','adventure'].includes(theme)||(year!=='all'&&(!/^\d{4}$/.test(year)||Number(year)<1920||Number(year)>current))){send(400,{error:'Filtros de estrenos inválidos.'});return;}
    if(!['all','movie','series','anime'].includes(selection)){send(400,{error:'Selección infantil inválida.'});return;}
    const key=JSON.stringify([kind,platform,format,theme,year,selection]),old=cache.get(key);if(old&&old.expires>Date.now()){send(200,old.data);return;}
    const years=year==='all'?[current,current-1]:[Number(year)],tasks=[];let childPartial=false;
    const childItems=d=>{if(d.warnings?.length)childPartial=true;return d.sections.flatMap(s=>s.items);};
    if(kind==='movie')for(const y of years)tasks.push(invoke(movies,`/api/catalog?kind=recent&year=${y}&skip=0`).then(d=>d.movies));
    if(kind==='series')for(const y of platform==='internet'?years:[year])tasks.push(invoke(series,'/api/series/catalog?'+new URLSearchParams({platform,sort:'recent',year:String(y),skip:0})).then(d=>d.series));
    if(kind==='anime')tasks.push(platform==='cru'?invoke(series,'/api/series/catalog?'+new URLSearchParams({platform:'cru',sort:'recent',year,skip:0})).then(d=>d.series):invoke(anime,'/api/anime/catalog?'+new URLSearchParams({source:'anilist',sort:'recent',year,format,skip:0})).then(d=>d.series));
    if(kind==='kids'){
      tasks.push(invoke(kids,'/api/kids/catalog?'+new URLSearchParams({kind:selection,sort:'recent',year,theme})).then(childItems));
      if(['all','movie'].includes(selection))for(const skip of [50,100])tasks.push(invoke(kids,'/api/kids/catalog?'+new URLSearchParams({kind:'movie',sort:'recent',year,theme,skip})).then(childItems));
    }
    const results=await Promise.allSettled(tasks);if(results.every(r=>r.status==='rejected')){send(502,{error:'No se pudieron consultar los últimos lanzamientos. Reintenta.'});return;}
    const data={items:latestTitles(results.flatMap(r=>r.status==='fulfilled'?r.value:[]),18,kind==='kids'),source:kind==='anime'?(platform==='cru'?'Crunchyroll':'AniList'):kind==='kids'?'Catálogos Kids':'Cinemeta',partial:childPartial||results.some(r=>r.status==='rejected'),note:kind==='kids'?'Estrenos de la selección infantil, no nuevos capítulos. El anime sin día informado se ordena por año.':'Fechas de estreno del título; no indican nuevos episodios ni disponibilidad de vídeo.'};
    if(data.partial)data.note+=' Algunas fuentes no respondieron: resultados parciales.';
    if(cache.size>=40)cache.delete(cache.keys().next().value);cache.set(key,{data,expires:Date.now()+300000});send(200,data);
  };
}
export const releasesApi=createReleasesApi();
