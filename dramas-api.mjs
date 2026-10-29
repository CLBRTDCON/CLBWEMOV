import {catalogEligible} from './catalog-api.mjs';
import {cinemeta} from './catalog-api.mjs';

const platformBase='https://7a82163c306e-stremio-netflix-catalog-addon.baby-beamup.club';
const countryNames=new Map([['South Korea','K-dramas'],['Korea, Republic of','K-dramas'],['China','Dramas chinos'],['Taiwan','Dramas taiwaneses'],['Japan','Dramas japoneses'],['Thailand','Dramas tailandeses'],['Hong Kong','Dramas de Hong Kong'],['Philippines','Dramas filipinos']]);
const korean=item=>['South Korea','Korea, Republic of'].includes(item.country);
function poster(value){try{const u=new URL(value);return u.protocol==='https:'&&['images.metahub.space','image.tmdb.org','m.media-amazon.com','images.justwatch.com'].includes(u.hostname)?u.href:'';}catch{return '';}}

export function asianItem(m,platforms=[]){
 if(!catalogEligible(m)||m.type!=='series'||!/^tt\d{7,12}$/.test(m.id||'')||typeof m.name!=='string')return null;
 const countries=Array.isArray(m.country)?m.country:typeof m.country==='string'?m.country.split(/,\s*(?!Republic of)/):[];
 const country=countries.find(c=>countryNames.has(c.trim()))?.trim(),genres=Array.isArray(m.genres)?m.genres:[];
 if(!country||genres.some(g=>['Animation','Documentary','Reality-TV','Talk-Show','Game-Show','News','Sport'].includes(g)))return null;
 const year=Number(String(m.releaseInfo||m.year||'').slice(0,4))||null,released=Number.isFinite(Date.parse(m.released))?m.released:null;
 if(year>new Date().getFullYear()||released&&Date.parse(released)>Date.now())return null;
 return {id:m.id,kind:'series',section:'drama',name:m.name.slice(0,200),year,released,genres:[countryNames.get(country)],country,posterUrl:poster(m.poster),platforms,catalog:'Dramas asiáticos',availability:'pending'};
}

export function createDramasApi({metadata=cinemeta,fetcher=(...args)=>globalThis.fetch(...args)}={}){
 const cache=new Map();
 async function cached(key,read){
  const previous=cache.get(key);if(previous&&previous.expires>Date.now())return previous.task;
  const entry={expires:Date.now()+300000,task:null};
  entry.task=read().catch(error=>{if(cache.get(key)===entry)cache.delete(key);throw error;});
  if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,entry);return entry.task;
 }
 async function feed(platform){
  return cached(platform,async()=>{
   const r=await fetcher(`${platformBase}/catalog/series/${platform}.json`,{signal:AbortSignal.timeout(18000),redirect:'error'});
   if(!r.ok)throw Error(`${platform==='vik'?'Viki':'iQIYI'} respondió HTTP ${r.status}.`);
   const body=await r.text();if(body.length>4_000_000)throw Error('Metadatos demasiado grandes.');
   const d=JSON.parse(body);if(!Array.isArray(d.metas))throw Error('Formato del catálogo asiático no reconocido.');
   return d.metas.map(m=>asianItem(m,[platform])).filter(Boolean);
  });
 }
 return async(req,res)=>{
  const u=new URL(req.url,'https://app.invalid'),send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  if(u.pathname==='/api/dramas/detail'){
   send(410,{error:'ReelShort se retiró de CLB porque no ofrece acceso gratuito a las historias completas.'});return;
  }
  const source=u.searchParams.get('source')||'kdrama',q=(u.searchParams.get('q')||'').trim(),skip=Number(u.searchParams.get('skip')||0),year=u.searchParams.get('year')||'all';
  if(u.pathname!=='/api/dramas/catalog'||!['all','series','asian','kdrama'].includes(source)||!Number.isInteger(skip)||skip<0||skip>100||q.length>120||/[\u0000-\u001f]/.test(q)||(year!=='all'&&!/^\d{4}$/.test(year))){send(400,{error:'Filtros de dramas inválidos.'});return;}
  try{
   const results=await Promise.allSettled(['vik','iqi'].map(feed));
   if(results.every(r=>r.status==='rejected'))throw Error('No respondieron los catálogos asiáticos. Reintenta.');
   const warnings=results.filter(r=>r.status==='rejected').map(r=>r.reason.message),index=new Map();
   for(const r of results)if(r.status==='fulfilled')for(const item of r.value){const old=index.get(item.id);if(old)old.platforms=[...new Set([...old.platforms,...item.platforms])];else index.set(item.id,{...item});}
   let list=[...index.values()];
   if(q){const d=await metadata('catalog/series/top/'+new URLSearchParams({search:q})+'.json');list=(d.metas||[]).map(m=>{const known=index.get(m.id);return asianItem({...m,country:m.country||known?.country},known?.platforms||[]);}).filter(Boolean);}
   // Solo conservar K-dramas en esta entrega. Otros países quedan fuera hasta validar video, no solo metadatos.
   list=list.filter(korean);
   if(year!=='all')list=list.filter(i=>i.year===Number(year));
   send(200,{items:list.slice(skip*24,(skip+1)*24),nextSkip:skip+1,hasMore:(skip+1)*24<list.length,warnings,source:'K-dramas',note:'La reproducción completa y el idioma se validan por título.'});
  }catch(e){send(502,{error:e.message||'No se pudo cargar Dramas. Reintenta.'});}
 };
}
