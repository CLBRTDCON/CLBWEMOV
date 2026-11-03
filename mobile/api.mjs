import {seriesApi,platformNames} from '../series-api.mjs';
export {platformNames};
let localAdapters;
function adapters(){return localAdapters??=(async()=>{
 const [{createDramasApi},{createDocumentariesApi},{cinemeta,catalog,movieLookup},{animeApi},{createKidsApi},{createReleasesApi},{createTvApi}]=await Promise.all([import('../dramas-api.mjs'),import('../documentaries-api.mjs'),import('../catalog-api.mjs'),import('../anime-api.mjs'),import('../kids-api.mjs'),import('../releases-api.mjs'),import('../tv-api.mjs')]);
 const mobileHandler=handler=>(req,res,meta)=>handler({...req,mobile:true},res,meta),dramas=createDramasApi(),documentaries=createDocumentariesApi(),tv=createTvApi(),kids=createKidsApi({series:mobileHandler(seriesApi),tv}),releases=createReleasesApi({series:mobileHandler(seriesApi),kids});
 return {cinemeta,catalog,movieLookup,animeApi,dramas,documentaries,tv,kids,releases};
})();}

// Web HTTP(S): usa su API del mismo origen. APK empaquetada: conserva los adaptadores locales.
export async function api(path) {
  const url=new URL(path,'https://app.invalid');
  if(/^https?:\/\//.test(globalThis.location?.origin||'')&&globalThis.location.origin!=='https://appassets.androidplatform.net'){
    if(globalThis.CLBCatalog&&/\/catalog(?:\?|$)|\/releases(?:\?|$)|\/filters(?:\?|$)/.test(url.pathname+url.search))return CLBCatalog.json(url.pathname+url.search);
    const response=await fetch(url.pathname+url.search,{signal:AbortSignal.timeout(25000)});
    const data=await response.json();if(!response.ok)throw Error(data.error||`Error HTTP ${response.status}`);return data;
  }
  const {cinemeta,catalog,movieLookup,animeApi,dramas,documentaries,tv,kids,releases}=await adapters();
  const handlers={'/api/catalog':catalog,'/api/movie':movieLookup,'/api/releases':releases};
  const handler=url.pathname.startsWith('/api/dramas/')?dramas:url.pathname.startsWith('/api/documentaries/')?documentaries:url.pathname.startsWith('/api/kids/')?kids:url.pathname.startsWith('/api/tv/')?tv:url.pathname.startsWith('/api/series/')?seriesApi:url.pathname.startsWith('/api/anime/')?animeApi:handlers[url.pathname];
  if(!handler)throw new Error('Consulta no disponible.');
  let status=200,body='';
  const res={setHeader(){},writeHead(value){status=value;},end(value){body=value;}};
  await handler({url:url.pathname+url.search,method:'GET',mobile:true},res,cinemeta);
  const data=JSON.parse(body);
  if(status>=400)throw new Error(data.error||'No se pudo consultar el catálogo.');
  return data;
}

export function installAndroidTransport(nativeFetch=globalThis.fetch.bind(globalThis)) {
  if(globalThis.location?.origin!=='https://appassets.androidplatform.net')throw new Error('Origen Android no válido.');
  globalThis.fetch=(input,options={})=> {
    const target=new URL(input,globalThis.location.origin);
    if(target.origin===globalThis.location.origin)return nativeFetch(target.href,options);
    if(target.protocol!=='https:')return Promise.reject(new Error('Solo se permiten consultas HTTPS.'));
    const url=new URL('/network',globalThis.location.origin);
    url.searchParams.set('target',target.href);
    url.searchParams.set('method',options.method||'GET');
    if(options.body)url.searchParams.set('body',options.body);
    return nativeFetch(url.href,{signal:options.signal,credentials:'omit',cache:'no-store'});
  };
}

