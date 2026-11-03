import {createPlatformCatalogApi} from './platform-catalog-api.mjs';
const platformCatalogApi=createPlatformCatalogApi();
import {createAccessApi} from './access-api.mjs';
import {createAddonsLocalApi} from './addons-local-api.mjs';
import {createAvailabilityApi} from './availability-api.mjs';
import {invoke as invokeAvailability} from './kids-api.mjs';
const deviceAccess=createAccessApi();
const addonsLocalApi=createAddonsLocalApi({access:deviceAccess,deployed:true,load:async()=>({latinobrid:process.env.CLB_LATINOBRID_MANIFEST})});
const availabilityApi=createAvailabilityApi({deployed:true,inspect:identity=>addonsLocalApi.inspect(identity),animeDetail:id=>invokeAvailability(animeApi,'/api/anime/detail?'+new URLSearchParams({id}),cinemeta)});
import {withWebHeader} from './web-header.mjs';
import {createArchiveApi} from './archive-api.mjs';
const archiveApi=createArchiveApi({metadataLookup:path=>cinemeta(path)});
import {createCatalognetApi} from './catalognet-api.mjs';
import {createFichaApi} from './ficha-api.mjs';
const catalognetApi=createCatalognetApi(),fichaApi=createFichaApi();
import {writeStatic} from './static-response.mjs';
import {serveAccess} from './web-access.mjs';
import {networkInterfaces} from 'node:os';
import {lanConfiguration} from './lan-config.mjs';
const {lanHost,allowedHosts}=lanConfiguration(process.env.CLB_LAN_ADDRESS,networkInterfaces());

import { readFile } from 'node:fs/promises';
import { seriesApi } from './series-api.mjs';
import { animeApi } from './anime-api.mjs';
import {cinemeta,movieLookup,catalog} from './catalog-api.mjs';
import {tvApi} from './tv-api.mjs';
import {kidsApi} from './kids-api.mjs';
import {adultApi} from './adult-api.mjs';
import {releasesApi} from './releases-api.mjs';

import {createDocumentariesApi} from './documentaries-api.mjs';
const documentariesApi=createDocumentariesApi();
const files = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']], ['/style.css', ['style.css', 'text/css']], ['/catalog.css', ['catalog.css', 'text/css']], ['/series', ['series.html','text/html']], ['/anime', ['series.html','text/html']], ['/series.js',['series.js','text/javascript']], ['/playback.js',['playback.js','text/javascript']], ['/source-config.js',['source-config.js','text/javascript']], ['/popup-guard.zip',['popup-guard.zip','application/zip']], ['/series.css',['series.css','text/css']]]);
for(const [path,file,type] of [['/tv','tv.html','text/html'],['/tv.js','tv.js','text/javascript'],['/tv.css','tv.css','text/css'],['/vendor/hls-1.7.3.min.js','vendor/hls-1.7.3.min.js','text/javascript']])files.set(path,[file,type]);
for(const [path,file,type] of [['/kids','kids.html','text/html'],['/kids.js','kids.js','text/javascript'],['/kids.css','kids.css','text/css'],['/player-policy.mjs','../mobile/player-policy.mjs','text/javascript']])files.set(path,[file,type]);
for(const [route,file,type] of [['/adult','adult.html','text/html'],['/adult.js','adult.js','text/javascript'],['/adult.css','adult.css','text/css'],['/index.html',['index.html','text/html'][0],'text/html']])files.set(route,[file,type]);
files.set('/archive-options.mjs',['archive-options.mjs','text/javascript']);
files.set('/genre-shelves.js',['genre-shelves.js','text/javascript']);
for(const [route,file,type] of [['/biblioteca','biblioteca.html','text/html'],['/web-library.js','web-library.js','text/javascript'],['/web-library-core.mjs','web-library-core.mjs','text/javascript'],['/web-library.css','web-library.css','text/css']])files.set(route,[file,type]);
files.set('/documentales',['documentaries.html','text/html']);
for(const name of ['documentaries.js','documentaries.css'])files.set('/'+name,[name,name.endsWith('.css')?'text/css':'text/javascript']);
files.set('/web-preview-responsive.css',['web-preview-responsive.css','text/css']);
files.set('/extension-notice.css',['extension-notice.css','text/css']);
files.set('/responsive.css',['responsive.css','text/css']);
files.set('/clb-theme.css',['clb-theme.css','text/css']);
// Recursos compartidos que aún utilizan las fichas, búsquedas y reproducción web.
for(const name of ['library','global-search','mobile-playback','playback-capabilities'])files.set(`/mobile/${name}.mjs`,[`../mobile/${name}.mjs`,'text/javascript']);
for(const name of ['catalog-api','series-api','anime-api','tv-api','kids-api','releases-api','documentaries-api','episode-preview'])files.set(`/${name}.mjs`,[`../${name}.mjs`,'text/javascript']);
for(const name of ['source-config.js','genre-shelves.js','vendor/hls-1.7.3.min.js'])files.set(`/public/${name}`,[name,'text/javascript']);

