import {fileAccessStore,redisAccessStore} from './access-store.mjs';
import {libraryRecord,libraryKey} from './mobile/library.mjs';
export function createProfileStores({env=process.env}={}){
 const stores=new Map(),deployed=env.VERCEL==='1',url=env.UPSTASH_REDIS_REST_URL||env.KV_REST_API_URL||env.clbweb_KV_REST_API_URL,token=env.UPSTASH_REDIS_REST_TOKEN||env.KV_REST_API_TOKEN||env.clbweb_KV_REST_API_TOKEN;
 return id=>{if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Cuenta inválida.');if(stores.has(id))return stores.get(id);const store=deployed?(url&&token?redisAccessStore({url,token,key:'clb:library:v1:'+id}):null):fileAccessStore(new URL('./work/library/'+id+'/state.json',import.meta.url));if(!store)throw Error('Almacenamiento no configurado.');if(stores.size>=200)stores.delete(stores.keys().next().value);stores.set(id,store);return store;};
}
function initialize(data){data.library||={revision:0,favorites:{},history:{},seen:{}};return data.library;}
function snapshot(state){const rows=group=>Object.values(state[group]).filter(r=>!r.deleted).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,group==='favorites'?300:100).map(({version,operationId,...r})=>r);return {favorites:rows('favorites'),history:rows('history')};}
export function createLibraryApi({access,stores=createProfileStores(),deployed=process.env.VERCEL==='1',now=Date.now}={}){
 return async(req,res)=>{let status=200,body;res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try{if(!['GET','POST'].includes(req.method)){res.writeHead(405);res.end();return;}const viewer=await access.authorize(req,res);if(!viewer)return;const profileId=viewer.accountId;if(!profileId)throw Error('Cuenta sin migrar.');const store=stores(profileId),url=new URL(req.url,'http://local');
  if(req.method==='GET'){const data=store.read?await store.read():await store.update(d=>d),state=initialize(data);body={profileId,revision:state.revision,serverTime:now(),...(Number(url.searchParams.get('since'))===state.revision&&url.searchParams.has('since')?{unchanged:true}:{snapshot:snapshot(state)})};}
  else{const expected=(deployed?'https://':'http://')+req.headers.host;if(req.headers.origin!==expected||!String(req.headers['content-type']).startsWith('application/json')){status=403;throw Error('Solicitud no permitida.');}let text='';for await(const part of req){text+=part;if(Buffer.byteLength(text)>256000){status=413;throw Error('Demasiados datos.');}}const input=JSON.parse(text);if(!Array.isArray(input.operations)||input.operations.length>50||!Number.isInteger(input.revision)||input.revision<0){status=400;throw Error('Cambios inválidos.');}
   const operations=input.operations.map(op=>{const value=libraryRecord(op?.record);if(!op||!['favorites','history'].includes(op.group)||!['set','remove'].includes(op.action)||!value||!/^[a-f0-9-]{36}$/i.test(op.id)||!Number.isFinite(op.at)){status=400;throw Error('Cambio inválido.');}const at=Math.min(now(),op.at);return {...op,record:value,at,expired:op.at<now()-7*86400000};});
   body=await store.update(data=>{const state=initialize(data),conflict=input.revision!==state.revision,ack=[];for(const op of operations){ack.push(op.id);if(state.seen[op.id])continue;const key=libraryKey(op.record.item),previous=state[op.group][key];state.seen[op.id]=now()||1;if(op.expired)continue;if(previous&&previous.updatedAt>op.at)continue;
     const count=Object.values(state[op.group]).filter(r=>!r.deleted).length;if(op.action==='set'&&(!previous||previous.deleted)&&count>=(op.group==='favorites'?300:100)){if(op.group==='favorites'){status=400;throw Error('Mi lista admite hasta 300 títulos.');}const oldest=Object.entries(state.history).filter(([,r])=>!r.deleted).sort((a,b)=>a[1].updatedAt-b[1].updatedAt)[0];if(oldest)delete state.history[oldest[0]];}
     state.revision++;state[op.group][key]={...op.record,updatedAt:op.at,deleted:op.action==='remove',version:state.revision,operationId:op.id};
    }
    state.seen=Object.fromEntries(Object.entries(state.seen).sort((a,b)=>b[1]-a[1]).slice(0,500));for(const group of ['favorites','history'])for(const [key,r]of Object.entries(state[group]))if(r.deleted&&r.updatedAt<now()-30*86400000)delete state[group][key];
    if(Buffer.byteLength(JSON.stringify(state))>2000000){status=413;throw Error('La biblioteca alcanzó su límite de almacenamiento.');}return {profileId,revision:state.revision,serverTime:now(),ack,expired:operations.filter(op=>op.expired).length,...(conflict?{snapshot:snapshot(state)}:{})};
   });
  }
 }catch(e){if(status===200)status=503;body={error:status===503?'No se pudo sincronizar tu biblioteca. Los cambios permanecen guardados en este dispositivo.':e.message};}
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));
 };
}
