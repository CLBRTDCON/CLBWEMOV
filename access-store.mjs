import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const empty=()=>({codes:{},sessions:{},attempts:{}});
export function fileAccessStore(file=new URL('./work/access/state.json',import.meta.url)){
 let queue=Promise.resolve();
 return {update(fn){const task=queue.then(async()=>{let data;try{data=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;data=empty();}const result=fn(data);await mkdir(new URL('.',file),{recursive:true});const temp=new URL('./'+randomUUID()+'.tmp',file);await writeFile(temp,JSON.stringify(data),{mode:0o600});await rename(temp,file);return result;});queue=task.catch(()=>{});return task;}};
}
// Optimistic CAS keeps redemption atomic across serverless instances. No local fallback in production.
export function redisAccessStore({url,token,fetcher=fetch,key='clb:access:v1'}={}){
 const endpoint=new URL(url);if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password)throw Error('Redis HTTPS requerido.');
 async function command(args){const r=await fetcher(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Almacenamiento no disponible.');const d=await r.json();if(d.error)throw Error('Almacenamiento no disponible.');return d.result;}
 return {async update(fn){for(let i=0;i<8;i++){const previous=await command(['GET',key]);const data=previous?JSON.parse(previous):empty();const result=fn(data);data.revision=randomUUID();const next=JSON.stringify(data);const ok=await command(['EVAL',"local old=redis.call('GET',KEYS[1]); if (old or '')~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1",'1',key,previous||'',next]);if(Number(ok)===1)return result;}throw Error('Almacenamiento ocupado. Reintenta.');}};
}
