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

import {createDramasApi} from './dramas-api.mjs';
import {createDocumentariesApi} from './documentaries-api.mjs';
const dramasApi=createDramasApi(),documentariesApi=createDocumentariesApi();
const files = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']], ['/style.css', ['style.css', 'text/css']], ['/catalog.css', ['catalog.css', 'text/css']], ['/series', ['series.html','text/html']], ['/anime', ['series.html','text/html']], ['/series.js',['series.js','text/javascript']], ['/playback.js',['playback.js','text/javascript']], ['/source-config.js',['source-config.js','text/javascript']], ['/popup-guard.zip',['popup-guard.zip','application/zip']], ['/series.css',['series.css','text/css']]]);
for(const [path,file,type] of [['/tv','tv.html','text/html'],['/tv.js','tv.js','text/javascript'],['/tv.css','tv.css','text/css'],['/vendor/hls-1.7.3.min.js','vendor/hls-1.7.3.min.js','text/javascript']])files.set(path,[file,type]);
for(const [path,file,type] of [['/kids','kids.html','text/html'],['/kids.js','kids.js','text/javascript'],['/kids.css','kids.css','text/css'],['/player-policy.mjs','../mobile/player-policy.mjs','text/javascript']])files.set(path,[file,type]);
for(const [route,file,type] of [['/adult','adult.html','text/html'],['/adult.js','adult.js','text/javascript'],['/adult.css','adult.css','text/css'],['/index.html',['index.html','text/html'][0],'text/html']])files.set(route,[file,type]);
files.set('/genre-shelves.js',['genre-shelves.js','text/javascript']);
for(const [route,file,type] of [['/biblioteca','biblioteca.html','text/html'],['/web-library.js','web-library.js','text/javascript'],['/web-library-core.mjs','web-library-core.mjs','text/javascript'],['/web-library.css','web-library.css','text/css']])files.set(route,[file,type]);
files.set('/documentales',['../mobile/index.html','text/html']);
files.set('/web-preview-responsive.css',['web-preview-responsive.css','text/css']);
files.set('/responsive.css',['responsive.css','text/css']);
files.set('/clb-theme.css',['clb-theme.css','text/css']);
// Vista compartida con Android para Dramas y su previsualización local. Lista explícita de recursos.
files.set('/dramas',['../mobile/index.html','text/html']);
files.set('/mobile/',['../mobile/index.html','text/html']);
for(const name of ['app','api','player-policy','live-player','posters','library','global-search','drama-tests','tv-navigation','tv-watch','tv-remote-player','mobile-playback','playback-capabilities'])files.set(`/mobile/${name}.mjs`,[`../mobile/${name}.mjs`,'text/javascript']);
files.set('/mobile/tv.css',['../mobile/tv.css','text/css']);
files.set('/mobile/mobile.css',['../mobile/mobile.css','text/css']);
for(const name of ['catalog-api','series-api','anime-api','tv-api','kids-api','releases-api','documentaries-api','dramas-api'])files.set(`/${name}.mjs`,[`../${name}.mjs`,'text/javascript']);
for(const name of ['source-config.js','genre-shelves.js','vendor/hls-1.7.3.min.js'])files.set(`/public/${name}`,[name,'text/javascript']);

