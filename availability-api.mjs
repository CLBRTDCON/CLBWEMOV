// Cache evidence from server-side source queries, never temporary media links.
export function createAvailabilityApi({inspect,animeDetail,deployed=false,now=Date.now,store,namespace=async()=> 'local-v2',onError=()=>{},background=task=>{void task;}}={}){
 const cache=new Map(),pending=new Map(),queue=[],contexts=new Map(),retryAfter=new Map();let running=0,timer;
 const freshMs={available:4*3600000,empty:15*60000,unknown:30000},staleMs=24*3600000;
 function pump(){while(running<2&&queue.length){const task=queue.shift();running++;task().finally(()=>{running--;pump();});}}
 function identity(item){const id=item.imdbId||item.id;return /^tt\d{5,12}$/.test(id||'')?{kind:item.kind==='movie'?'movie':'series',id,...(item.kind==='movie'?{}:{season:1,episode:1})}:null;}
 const canonical=item=>({kind:item.kind,id:item.imdbId||item.id});
 const answer=(record,cached=false,stale=false)=>({state:record.state,checkedAt:record.checkedAt,cached,stale});
 async function refresh(key,item,old){
  if(pending.has(key))return pending.get(key);if(queue.length>=100)return {state:'unknown'};
  const task=new Promise(resolve=>{queue.push(async()=>{
   let value={state:'unknown'};
   try{let context=identity(item);if(item.kind==='anime'){const info=await animeDetail(item.id);const ep=info.episodes?.find(e=>!e.locked&&!e.upcoming&&e.season>0)||info.episodes?.find(e=>!e.locked&&!e.upcoming);const id=ep?.imdbId||info.imdbId;context=/^tt\d{5,12}$/.test(id||'')?{id,kind:info.playbackType==='movie'?'movie':'series',...(info.playbackType==='movie'?{}:{season:ep?.sourceSeason??ep?.season??1,episode:ep?.sourceEpisode??ep?.episode??1})}:null;}if(context)value=await inspect(context);}catch{}
   if(!['available','empty'].includes(value.state))value={state:'unknown'};
   const at=now();if(retryAfter.size>=5000)retryAfter.delete(retryAfter.keys().next().value);retryAfter.set(key,at+30000);
   if(value.state==='unknown'&&old?.state==='available'&&old.staleUntil>at){resolve(answer(old,true,true));}
   else{const record={...canonical(item),state:value.state,checkedAt:at,expires:at+freshMs[value.state],staleUntil:at+(value.state==='available'?staleMs:freshMs[value.state]),evidence:'source-options',...(typeof value.provider==='string'&&/^[a-z]{2,20}$/.test(value.provider)?{provider:value.provider}:{})};
    if(cache.size>=5000)cache.delete(cache.keys().next().value);cache.set(key,record);
    if(store&&value.state!=='unknown')try{await store.set(key,record);}catch(e){onError(e);}
    resolve(answer(record));
   }pending.delete(key);
  });});pending.set(key,task);pump();return task;
 }
 async function check(item){const clean=canonical(item),key=await namespace()+':'+JSON.stringify(clean);contexts.set(key,clean);if(contexts.size>5000)contexts.delete(contexts.keys().next().value);
  let old=cache.get(key);if(!old&&store)try{old=await store.get(key);if(old)cache.set(key,old);}catch(e){onError(e);}
  if(old?.expires>now())return answer(old,true);
  if(old?.state==='available'&&old.staleUntil>now()){if(!(retryAfter.get(key)>now()))background(refresh(key,clean,old));return answer(old,true,true);}
  return refresh(key,clean,old);
 }
 const api=async function(req,res){let status=200,body;try{if(req.method!=='POST'||req.headers.origin!==(deployed?'https://':'http://')+req.headers.host||!String(req.headers['content-type']).startsWith('application/json')){status=403;throw Error();}let text='';for await(const chunk of req){text+=chunk;if(text.length>8000)throw Error();}const {items}=JSON.parse(text);if(!Array.isArray(items)||items.length>8||items.some(i=>!i||!['movie','series','anime'].includes(i.kind)||typeof i.id!=='string'||! /^(?:tt\d{5,12}|[1-9]\d{0,11}|(?:mal|anilist|kitsu):\d{1,12})$/.test(i.id)||i.imdbId&&!/^tt\d{5,12}$/.test(i.imdbId)))throw Error();
  if(new URL(req.url||'/','http://localhost').searchParams.get('stream')==='1'){res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});await Promise.all(items.map(async(item,index)=>{const result=await check(item);if(!res.destroyed)res.write(JSON.stringify({index,...result})+'\n');}));res.end();return;}
  body={results:await Promise.all(items.map(check))};
 }catch{if(status===200)status=400;body={error:'No se pudo comprobar la disponibilidad.'};}res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
 // Renew only known entries, with bounded work. A timer never crawls the whole catalogue.
 api.renew=async(limit=20)=>{const prefix=await namespace()+':';const records=store?await store.entries():[...cache];const due=records.filter(([key,r])=>key.startsWith(prefix)&&r.expires<=now()&&r.staleUntil>now()&&!(retryAfter.get(key)>now())).sort((a,b)=>b[1].checkedAt-a[1].checkedAt).slice(0,limit);await Promise.all(due.map(([key,r])=>refresh(key,contexts.get(key)||{kind:r.kind,id:r.id},r)));};
 api.start=()=>{if(!timer){timer=setInterval(()=>{void api.renew().catch(onError);},5*60000);timer.unref();}};api.close=()=>{clearInterval(timer);timer=null;};return api;
}
