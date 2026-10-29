// Adaptación propia del protocolo público CATALOG//NET. Integración web de archivos directos.
import {catalogEligible} from './catalog-api.mjs';
export const CATALOGNET_ORIGIN='https://victory-incl-elephant-diesel.trycloudflare.com';
const YANDEX_ORIGIN='https://cloud-api.yandex.net';
class UpstreamError extends Error{constructor(message,status=502){super(message);this.status=status;}}
const text=(s,n=200)=>typeof s==='string'?s.slice(0,n):'';
export function shareURL(value){
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!['yadi.sk','disk.yandex.ru','disk.yandex.com','disk.yandex.com.tr','yandex.com','yandex.ru'].includes(u.hostname)||!/^\/(?:d|i)\/[A-Za-z0-9_-]+\/?$/.test(u.pathname)||u.search)throw new UpstreamError('El enlace público de la fuente no está admitido.');return u.href;
}
export function mediaURL(value){
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!['yandex.net','yandex.ru','yandex.com','yandexusercontent.com'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))throw new UpstreamError('El proveedor devolvió un dominio de vídeo no admitido.');return u.href;
}
// Resolve only Yandex-owned delivery hops. Never relay or store a movie body.
export async function resolveYandexDelivery(value,{fetcher=fetch}={}){
 let url=mediaURL(value);const seen=new Set(),signal=AbortSignal.timeout(15000);
 for(let hop=0;hop<4;hop++){
  if(seen.has(url))throw new UpstreamError('Yandex devolvió un ciclo de redirecciones.');seen.add(url);
  let response;try{response=await fetcher(url,{redirect:'manual',signal,headers:{Range:'bytes=0-0',Accept:'*/*'}});}catch{throw new UpstreamError('No se pudo comprobar la dirección de entrega de Yandex. Vuelve a seleccionar el archivo.');}
  const status=response.status,location=response.headers.get('location'),type=response.headers.get('content-type')||'';
  await response.body?.cancel();
  if([301,302,303,307,308].includes(status)){if(!location)throw new UpstreamError('Yandex redirigió sin indicar un destino.');url=mediaURL(new URL(location,url).href);continue;}
  if(status===429)throw new UpstreamError('Yandex limitó la lectura del archivo. Espera antes de reintentar.',429);
  if(status!==200&&status!==206)throw new UpstreamError(`La entrega de Yandex respondió HTTP ${status}. Vuelve a seleccionar el archivo para renovar su enlace.`);
  if(/text\/html|application\/json/i.test(type))throw new UpstreamError('Yandex devolvió una página en lugar del vídeo. Prueba otra opción.');
  return url;
 }
 throw new UpstreamError('Yandex excedió el límite de redirecciones de entrega.');
}
export function requestIdentity(params){
 const kind=params.get('kind'),id=params.get('id'),season=Number(params.get('season')),episode=Number(params.get('episode'));
 if(!['movie','series'].includes(kind)||! /^(?:[1-9]\d{0,11})$/.test(id||''))throw new UpstreamError('Identidad de catálogo inválida.',400);
 if(kind==='series'&&(!params.has('season')||!params.has('episode')||!Number.isInteger(season)||season<0||season>1000||!Number.isInteger(episode)||episode<1||episode>10000))throw new UpstreamError('Selecciona una temporada y un episodio válidos.',400);
 return {kind,id,season,episode};
}
function cleanItem(meta,kind){
 const id=String(meta?.id||'');if(!new RegExp(`^${kind}:[1-9]\\d{0,11}$`).test(id)||!text(meta.name)||!catalogEligible(meta))return null;
 let poster='';try{const u=new URL(meta.poster);if(u.origin==='https://image.tmdb.org'&&u.pathname.startsWith('/t/p/'))poster=u.href;}catch{}
 return {id:id.split(':')[1],kind,name:text(meta.name),poster,year:text(String(meta.releaseInfo||''),20)};
}
function formatOf(meta){const name=String(meta?.name||''),mime=String(meta?.mime_type||'');if(/\.mkv$/i.test(name)||mime==='video/x-matroska')return 'mkv';if(/\.webm$/i.test(name)||mime==='video/webm')return 'webm';if(/\.(mp4|m4v)$/i.test(name)||mime==='video/mp4')return 'mp4';throw new UpstreamError('El archivo no anuncia un formato de vídeo admitido por esta prueba.',422);}
export function createCatalognetApi({fetcher=(...args)=>fetch(...args),now=Date.now}={}){
 const cache=new Map(),pending=new Map();let resolving=0;
 async function json(url){
  const u=new URL(url);if(![CATALOGNET_ORIGIN,YANDEX_ORIGIN].includes(u.origin))throw new UpstreamError('Destino no permitido.');
  let response;try{response=await fetcher(u,{signal:AbortSignal.timeout(15000),redirect:'manual',headers:{Accept:'application/json'}});}catch{throw new UpstreamError('No se pudo conectar con el catálogo o Yandex. El túnel puede haber dejado de estar disponible.');}
  if(response.status===429)throw new UpstreamError('Yandex o el catálogo limitaron las consultas. Espera antes de reintentar.',429);
  if(!response.ok)throw new UpstreamError(response.status===404?'La fuente no tiene ese recurso.':`El servicio respondió HTTP ${response.status}.`,response.status===404?404:502);
  if(!response.body)throw new UpstreamError('La fuente devolvió una respuesta vacía.');
  const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.byteLength;if(size>2_000_000)throw new UpstreamError('La respuesta supera el límite de esta prueba.');chunks.push(Buffer.from(chunk));}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new UpstreamError('La fuente no devolvió JSON válido.');}
 }
 function cached(path){const old=cache.get(path);if(old&&old.expires>now())return Promise.resolve(old.data);if(pending.has(path))return pending.get(path);const task=json(new URL(path,CATALOGNET_ORIGIN)).then(data=>{if(cache.size>=40)cache.delete(cache.keys().next().value);cache.set(path,{data,expires:now()+60000});return data;}).finally(()=>pending.delete(path));pending.set(path,task);return task;}
 async function detail(identity){const {kind,id}=identity;const data=await cached(`/addon/meta/${kind}/${kind}:${id}.json`);const item=cleanItem(data.meta,kind);if(!item||item.id!==id)throw new UpstreamError('La identidad devuelta por el catálogo no coincide.',502);const seen=new Set();const episodes=kind==='series'?(Array.isArray(data.meta.videos)?data.meta.videos:[]).flatMap(e=>{if(!Number.isInteger(e.season)||e.season<0||e.season>1000||!Number.isInteger(e.episode)||e.episode<1||e.episode>10000||e.released&&Date.parse(e.released)>now())return [];const key=e.season+':'+e.episode;if(seen.has(key))return [];seen.add(key);return [{season:e.season,episode:e.episode,name:text(e.title||e.name)||'Episodio '+e.episode}];}).sort((a,b)=>a.season-b.season||a.episode-b.episode):[];return {item:{...item,description:text(data.meta.description,4000)},episodes};}
 async function links(identity){
  const {kind,id,season,episode}=identity;if(kind==='series'){const d=await detail(identity);if(!d.episodes.some(e=>e.season===season&&e.episode===episode))throw new UpstreamError('El capítulo no figura en el catálogo. No se sustituye por otro.',404);}
  const data=await cached(`/addon/links/${kind==='series'?'tv':'movie'}/${id}.json`+(kind==='series'?`?s=${season}&e=${episode}`:''));if(!Array.isArray(data))throw new UpstreamError('Respuesta de enlaces no válida.');return data.slice(0,12);
 }
 return async function catalognet(req,res){
  let status=200,body;try{
   const u=new URL(req.url,'http://lab.invalid'),p=u.searchParams;const name=u.pathname.split('/').at(-1);
   if(name==='catalog'){
    const kind=p.get('kind')||'movie',q=(p.get('q')||'').trim(),skip=Number(p.get('skip')||0);if(!['movie','series'].includes(kind)||q.length>120||!Number.isInteger(skip)||skip<0||skip>5000)throw new UpstreamError('Filtros de catálogo inválidos.',400);
    const extra=[];if(q)extra.push('search='+encodeURIComponent(q));if(skip)extra.push('skip='+skip);const path=`/addon/catalog/${kind}/catalognet${extra.length?'/'+extra.join('&'):''}.json`,data=await cached(path);if(!Array.isArray(data.metas))throw new UpstreamError('El catálogo no devolvió una lista.');
    body={items:data.metas.map(m=>cleanItem(m,kind)).filter(Boolean).slice(0,60),nextSkip:skip+data.metas.length,hasMore:data.metas.length>0,source:'CATALOG//NET',note:'El listado y sus idiomas son declarados por la fuente; no certifican reproducción ni doblaje.'};
   }else if(name==='detail'){
    const kind=p.get('kind'),id=p.get('id');if(!['movie','series'].includes(kind)||! /^[1-9]\d{0,11}$/.test(id||''))throw new UpstreamError('Título inválido.',400);body=await detail({kind,id});
   }else if(name==='links'){
    const identity=requestIdentity(p),rows=await links(identity);body={sources:rows.flatMap((l,index)=>{try{shareURL(l.share);}catch{return [];}const langs=(Array.isArray(l.langs)?l.langs:[]).map(v=>text(v,40)).slice(0,8);return [{index,title:text(l.title),quality:text(l.quality,50),size:text(l.size,60),languages:langs}];}),note:'El enlace temporal se solicita a Yandex solo al pulsar reproducir. Dual no confirma latino.'};
   }else if(name==='resolve'){
    const identity=requestIdentity(p),index=Number(p.get('index'));if(!p.has('index')||!Number.isInteger(index)||index<0||index>=12)throw new UpstreamError('Opción de reproducción inválida.',400);if(resolving>=3)throw new UpstreamError('Ya hay tres resoluciones en curso. Espera un momento.',429);resolving++;
    try{const rows=await links(identity),row=rows[index];if(!row)throw new UpstreamError('Ese archivo ya no está disponible.',404);const share=shareURL(row.share);const metadata=new URL('/v1/disk/public/resources',YANDEX_ORIGIN);metadata.searchParams.set('public_key',share);metadata.searchParams.set('fields','name,mime_type,size,type');const meta=await json(metadata);if(meta.type&&meta.type!=='file')throw new UpstreamError('La opción apunta a una carpeta, no a un vídeo.',422);const format=formatOf(meta);const request=new URL('/v1/disk/public/resources/download',YANDEX_ORIGIN);request.searchParams.set('public_key',share);const result=await json(request);if(typeof result.href!=='string')throw new UpstreamError('Yandex no entregó un enlace de reproducción. Puede haber un límite temporal.');body={url:await resolveYandexDelivery(result.href,{fetcher}),format,filename:text(meta.name),bytes:Number.isFinite(meta.size)?meta.size:0,languageEvidence:'declared',note:'URL temporal solicitada por el servidor local. Se comprueba la entrega con una lectura parcial y no se almacena el vídeo en CLB. La red del dispositivo puede afectar al acceso.'};}finally{resolving--;}
   }else throw new UpstreamError('Ruta de catálogo no encontrada.',404);
  }catch(error){status=error instanceof UpstreamError?error.status:502;body={error:error instanceof UpstreamError?error.message:'No se pudo procesar la fuente. No se alteró la versión estable.'};}
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(status===429?{'Retry-After':'30'}:{})});res.end(JSON.stringify(body));
 };
}
