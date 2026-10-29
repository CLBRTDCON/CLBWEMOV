export const searchSections=[{key:'movie',label:'Películas'},{key:'series',label:'Series'},{key:'anime',label:'Anime'},{key:'documentary',label:'Documentales'},{key:'kids',label:'Kids'},{key:'tv',label:'TV en vivo'},{key:'drama',label:'Dramas · Pruebas'}];
export function createGlobalSearch({api,sections=searchSections}){
 function path(key,q,skip=0,source='anilist'){
  const params=new URLSearchParams({q,skip:String(skip),year:'all'});
  if(key==='movie'){params.set('kind','search');return '/api/catalog?'+params;}
  if(key==='series'){params.set('platform','internet');return '/api/series/catalog?'+params;}
  if(key==='anime'){params.set('source',source);return '/api/anime/catalog?'+params;}
  if(key==='documentary'){params.set('source','all');return '/api/documentaries/catalog?'+params;}
  if(key==='drama'){params.set('source','all');return '/api/dramas/catalog?'+params;}
  if(key==='kids'){params.set('kind','all');return '/api/kids/catalog?'+params;}
  params.set('country','all');return '/api/tv/catalog?'+params;
 }
 async function page(key,q,previous){
  let source=previous?.source||'anilist',data;
  try{data=await api(path(key,q,previous?.nextSkip||0,source));}catch(e){if(key!=='anime'||previous)throw e;source='kitsu';data=await api(path(key,q,0,source));}
  const incoming=data.movies||data.series||data.items||data.channels||data.sections?.flatMap(s=>s.items)||[];
  const rows=incoming.filter(i=>(!Number(i.year)||Number(i.year)<=new Date().getFullYear())&&(!Number.isFinite(Date.parse(i.released))||Date.parse(i.released)<=Date.now())).map(i=>({...i,kind:i.kind||(key==='documentary'?'movie':key),section:key}));
  const items=[...new Map([...(previous?.items||[]),...rows].map(i=>[i.kind+':'+i.id,i])).values()];
  return {key,q,source,items,nextSkip:data.nextSkip||0,hasMore:key!=='kids'&&!!data.hasMore&&(data.nextSkip||0)>(previous?.nextSkip||0),status:'ready',warnings:data.warnings||[]};
 }
 return {async search(q,onSection=()=>{}){
  q=q.trim();if(!q||q.length>120||/[\u0000-\u001f]/.test(q))throw Error('Escribe un título para buscar.');
  return Promise.all(sections.map(async({key})=>{onSection({key,q,items:[],status:'loading'});let result;try{result=await page(key,q);}catch(e){result={key,q,items:[],status:'error',error:e.message};}onSection(result);return result;}));
 },more:state=>page(state.key,state.q,state),retry:state=>page(state.key,state.q)};
}