for(const [route,file,type] of [['/ficha','ficha.html','text/html'],['/catalognet','catalognet.html','text/html'],['/reproductor','audio-1080.html','text/html']])files.set(route,[file,type]);
for(const name of ['player-es.mjs','web-player-controls.mjs','ficha.mjs','ficha-core.mjs','ficha.css','audio-1080.mjs','audio-1080-core.mjs','audio-1080.css','catalognet-browse.mjs','player-page.css','web-sources.mjs','web-sources.css'])files.set('/'+name,[name,name.endsWith('.css')?'text/css':'text/javascript']);
files.set('/web-header.css',['web-header.css','text/css']);
for(const name of ['premium.css','premium.js'])files.set('/'+name,[name,name.endsWith('.css')?'text/css':'text/javascript']);
for(const [route,file,type]of [['/administracion/accesos','access-admin.html','text/html'],['/activar','access-activate.html','text/html'],['/access-ui.mjs','access-ui.mjs','text/javascript'],['/access.css','access.css','text/css'],['/addons-local.mjs','addons-local.mjs','text/javascript'],['/availability-filter.js','availability-filter.js','text/javascript']])files.set(route,[file,type]);
for(const name of ['platform-catalogs.js','platform-catalogs.css'])files.set('/'+name,[name,name.endsWith('.css')?'text/css':'text/javascript']);
for(const name of ['catalog-runtime.js','auto-pagination.js','catalog-runtime.css'])files.set('/'+name,[name,name.endsWith('.css')?'text/css':'text/javascript']);
const avAssets=JSON.parse(await readFile(new URL('./public/vendor/libmedia/MANIFEST.json',import.meta.url),'utf8')).files.map(f=>f.file);
for(const name of avAssets)files.set('/vendor/libmedia/'+name,['vendor/libmedia/'+name,name.endsWith('.wasm')?'application/wasm':name.endsWith('.js')?'text/javascript':name.endsWith('.svg')?'image/svg+xml':name.endsWith('.mkv')?'video/x-matroska':'text/plain']);
export const requestHandler = async (req, res) => {
  if(!serveAccess(req,res))return;
  const removedPath=new URL(req.url,'http://clb.invalid').pathname;if(['/dramas','/microdrama','/mobile/'].includes(removedPath)||removedPath.startsWith('/api/dramas/')||removedPath.startsWith('/api/microdramas/')){res.writeHead(410,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({error:'La sección de dramas se retiró de CLB.'}));return;}
  if(req.url.startsWith('/api/platform-catalog?')){await platformCatalogApi(req,res);return;}
  if(req.url.startsWith('/api/access/')){await deviceAccess.api(req,res);return;}
  if(req.url==='/api/availability/check'){await availabilityApi(req,res);return;}
  if(req.url.startsWith('/api/addons-local/')){await addonsLocalApi(req,res);return;}
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  if(req.url.startsWith('/api/archive/links?')){await archiveApi(req,res);return;}
  if(req.url.startsWith('/api/ficha/')){await fichaApi(req,res);return;}
  if(req.url.startsWith('/api/catalognet/')){await catalognetApi(req,res);return;}
  if (req.url.startsWith('/api/documentaries/')) { await documentariesApi(req,res); return; }
  if (req.url.startsWith('/api/releases?')) { await releasesApi(req,res); return; }
  if (req.url.startsWith('/api/kids/')) { await kidsApi(req,res); return; }
  if (req.url.startsWith('/api/adult/')) { await adultApi(req,res); return; }
  if (req.url.startsWith('/api/tv/')) { await tvApi(req,res); return; }
  if (req.url.startsWith('/api/anime/')) { await animeApi(req,res,cinemeta); return; }
  if (req.url.startsWith('/api/series/')) { await seriesApi(req,res,cinemeta); return; }
  if (req.url.startsWith('/api/catalog?')) { await catalog(req,res); return; }
  if (req.url.startsWith('/api/movie?')) { await movieLookup(req,res); return; }
  const path = new URL(req.url,'http://app.invalid').pathname;
  const file = files.get(path);
  if (!file) { res.writeHead(404); res.end('No encontrado'); return; }
  try {
    let content = await readFile(new URL(`./public/${file[0]}`, import.meta.url));
    if(file[1]==='text/html'&&['/','/series','/anime','/documentales','/biblioteca','/kids','/tv','/catalognet'].includes(path))content=Buffer.from(content.toString('utf8').replace('</head>','<link rel="stylesheet" href="/catalog-runtime.css"><script src="/catalog-runtime.js"></script><script src="/auto-pagination.js" defer></script></head>'));
    if(file[1]==='text/html'&&process.env.CLB_LATINOBRID_MANIFEST&&['/','/series','/anime','/documentales','/biblioteca'].includes(path))content=Buffer.from(content.toString('utf8').replace('<head>','<head><script src="/availability-filter.js"></script>'));
    if(file[1]==='text/html'&&['/','/series','/anime','/documentales','/ficha','/reproductor','/biblioteca','/kids','/tv','/activar','/administracion/accesos'].includes(path))content=Buffer.from(withWebHeader(content.toString('utf8'),path));
    if(file[1]==='text/html'&&file[0]!=='adult.html')content=Buffer.from(content.toString('utf8').replace('</head>','<link rel="stylesheet" href="/web-sources.css"><script src="/web-sources.mjs" type="module"></script></head>'));
    if(file[1]==='text/html'&&!['adult.html','audio-1080.html'].includes(file[0]))content=Buffer.from(content.toString('utf8').replace('</head>','<link rel="stylesheet" href="/extension-notice.css"></head>').replace(/<body([^>]*)>/,'<body$1><aside class="clb-extension-notice" aria-label="Extensión opcional"><span>Mejora tu experiencia: bloquea pestañas emergentes de los proveedores.</span> <a href="/popup-guard.zip" download="CLB-Popup-Guard-1.1.0.zip">Descargar extensión</a> <small>Chrome, Edge y Brave · PC · instalación manual</small></aside>'));
    if(file[0]==='popup-guard.zip')res.setHeader('Content-Disposition','attachment; filename="CLB-Popup-Guard-1.1.0.zip"');
    const audioPage=file[0]==='audio-1080.html';
    const audioCsp="default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.tb-cdn.st https://*.yandex.net https://*.yandex.ru https://*.yandex.com https://*.yandexusercontent.com; media-src 'self' blob:; worker-src 'self' blob:; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
    if(audioPage){res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');}
    const mobileCsp="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src https: blob:; worker-src blob:; img-src 'self' https://image.tmdb.org https://images.metahub.space https://m.media-amazon.com https://images.justwatch.com https://media.kitsu.app https://media.kitsu.io https://s4.anilist.co https://static.tvmaze.com https://episodes.metahub.space https://archive.org; frame-src https://vixsrc.to https://www.vidking.net https://vidsrc.sh https://vidsrc.to https://facilitoplay.com https://vidlink.pro https://vidfast.vc https://cinesrc.st; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
    const adultCsp="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src https: blob:; worker-src blob:; img-src 'self' https://www.eporner.com https://*.eporner.com https://img.eporner.com; frame-src https://www.eporner.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
    await writeStatic(req,res,content, {'Content-Type': `${file[1]}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store', 'Content-Security-Policy': audioPage?audioCsp:['ficha.html','catalognet.html','documentaries.html'].includes(file[0])?mobileCsp:file[0]==='adult.html'?adultCsp:file[0]==='tv.html' ? "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https:; media-src https: blob:; worker-src blob:; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" : "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https://image.tmdb.org https://images.metahub.space https://m.media-amazon.com https://images.justwatch.com https://media.kitsu.app https://media.kitsu.io https://s4.anilist.co; frame-src https://vixsrc.to https://www.vidking.net https://vidsrc.sh https://vidsrc.to https://facilitoplay.com https://vidlink.pro https://vidfast.vc https://cinesrc.st; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"},file[0]);
  } catch { res.writeHead(500); res.end('No se pudo leer el recurso local'); }
};
