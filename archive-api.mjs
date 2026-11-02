const ADDON='https://archive-addon.onrender.com';
export function archiveFile(value){
 const u=new URL(value);
 if(u.origin!=='https://archive.org'||u.username||u.password||u.search||u.hash)throw Error('Enlace Archive inválido.');
 const parts=u.pathname.split('/').slice(1).map(decodeURIComponent);
 if(parts[0]!=='download'||parts.length<3||!parts[1]||parts.some(p=>!p||p==='.'||p==='..'||/[\\/\x00-\x1f]/.test(p)))throw Error('Ruta Archive inválida.');
 if(!/\.(mp4|webm)$/i.test(parts.at(-1)))throw Error('Formato fuera de esta prueba.');
 return {url:u.href,identifier:parts[1],filename:parts.slice(2).join('/')};
}
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function matchingArchive(metadata,meta,identity,file){
 if(metadata.is_dark||metadata.is_restricted||metadata.access_restricted)return false;
 const title=normalize(metadata.title),name=normalize(meta.name);
 if(!name||!/^(movie|series)$/.test(identity.kind)||/\b(trailer|teaser|review|interview|soundtrack|podcast|behind the scenes)\b/.test(normalize(file.filename)))return false;
 const explicitId=new RegExp('\\b'+identity.id+'\\b').test(JSON.stringify([metadata['external-identifier'],metadata.imdb_id,metadata.imdb,metadata.identifier,file.filename]));
 const sameTitle=title===name||title.startsWith(name+' ');
 const year=Number(String(meta.year||meta.releaseInfo||meta.released||'').slice(0,4));
 const itemYear=Number(String(metadata.year||metadata.date||'').slice(0,4));
 if(identity.kind==='movie')return explicitId||sameTitle&&year>1800&&year===itemYear;
 const match=file.filename.match(/(?:^|[^a-z0-9])s(\d{1,3})[ ._-]*e(\d{1,4})(?!\d)/i);
 return explicitId&&!!match&&Number(match[1])===identity.season&&Number(match[2])===identity.episode;
}
export function createArchiveApi({fetcher=fetch,metadataLookup,now=Date.now}={}){
 const cache=new Map();let active=0;
 async function json(url,signal){const r=await fetcher(url,{signal,redirect:'error',headers:{Accept:'application/json'}});if(!r.ok)throw Error('HTTP '+r.status);let size=0;const chunks=[];for await(const chunk of r.body){size+=chunk.length;if(size>2_000_000)throw Error('Respuesta excesiva');chunks.push(Buffer.from(chunk));}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
 return async(req,res)=>{
  let status=200,body;
  try{
   const u=new URL(req.url,'http://local'),p=u.searchParams,kind=p.get('kind'),id=p.get('id'),season=Number(p.get('season')),episode=Number(p.get('episode'));
   if(!['movie','series'].includes(kind)||!/^tt\d{5,12}$/.test(id||'')||kind==='series'&&(!p.has('season')||!p.has('episode')||!Number.isInteger(season)||season<0||season>1000||!Number.isInteger(episode)||episode<1||episode>10000))throw Object.assign(Error('Se necesita IMDb y el episodio exacto para consultar Archive.'),{status:400});
   const key=[kind,id,season,episode].join(':');const old=cache.get(key);if(old&&old.until>now()){res.writeHead(old.status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(old.body));return;}
   if(active>=2)throw Object.assign(Error('Hay consultas de Archive en curso. Espera un momento.'),{status:429});
   active++;
   try{
    const signal=AbortSignal.timeout(35000),identity={kind,id,season,episode};
    const [data,details]=await Promise.all([json(ADDON+'/stream/'+kind+'/'+id+(kind==='series'?':'+season+':'+episode:'')+'.json',signal),metadataLookup(`meta/${kind}/${id}.json`)]);
    if(!Array.isArray(data.streams)||!details?.meta?.name)throw Error('Contrato de fuente inválido');
    if(details.meta.imdb_id&&details.meta.imdb_id!==id||/^tt/.test(details.meta.id||'')&&details.meta.id!==id)throw Error('Identidad no coincidente');
    const candidates=data.streams.slice(0,16).flatMap(row=>{try{return [archiveFile(row.url)];}catch{return [];}});
    const identifiers=[...new Set(candidates.map(f=>f.identifier))].slice(0,4),metas=new Map();let checked=0;
    await Promise.all(identifiers.map(async identifier=>{try{const d=await json('https://archive.org/metadata/'+encodeURIComponent(identifier),signal);if(!d.metadata||!Array.isArray(d.files))return;metas.set(identifier,d);checked++;}catch{}}));
    if(identifiers.length&&!checked)throw Error('No se pudo contrastar Archive');
    const sources=[],seen=new Set();
    for(const file of candidates){const data=metas.get(file.identifier),f=data?.files.find(f=>f.name===file.filename);if(!f||!matchingArchive(data.metadata,details.meta,identity,file)||seen.has(file.url))continue;
     const height=Number(f.height);if(height>1080||/\b(?:2160p|4k|8k)\b/i.test(file.filename))continue;seen.add(file.url);
     sources.push({url:file.url,title:String(data.metadata.title||'Archivo').slice(0,180),filename:file.filename.slice(0,240),format:file.filename.split('.').at(-1).toUpperCase(),quality:height>0?height+'p declarados':'Resolución sin confirmar',language:String(data.metadata.language||'Idioma sin declarar').slice(0,100),bytes:Number(f.size)||null,page:'https://archive.org/details/'+encodeURIComponent(file.identifier)});
    }
    body={sources,note:'Opciones experimentales contrastadas con metadatos de Archive. La coincidencia no certifica reproducción completa ni audio latino. Solo MP4/WebM hasta 1080p cuando la resolución está declarada.'};
    if(cache.size>=40)cache.delete(cache.keys().next().value);cache.set(key,{until:now()+120000,status:200,body});
   }catch{if(cache.size>=40)cache.delete(cache.keys().next().value);status=503;body={error:'Internet Archive o su complemento no pudieron responder o contrastar los archivos. Esto no significa que el título no exista.'};cache.set(key,{until:now()+30000,status,body});}finally{active--;}
  }catch(e){status=e.status||503;body={error:e.status?e.message:'No se pudo consultar Archive.'};}
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));
 };
}
