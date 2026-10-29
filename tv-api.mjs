const base='https://iptv-org.github.io/api/';
export function publicHttps(value){
  try{
    const u=new URL(value),h=u.hostname.toLowerCase();
    if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||!h.includes('.')||h.includes(':'))return null;
    if(/^\d+\.\d+\.\d+\.\d+$/.test(h)) {const [a,b]=h.split('.').map(Number);if(a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a>=224||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19))return null;}
    return u.href;
  }catch{return null;}
}
export function buildCatalog(channels,streams,countries,categories){
  const grouped=new Map();
  for(const s of streams){
    const url=publicHttps(s.url);if(!s.channel||!url||!new URL(url).pathname.toLowerCase().endsWith('.m3u8')||s.referrer||s.user_agent)continue;
    const list=grouped.get(s.channel)||[];
    if(!list.some(v=>v.url===url))list.push({url,title:String(s.title||s.feed||'Señal').slice(0,160),quality:String(s.quality||'Auto').slice(0,30),labels:(s.labels||[]).filter(v=>typeof v==='string').map(v=>v.slice(0,60)).slice(0,5)});
    grouped.set(s.channel,list);
  }
  const rows=channels.filter(c=>!c.is_nsfw&&!c.closed&&grouped.has(c.id)&&typeof c.name==='string').map(c=>({id:c.id,name:c.name.slice(0,180),country:c.country,categories:(c.categories||[]).filter(v=>typeof v==='string'),website:publicHttps(c.website),streams:grouped.get(c.id)}));
  const counts=new Map();for(const c of rows)counts.set(c.country,(counts.get(c.country)||0)+1);
  return {channels:rows,countries:countries.filter(c=>counts.has(c.code)).map(c=>({code:c.code,name:c.name,flag:c.flag,count:counts.get(c.code)})),categories:categories.map(c=>({id:c.id,name:c.name})),updatedAt:new Date().toISOString()};
}
export function createTvApi(fetcher=(...args)=>globalThis.fetch(...args)){
  let cached,pending;
  async function json(file){
    const r=await fetcher(base+file+'.json',{signal:AbortSignal.timeout(25000),redirect:'error'});
    if(!r.ok)throw Error('La fuente de TV no respondió.');
    if(Number(r.headers.get('content-length'))>12_000_000)throw Error('Catálogo demasiado grande.');
    let body='',size=0;const decoder=new TextDecoder();
    for await(const bytes of r.body){size+=bytes.length;if(size>12_000_000){await r.body.cancel().catch(()=>{});throw Error('Catálogo demasiado grande.');}body+=decoder.decode(bytes,{stream:true});}
    body+=decoder.decode();const data=JSON.parse(body);if(!Array.isArray(data))throw Error('Formato de TV no reconocido.');return data;
  }
  async function dataset(){
    if(cached&&cached.expires>Date.now())return {...cached.data,stale:false};
    if(!pending)pending=Promise.all(['channels','streams','countries','categories'].map(json)).then(data=>{const value=buildCatalog(...data);cached={data:value,expires:Date.now()+3600000};return {...value,stale:false};}).catch(error=>{if(cached)return {...cached.data,stale:true};throw error;}).finally(()=>{pending=null;});
    return pending;
  }
  return async function tvApi(req,res){
    const u=new URL(req.url,'http://app.invalid');
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
    const q=(u.searchParams.get('q')||'').trim(),country=u.searchParams.get('country')||'all',category=u.searchParams.get('category')||'all',skip=Number(u.searchParams.get('skip')||0);
    if(q.length>120||/[\u0000-\u001f]/.test(q)||!(/^[A-Z]{2}$/.test(country)||country==='all')||!(/^[a-z]{1,30}$/.test(category)||category==='all')||!Number.isInteger(skip)||skip<0||skip>50000){send(400,{error:'Filtros de TV inválidos.'});return;}
    try{
      const d=await dataset();
      if(u.pathname==='/api/tv/filters'){send(200,{countries:d.countries,categories:d.categories,total:d.channels.length,updatedAt:d.updatedAt,stale:d.stale});return;}
      if(u.pathname==='/api/tv/channel'){
        const channel=d.channels.find(c=>c.id===u.searchParams.get('id'));send(channel?200:404,channel||{error:'Canal no encontrado.'});return;
      }
      if(u.pathname!=='/api/tv/catalog'){send(404,{error:'Ruta no encontrada.'});return;}
      const normalize=v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      const rows=d.channels.filter(c=>(country==='all'||c.country===country)&&(category==='all'||c.categories.includes(category))&&normalize(c.name).includes(normalize(q))).sort((a,b)=>a.name.localeCompare(b.name));
      const selected=rows.slice(skip,skip+60).map(({streams,...c})=>({...c,sourceCount:streams.length,qualities:[...new Set(streams.map(s=>s.quality))]}));
      send(200,{channels:selected,total:rows.length,nextSkip:skip+selected.length,hasMore:skip+selected.length<rows.length,updatedAt:d.updatedAt,stale:d.stale});
    }catch(error){send(502,{error:error.name==='TimeoutError'?'El catálogo de TV tardó demasiado. Reintenta.':error.message});}
  };
}
export const tvApi=createTvApi();
