import {createHash} from 'node:crypto';
import {gzip} from 'node:zlib';
import {promisify} from 'node:util';
const compress=promisify(gzip),cache=new Map();
function acceptsGzip(value=''){
 let explicit,wildcard;
 for(const part of value.split(',')){const [name,...parameters]=part.trim().toLowerCase().split(';');const q=parameters.find(p=>p.trim().startsWith('q='));const n=q?Number(q.trim().slice(2)):1;const enabled=Number.isFinite(n)&&n>0&&n<=1;if(name==='gzip')explicit=enabled;if(name==='*')wildcard=enabled;}
 return explicit??wildcard??false;
}
export async function writeStatic(req,res,content,headers,file){
 const textual=/\.(?:html|css|js|mjs)$/.test(file),cacheable=/\.(?:css|js|mjs)$/.test(file);
 const digest=createHash('sha256').update(content).digest('hex');
 let body=content,encoding='identity';
 if(textual&&content.length>=1024&&acceptsGzip(req.headers['accept-encoding'])){
  encoding='gzip';let task=cache.get(digest);if(!task){if(cache.size>=40)cache.delete(cache.keys().next().value);task=compress(content).catch(error=>{cache.delete(digest);throw error;});cache.set(digest,task);}body=await task;
 }
 const out={...headers,'Content-Length':body.length};
 if(textual)out.Vary='Accept-Encoding';
 if(encoding==='gzip')out['Content-Encoding']='gzip';
 if(cacheable){
  // Revalidar archivos propios evita ejecutar código anterior tras actualizar.
  out['Cache-Control']=file==='vendor/hls-1.7.3.min.js'?'public, max-age=86400':'no-cache';
  const tag='"'+digest+'-'+encoding+'"';out.ETag=tag;
  if(String(req.headers['if-none-match']||'').split(',').some(value=>value.trim().replace(/^W\//,'')===tag||value.trim()==='*')){
   delete out['Content-Length'];res.writeHead(304,out);res.end();return;
  }
 }
 res.writeHead(200,out);res.end(req.method==='HEAD'?undefined:body);
}
