// Only public catalogue metadata. Never cache access codes, addon links or signed media URLs.
(()=>{
 const key='clb.catalog.metadata.v1',cache=new Map(),pending=new Map();let saveTimer;
 const allowed=path=>/^\/api\/(?:platform-catalog|catalog|(?:series|anime|documentaries|kids|tv)\/catalog|tv\/filters|releases)(?:\?|$)/.test(path);
 try{for(const [path,row]of JSON.parse(sessionStorage.getItem(key)||'[]'))if(allowed(path)&&row.expires>Date.now())cache.set(path,row);}catch{}
 const save=()=>{if(typeof setTimeout!=='function')return;clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{const rows=[...cache].filter(([,v])=>v.expires>Date.now());while(JSON.stringify(rows).length>1500000)rows.shift();sessionStorage.setItem(key,JSON.stringify(rows));}catch{}},200);};
 function awaitSignal(task,signal){if(!signal)return task;if(signal.aborted)return Promise.reject(new DOMException('Consulta cancelada','AbortError'));return new Promise((resolve,reject)=>{const stop=()=>{signal.removeEventListener('abort',stop);reject(new DOMException('Consulta cancelada','AbortError'));};signal.addEventListener('abort',stop,{once:true});task.then(v=>{signal.removeEventListener('abort',stop);resolve(v);},e=>{signal.removeEventListener('abort',stop);reject(e);});});}
 async function json(path,{signal}={}){
  if(!allowed(path))throw Error('Esta ruta no es un catálogo público.');if(signal?.aborted)throw new DOMException('Consulta cancelada','AbortError');
  const old=cache.get(path);if(old?.expires>Date.now())return structuredClone(old.value);
  if(!pending.has(path)){const task=(async()=>{const r=await fetch(path,{signal:AbortSignal.timeout(30000)}),data=await r.json();if(!r.ok)throw Error(data.error||'No se pudo consultar el catálogo.');if(cache.size>=25)cache.delete(cache.keys().next().value);cache.set(path,{value:data,expires:Date.now()+120000});save();return data;})().finally(()=>pending.delete(path));pending.set(path,task);}
  return structuredClone(await awaitSignal(pending.get(path),signal));
 }
 globalThis.CLBCatalog={json,async fetch(path,options={}){if((options.method&&options.method!=='GET')||!allowed(String(path)))return fetch(path,options);return new Response(JSON.stringify(await json(String(path),options)),{headers:{'Content-Type':'application/json'}});}};
})();
