import {catalogEligible} from './catalog-api.mjs';
import {cinemeta} from './catalog-api.mjs';
const types=['all','movie','series','tvmaze','archive'];
const idPattern=/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/;
const imdb=/^tt\d{7,12}$/;
const text=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const list=v=>Array.isArray(v)?v:[v];
export function openLicense(value){return list(value).some(v=>/^https?:\/\/creativecommons\.org\/publicdomain\/(zero|mark)\/1\.0\/?$/.test(v||''));}
const documentary=m=>list(m.subject).some(s=>/\bdocumentar(?:y|ies|io|ios)\b/i.test(String(s)));
function poster(value){try{const u=new URL(value);return u.protocol==='https:'&&['image.tmdb.org','images.metahub.space','m.media-amazon.com','static.tvmaze.com','archive.org'].includes(u.hostname)?u.href:'';}catch{return '';}}
export function createDocumentariesApi({metadata=cinemeta,fetcher=(...args)=>globalThis.fetch(...args)}={}){
 const cache=new Map();
 async function json(url){
  const cached=cache.get(url);if(cached&&cached.expires>Date.now())return cached.value;
  const r=await fetcher(url,{signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error('La fuente documental no respondió.');const body=await r.text();if(body.length>4_000_000)throw Error('Respuesta documental demasiado grande.');
  const value=JSON.parse(body);if(cache.size>=40)cache.delete(cache.keys().next().value);cache.set(url,{value,expires:Date.now()+300000});return value;
 }
 async function cinematic(kind,p,q,year,sort){
  const extras=new URLSearchParams({skip:String(p*50)});let category=sort==='rating'?'imdbRating':'top';
  if(q)extras.set('search',q);else extras.set('genre','Documentary');
  const d=await metadata(`catalog/${kind}/${category}/${extras}.json`);if(!Array.isArray(d.metas))throw Error('Catálogo documental inválido.');
  return {items:d.metas.filter(m=>imdb.test(m.id||'')&&m.genres?.includes('Documentary')).map(m=>({id:m.id,imdbId:m.id,kind,name:text(m.name).slice(0,200),year:Number(String(m.releaseInfo||m.year||'').slice(0,4))||null,released:Number.isFinite(Date.parse(m.released))?new Date(m.released).toISOString():null,genres:m.genres,posterUrl:poster(m.poster),catalog:'Cinemeta · Documentales'})),hasMore:d.metas.length>0};
 }
 async function maze(p,q){
  const d=await json(q?'https://api.tvmaze.com/search/shows?q='+encodeURIComponent(q):'https://api.tvmaze.com/shows?page='+p);
  const shows=q?d.map(v=>v.show):d;if(!Array.isArray(shows))throw Error('Formato TVmaze inválido.');
  return {items:shows.filter(m=>(m.type==='Documentary'||m.genres?.includes('Documentary'))&&imdb.test(m.externals?.imdb||'')).map(m=>({id:m.externals.imdb,imdbId:m.externals.imdb,tvmazeId:m.id,kind:'series',name:text(m.name),year:Number(m.premiered?.slice(0,4))||null,released:m.premiered||null,genres:['Documentary',...(m.genres||[])].filter((v,i,a)=>a.indexOf(v)===i),posterUrl:poster(m.image?.medium),catalog:'TVmaze · Docuseries'})),hasMore:!q&&shows.length>0};
 }
 async function archive(p,q,year,sort){
  const clauses=['mediatype:movies','(subject:documentary OR subject:documentaries)','(licenseurl:"https://creativecommons.org/publicdomain/zero/1.0/" OR licenseurl:"http://creativecommons.org/publicdomain/zero/1.0/" OR licenseurl:"https://creativecommons.org/publicdomain/mark/1.0/" OR licenseurl:"http://creativecommons.org/publicdomain/mark/1.0/")'];
  if(q)clauses.push('title:"'+q.replace(/["\\]/g,' ')+'"');if(year!=='all')clauses.push('year:'+year);
  const params=new URLSearchParams({q:clauses.join(' AND '),rows:'24',page:String(p+1),output:'json'});for(const f of ['identifier','title','year','date','subject','licenseurl','language'])params.append('fl[]',f);params.append('sort[]',sort==='recent'?'date desc':'downloads desc');
  const d=await json('https://archive.org/advancedsearch.php?'+params);if(!Array.isArray(d.response?.docs))throw Error('Formato Archive inválido.');
  return {items:d.response.docs.filter(m=>idPattern.test(m.identifier)&&openLicense(m.licenseurl)&&documentary(m)).map(m=>({id:'archive:'+m.identifier,kind:'archive',name:text(m.title).slice(0,200),year:Number(m.year)||null,released:m.date||null,genres:['Documentary'],posterUrl:'https://archive.org/services/img/'+encodeURIComponent(m.identifier),catalog:'Internet Archive · Archivo abierto',language:list(m.language).filter(Boolean).join(', ')})),hasMore:(p+1)*24<d.response.numFound};
 }
 return async(req,res)=>{
  const u=new URL(req.url,'https://app.invalid'),send=(s,d)=>{res.writeHead(s,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(d));};
  const source=u.searchParams.get('source')||'all',p=Number(u.searchParams.get('skip')||0),q=(u.searchParams.get('q')||'').trim(),year=u.searchParams.get('year')||'all',sort=u.searchParams.get('sort')||'popular';
  if(u.pathname==='/api/documentaries/detail'){
   const id=(u.searchParams.get('id')||'').replace(/^archive:/,'');if(!idPattern.test(id)){send(400,{error:'Identificador documental inválido.'});return;}
   try{const d=await json('https://archive.org/metadata/'+encodeURIComponent(id)),m=d.metadata;
    if(!m||m.identifier!==id||m.mediatype!=='movies'||!documentary(m)||!openLicense(m.licenseurl)||d.is_dark||m.nodownload==='true'||m.nodownload===true){send(422,{error:'Este archivo no ofrece un documental abierto compatible.'});return;}
    const streams=(d.files||[]).filter(f=>typeof f.name==='string'&&/\.mp4$/i.test(f.name)&&!f.private&&!f.name.split('/').includes('..')).slice(0,12).map(f=>({url:`https://archive.org/download/${encodeURIComponent(id)}/${f.name.split('/').map(encodeURIComponent).join('/')}`,title:text(f.name).slice(0,100),height:Number(f.height)||null}));
    if(!streams.length){send(404,{error:'No hay archivo MP4 compatible para este documental.'});return;}
    send(200,{id:'archive:'+id,kind:'archive',playbackType:'file',name:text(m.title),description:text(m.description).slice(0,4000),language:list(m.language).filter(Boolean).join(', ')||'No informado',license:list(m.licenseurl).find(v=>openLicense(v)),streams,episodes:[]});
   }catch(e){send(502,{error:e.message});}return;
  }
  if(u.pathname!=='/api/documentaries/catalog'){send(404,{error:'Ruta no encontrada.'});return;}
  if(!types.includes(source)||!Number.isInteger(p)||p<0||p>500||q.length>120||/[\u0000-\u001f]/.test(q)||!['popular','rating','recent'].includes(sort)||(year!=='all'&&(!/^\d{4}$/.test(year)||Number(year)<1900||Number(year)>new Date().getFullYear()))){send(400,{error:'Filtros documentales inválidos.'});return;}
  const tasks=[];if(['all','movie'].includes(source))tasks.push(cinematic('movie',p,q,year,sort));if(['all','series'].includes(source))tasks.push(cinematic('series',p,q,year,sort));if(['all','tvmaze'].includes(source))tasks.push(maze(p,q));if(['all','archive'].includes(source))tasks.push(archive(p,q,year,sort));
  const results=await Promise.allSettled(tasks);if(results.every(r=>r.status==='rejected')){send(502,{error:'No se pudo consultar ninguna fuente documental. Reintenta.'});return;}
  const items=[...new Map(results.flatMap(r=>r.status==='fulfilled'?r.value.items:[]).filter(m=>year==='all'||m.year===Number(year)).filter(m=>catalogEligible(m)).map(m=>[m.kind+':'+m.id,m])).values()];
  if(sort==='recent')items.sort((a,b)=>(Date.parse(b.released)||0)-(Date.parse(a.released)||0));
  send(200,{items,nextSkip:p+1,hasMore:results.some(r=>r.status==='fulfilled'&&r.value.hasMore),warnings:results.filter(r=>r.status==='rejected').map(r=>r.reason.message),source:'Cinemeta · TVmaze · Internet Archive'});
 };
}