for(const [route,file,type] of [['/ficha','ficha.html','text/html'],['/catalognet','catalognet.html','text/html'],['/reproductor','audio-1080.html','text/html']])files.set(route,[file,type]);
for(const name of ['player-es.mjs','web-player-controls.mjs','ficha.mjs','ficha-core.mjs','ficha.css','audio-1080.mjs','audio-1080-core.mjs','audio-1080.css','catalognet-browse.mjs','player-page.css','web-sources.mjs','web-sources.css'])files.set('/'+name,[name,name.endsWith('.css')?'text/css':'text/javascript']);
const avAssets=JSON.parse(await readFile(new URL('./public/vendor/libmedia/MANIFEST.json',import.meta.url),'utf8')).files.map(f=>f.file);
for(const name of avAssets)files.set('/vendor/libmedia/'+name,['vendor/libmedia/'+name,name.endsWith('.wasm')?'application/wasm':name.endsWith('.js')?'text/javascript':name.endsWith('.svg')?'image/svg+xml':name.endsWith('.mkv')?'video/x-matroska':'text/plain']);
export const requestHandler = async (req, res) => {
  if(!serveAccess(req,res))return;
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  if(req.url.startsWith('/api/ficha/')){await fichaApi(req,res);return;}
  if(req.url.startsWith('/api/catalognet/')){await catalognetApi(req,res);return;}
  if (req.url.startsWith('/api/dramas/')) { await dramasApi(req,res); return; }
  if (req.url.startsWith('/api/documentaries/')) { await documentariesApi(req,res); return; }
  if (req.url.startsWith('/api/releases?')) { await releasesApi(req,res); return; }
  if (req.url.startsWith('/api/kids/')) { await kidsApi(req,res); return; }
  if (req.url.startsWith('/api/adult/')) { await adultApi(req,res); return; }
  if (req.url.startsWith('/api/tv/')) { await tvApi(req,res); return; }
  if (req.url.startsWith('/api/anime/')) { await animeApi(req,res,cinemeta); return; }
  if (req.url.startsWith('/api/series/')) { await seriesApi(req,res,cinemeta); return; }
  if (req.url.startsWith('/api/catalog?')) { await catalog(req,res); return; }
  if (req.url.startsWith('/api/movie?')) { await movieLookup(req,res); return; }
  const file = files.get(new URL(req.url,'http://app.invalid').pathname);
  if (!file) { res.writeHead(404); res.end('No encontrado'); return; }
  try {
    let content = await readFile(new URL(`./public/${file[0]}`, import.meta.url));
    if(file[0]==='../mobile/index.html')content=Buffer.from(content.toString('utf8').replace('href="mobile.css"','href="/mobile/mobile.css"').replace('href="tv.css"','href="/mobile/tv.css"').replace('src="app.mjs"','src="/mobile/app.mjs"').replace('src="../public/','src="/public/').replace('src="../public/','src="/public/').replace('src="../public/','src="/public/').replace('</head>','<link rel="stylesheet" href="/web-preview-responsive.css"></head>').replace('<body>','<body class="web-preview">').replace('<button id="menu-toggle"','<nav class="desktop-nav" aria-label="Secciones"><a href="/">Películas</a><a href="/series">Series</a><a href="/anime">Anime</a><a href="/documentales">Documentales</a><a href="/dramas">Dramas</a><a href="/biblioteca?view=search">Buscar en todo</a><a href="/biblioteca">Mi lista</a><a href="/kids">Kids</a><a href="/tv">TV en vivo</a></nav><button id="menu-toggle"').replace('class="tv-connect subtle"','class="tv-connect subtle" hidden'));
    if(file[1]==='text/html'&&file[0]!=='adult.html')content=Buffer.from(content.toString('utf8').replace('</head>','<link rel="stylesheet" href="/web-sources.css"><script src="/web-sources.mjs" type="module"></script></head>'));
    const audioPage=file[0]==='audio-1080.html';
    const audioCsp="default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.yandex.net https://*.yandex.ru https://*.yandex.com https://*.yandexusercontent.com; media-src 'self' blob:; worker-src 'self' blob:; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
    if(audioPage){res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');}
    const mobileCsp="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src https: blob:; worker-src blob:; img-src 'self' https://image.tmdb.org https://images.metahub.space https://m.media-amazon.com https://images.justwatch.com https://media.kitsu.app https://media.kitsu.io https://s4.anilist.co https://static.tvmaze.com https://archive.org; frame-src https://vixsrc.to https://www.vidking.net https://vidsrc.sh https://vidsrc.to https://facilitoplay.com https://vidlink.pro https://vidfast.vc https://cinesrc.st; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
    const adultCsp="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src https: blob:; worker-src blob:; img-src 'self' https://www.eporner.com https://*.eporner.com https://img.eporner.com; frame-src https://www.eporner.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
    await writeStatic(req,res,content, {'Content-Type': `${file[1]}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store', 'Content-Security-Policy': audioPage?audioCsp:['ficha.html','catalognet.html'].includes(file[0])?mobileCsp:file[0]==='adult.html'?adultCsp:file[0]==='../mobile/index.html'?mobileCsp:file[0]==='tv.html' ? "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https:; media-src https: blob:; worker-src blob:; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" : "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https://image.tmdb.org https://images.metahub.space https://m.media-amazon.com https://images.justwatch.com https://media.kitsu.app https://media.kitsu.io https://s4.anilist.co; frame-src https://vixsrc.to https://www.vidking.net https://vidsrc.sh https://vidsrc.to https://facilitoplay.com https://vidlink.pro https://vidfast.vc https://cinesrc.st; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"},file[0]);
  } catch { res.writeHead(500); res.end('No se pudo leer el recurso local'); }
};
