import {createDramasApi} from '../dramas-api.mjs';
import {createDocumentariesApi} from '../documentaries-api.mjs';
import {cinemeta,catalog,movieLookup} from '../catalog-api.mjs';
import {seriesApi,platformNames} from '../series-api.mjs';
import {animeApi} from '../anime-api.mjs';
import {createKidsApi} from '../kids-api.mjs';
import {createReleasesApi} from '../releases-api.mjs';
import {createTvApi} from '../tv-api.mjs';
export {platformNames};
const mobileHandler=handler=>(req,res,meta)=>handler({...req,mobile:true},res,meta);
const dramas=createDramasApi();
const documentaries=createDocumentariesApi();
const tv=createTvApi();
const kids=createKidsApi({series:mobileHandler(seriesApi),tv});
const releases=createReleasesApi({series:mobileHandler(seriesApi),kids});

// Los mismos adaptadores de la web, ejecutados en el teléfono. Sin Node ni servidor.
export async function api(path) {
  const url=new URL(path,'https://app.invalid');
  if(/^http:\/\/(?:localhost|127\.0\.0\.1):4173$/.test(globalThis.location?.origin||'')){
    const response=await fetch(url.pathname+url.search,{signal:AbortSignal.timeout(25000)});
    const data=await response.json();if(!response.ok)throw Error(data.error||`Error HTTP ${response.status}`);return data;
  }
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

