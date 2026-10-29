import {createDramaTests,dramaStatuses} from '../mobile/drama-tests.mjs';
function testDramaTests(){let data;return createDramaTests({storage:{getItem:()=>data,setItem:(k,v)=>{data=v;}}});}
import {createLibrary,libraryItem} from '../mobile/library.mjs';
import {createGlobalSearch,searchSections} from '../mobile/global-search.mjs';
function testLibrary(){let data;return createLibrary({storage:{getItem:()=>data,setItem:(k,s)=>{data=s;}}});}
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {platformNames} from '../series-api.mjs';
import {candidates,canChooseQuality} from '../mobile/player-policy.mjs';
import {createLivePlayer} from '../mobile/live-player.mjs';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
class Element {
  constructor(tag='div'){this.tag=tag;this.children=[];this.attributes={};this.dataset={};this.value='';this.textContent='';this.parentElement={hidden:false};this.listeners={};this.classList={add(){},remove(){}};}
  append(...values){for(const e of values){this.children.push(e);if(this.tag==='select'&&this.children.length===1)this.value=String(e.value);}}
  replaceChildren(...values){this.children=[];if(this.tag==='select')this.value='';this.append(...values);}
  get options(){return this.children;}
  get firstChild(){return this.children[0]||{textContent:''};}
  get selectedOptions(){return this.children.filter(e=>String(e.value)===String(this.value));}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k];}
  removeAttribute(k){delete this.attributes[k];}
  querySelectorAll(selector){return this.children.flatMap(c=>[...selector.split(',').some(s=>s.startsWith('.')?c.className===s.slice(1):c.tag===s)?[c]:[],...c.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  addEventListener(k,fn){this.listeners[k]=fn;}
  dispatchEvent(e){this.listeners[e.type]?.(e);}
  requestSubmit(){return this.listeners.submit?.({preventDefault(){}});}
  scrollIntoView(){} focus(){} blur(){} reset(){}
  pause(){this.paused=true;} load(){} play(){return Promise.resolve();} canPlayType(){return '';}
}
function dom(html){
  const ids=new Map();
  for(const m of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){
    const el=new Element(m[1]);el.checked=/\bchecked\b/.test(m[0]);ids.set(m[2],el);
  }
  for(const m of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){
    for(const o of m[2].matchAll(/<option\b[^>]*value="([^"]*)"[^>]*>([^<]*)<\/option>/g)){const el=new Element('option');el.value=o[1];el.textContent=o[2];ids.get(m[1]).append(el);}
  }
  const views=[...html.matchAll(/data-view="([^"]+)"/g)].map(m=>{const e=new Element('button');e.dataset.view=m[1];return e;});
  const kinds=[...html.matchAll(/data-kind="([^"]+)"/g)].map(m=>{const e=new Element('button');e.dataset.kind=m[1];return e;});
  return {ids,document:{getElementById:id=>ids.get(id),createElement:tag=>new Element(tag),querySelectorAll:q=>q==='[data-view]'?views:q==='[data-kind]'?kinds:[],querySelector:()=>new Element(),body:new Element(),addEventListener(){},dispatchEvent(){}}};
}
function firstCard(root){if(['movie-card','card'].includes(root.className))return root;for(const child of root.children||[]){const found=firstCard(child);if(found)return found;}return null;}
const movie={id:'550',imdbId:'tt0137523',name:'Fight Club',year:1999,genres:['Drama'],posterUrl:''};
const show={id:'tt0903747',name:'Breaking Bad',year:2008,genres:['Drama'],platforms:['pmp'],posterUrl:''};
function result(path){if(path.startsWith('/api/releases?'))return {items:[],source:'AniList'};return path.startsWith('/api/catalog')?{movies:[movie],nextSkip:48,hasMore:false}:{series:[show],nextSkip:50,hasMore:false,total:null,genres:['Drama'],platforms:[],warnings:[]};}
async function desktop(page){
  const {ids,document}=dom(await read(`public/${page==='movie'?'index':'series'}.html`)),requests=[];
  const ctx={document,URL,URLSearchParams,AbortController,AbortSignal,Intl,Date,Event,setTimeout,clearTimeout,location:{pathname:page==='movie'?'/':page==='anime'?'/anime':'/series'},localStorage:{getItem:()=>null},fetch:async path=>{requests.push(path);return {ok:true,json:async()=>result(path)};}};
  ctx.window=ctx;vm.createContext(ctx);
  for(const file of ['public/source-config.js','public/playback.js','public/genre-shelves.js',page==='movie'?'public/app.js':'public/series.js'])vm.runInContext(await read(file),ctx,{filename:file});
  await new Promise(setImmediate);return {ids,requests,ctx};
}
test('PC: películas inicia populares y habilita año sin pulsar Enter',async()=>{
  const {ids,requests}=await desktop('movie');
  assert.ok(requests.some(p=>p.includes('kind=popular&year=all')));
  assert.ok(ids.get('release-year').options.length>100);
  assert.equal(firstCard(ids.get('movie-grid')).attributes['aria-label'],'Ver ficha de Fight Club');
  assert.match(ids.get('catalog-source').textContent,/Catálogo popular/);
});
test('PC: catálogo limpio, portada abre solo vídeo y controles; carga manual permanece opcional',async()=>{
  const html=await read('public/index.html');
  assert.doesNotMatch(html,/<section class="hero"|data-view="selection"|href="#watch">Reproductor/);
  assert.match(html,/<section id="watch"[^>]*hidden/);assert.doesNotMatch(html,/<details id="advanced-tools"[^>]*\bopen\b/);
  const names=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(names).size,names.length);
  assert.ok(html.indexOf('id="audio-preference"')<html.indexOf('id="advanced-tools"'));
  assert.ok(html.indexOf('id="player-form"')>html.indexOf('id="advanced-tools"'));
  const {ids}=await desktop('movie');assert.notEqual(ids.get('advanced-tools').open,true);assert.equal(ids.get('player').children.length,0);
  firstCard(ids.get('movie-grid')).listeners.click();await new Promise(setImmediate);
  assert.equal(ids.get('watch').hidden,false);assert.equal(ids.get('now-playing').textContent,'Fight Club');assert.equal(ids.get('player').children.length,1);
  assert.notEqual(ids.get('advanced-tools').open,true);assert.equal(ids.get('player').children[0].attributes.sandbox,undefined);assert.match(ids.get('playback-protection').textContent,/Sin protección sandbox/);
  ids.get('retry-provider').listeners.click();await new Promise(setImmediate);assert.equal(ids.get('player').children.length,1);
  ids.get('stop').listeners.click();assert.equal(ids.get('watch').hidden,true);assert.equal(ids.get('player').children.length,0);
  ids.get('movie-id').value='27205';ids.get('movie-name').value='Inception';await ids.get('player-form').requestSubmit();assert.equal(ids.get('watch').hidden,false);assert.equal(ids.get('now-playing').textContent,'Inception');
});
test('PC: series inicia catálogo y plataformas sin pulsar Enter',async()=>{
  const {ids,requests}=await desktop('series');
  assert.ok(requests.some(p=>p.includes('platform=internet')));assert.ok(ids.get('platforms').children.length>=20);
  assert.equal(firstCard(ids.get('series-grid')).attributes['aria-label'],'Ver episodios de Breaking Bad');
  assert.equal(ids.get('series-grid').getAttribute('aria-busy'),'false');
});
test('CLB: películas y series muestran estantes; la búsqueda usa resultados sin repetición',async()=>{
  const movies=await desktop('movie');assert.equal(movies.ids.get('movie-grid').children[0].className,'genre-shelf');
  assert.equal(movies.ids.get('movie-grid').children[0].children[0].children[0].textContent,'Últimos lanzamientos');
  movies.ids.get('search').value='Fight Club';await vm.runInContext('loadCatalog()',movies.ctx);
  const shelf=movies.ids.get('movie-grid').children[0];assert.equal(shelf.children[0].children[0].textContent,'Resultados de búsqueda');assert.equal(shelf.children[1].className,'search-results-grid');assert.equal(shelf.children[1].children.length,1);
  const series=await desktop('series');assert.equal(series.ids.get('series-grid').children[0].className,'genre-shelf');assert.equal(series.ids.get('active-platform').textContent,'Explorar todas · Internet');
  const html=await read('public/series.html');assert.match(html,/<label id="series-genre-label" hidden>/);assert.doesNotMatch(await read('public/index.html'),/id="genres"/);
});
test('CLB: anime conserva sus fuentes y se organiza en catálogos con la nueva marca',async()=>{
  const {ids,ctx}=await desktop('anime');assert.equal(ctx.document.title,'CLB · Anime');assert.equal(ids.get('series-genre-label').hidden,true);assert.equal(ids.get('platform-picker').open,true);assert.equal(ids.get('platforms').children.length,3);
  assert.equal(ids.get('series-grid').children[0].className,'genre-shelf');
});

test('TV: calidad automática ignora preferencia guardada, desactiva ahorro y conserva capítulo al cambiar fuente',async()=>{
 const {ids,document}=dom(await read('mobile/index.html'));
 const ctx={installMobilePlayback:()=>({setContext(){},detach(){},attach(){},decorate:value=>value}),document,URL,URLSearchParams,Intl,Date,setTimeout,clearTimeout,location:{origin:'https://test.invalid',search:'?tv=1'},installTVNavigation(options){ctx.tvActions=options.actions;},platformNames,createLibrary:testLibrary,libraryItem,createGlobalSearch,searchSections,createDramaTests:testDramaTests,dramaStatuses,canChooseQuality,createPosterLoader:()=>({attach(){},reset(){}}),createLivePlayer:args=>createLivePlayer({...args,document}),scrollTo(){},api:async path=>path.includes('/series/detail')?{id:'tt0903747',name:'Serie',tmdbId:'1396',episodes:[{season:2,episode:3,name:'Tres'}]}:result(path)};
 ctx.window=ctx;vm.createContext(ctx);for(const file of ['public/source-config.js','public/genre-shelves.js'])vm.runInContext(await read(file),ctx);
 ctx.candidates=(s,e,l,q)=>candidates(s,e,l,q,ctx.CineSources);
 ctx.CineDataSaver.set(true);
 vm.runInContext((await read('mobile/app.mjs')).replace(/^import .*;\r?\n/gm,''),ctx);await new Promise(setImmediate);
 await vm.runInContext("open({id:'tt0903747',section:'series',kind:'series',name:'Serie'},{quality:'1080'})",ctx);
 assert.equal(ids.get('player').children.length,0);
 assert.equal(ctx.CineDataSaver.enabled,false);assert.equal(ids.get('quality').value,'auto');
 assert.equal(ctx.MobileAppTVServers,undefined);assert.equal(ctx.MobileAppTVSelectServer,undefined);
 assert.equal(vm.runInContext("activeItem({kind:'series',section:'drama'})",ctx),false);
 ids.get('quality').value='1080';vm.runInContext('play()',ctx);assert.equal(ids.get('quality').value,'auto');
 const previousFrame=ids.get('player').children[0];let entered=0;ctx.CLBTVStartPlayer=()=>entered++;ids.get('play').listeners.click();assert.equal(entered,1);assert.equal(ids.get('player').children[0],previousFrame);
 ids.get('alternative').listeners.click();const frame=ids.get('player').children[0];assert.ok(frame.src.includes('/2/3'));assert.equal(vm.runInContext('chosen().episode',ctx),3);
 const provider=vm.runInContext('tvActiveProvider',ctx);assert.equal(ctx.tvActions.canAvoid(),true);ctx.tvActions.avoidCurrent();assert.equal(ctx.tvActions.hasAvoided(),true);assert.equal(vm.runInContext('playbackOptions()',ctx).some(o=>o.provider===provider),false);assert.equal(vm.runInContext('chosen().episode',ctx),3);
 ctx.tvActions.restoreServers();assert.equal(ctx.tvActions.hasAvoided(),false);assert.equal(vm.runInContext('playbackOptions()',ctx).some(o=>o.provider===provider),true);
});

test('web: preferencias españolas conservan correspondencia IMDb y bloqueo de capítulos futuros',async()=>{
 const {ids,ctx}=await desktop('anime');
 ctx.fetch=async()=>({ok:true,json:async()=>({id:'mal:62484',kind:'anime',malId:62484,imdbId:'tt35769369',tmdbId:'123',name:'Part 2',playbackType:'series',episodeSource:'Kitsu + AniList',episodes:[{season:1,episode:1,malEpisode:1,absoluteEpisode:14,sourceEpisode:14,name:'Uno'},{season:1,episode:2,name:'Próximo',upcoming:true}]})});
 await vm.runInContext("openShow({id:'mal:62484',name:'Part 2'})",ctx);
 vm.runInContext('play()',ctx);
 assert.match(ids.get('series-player').children[0].src,/vidsrc\.sh\/embed\/tv\/tt35769369\/1\/14/);
 assert.match(ids.get('series-player-status').textContent,/VidSrc.sh/);
 assert.equal(ids.get('episode-grid').querySelectorAll('button')[1].disabled,true);
 ids.get('series-language').value='castellano';ids.get('series-language').listeners.change();
 assert.equal(ids.get('series-provider').value,'facilito');
 assert.match(ids.get('series-player').children[0].src,/\/e\/serie\/123\/1\/14/);
 assert.equal(Number(ids.get('episode').value),1);
 assert.match(ids.get('series-player-status').textContent,/no cambia automáticamente/);
 const movies=await desktop('movie');
 movies.ids.get('audio-preference').value='castellano';movies.ids.get('audio-preference').listeners.change();
 assert.equal(movies.ids.get('audio-preference').value,'castellano');assert.equal(movies.ids.get('provider').value,'facilito');
});
test('móvil: carga inicial y cambio a series muestran catálogo activo y plataforma',{timeout:1000},async()=>{
  const {ids,document}=dom(await read('mobile/index.html')),requests=[];
  const ctx={installMobilePlayback:()=>({setContext(){},detach(){},attach(){},decorate:value=>value}),document,URL,URLSearchParams,Intl,Date,setTimeout,clearTimeout,location:{origin:'https://test.invalid'},platformNames,createLibrary:testLibrary,libraryItem,createGlobalSearch,searchSections,createDramaTests:testDramaTests,dramaStatuses,createPosterLoader:()=>({attach(){},reset(){}}),createLivePlayer:args=>createLivePlayer({...args,document}),api:async path=>{requests.push(path);return result(path);},scrollTo(){}};
  ctx.window=ctx;vm.createContext(ctx);
  vm.runInContext(await read('public/genre-shelves.js'),ctx);
  vm.runInContext((await read('mobile/app.mjs')).replace(/^import .*;\r?\n/gm,''),ctx);
  await new Promise(setImmediate);
  assert.ok(requests.some(p=>/kind=popular/.test(p)));assert.match(ids.get('active-catalog').textContent,/Cinemeta/);
  assert.equal(ids.get('grid').children[0].children[0].children[0].textContent,'Últimos lanzamientos');
  vm.runInContext("chooseKind('series')",ctx);await new Promise(setImmediate);
  assert.match(requests.at(-1),/platform=internet/);assert.match(ids.get('active-catalog').textContent,/Explorar todas/);
  const card=firstCard(ids.get('grid'));assert.equal(card.children.at(-1).textContent,'Paramount+');
  ids.get('source').value='pmp';await vm.runInContext('load()',ctx);
  assert.match(ids.get('active-catalog').textContent,/Paramount\+/);
  const original=ctx.api;let finishReleases;
  ctx.api=path=>path.startsWith('/api/releases?')?new Promise(resolve=>{finishReleases=resolve;}):original(path);
  await vm.runInContext('load()',ctx);
  assert.equal(ids.get('grid').getAttribute('aria-busy'),'false');assert.ok(firstCard(ids.get('grid')));
  finishReleases({items:[],note:'Fechas de título'});await new Promise(setImmediate);
  assert.equal(ids.get('section-menu').hidden,true);
  ids.get('menu-toggle').listeners.click();assert.equal(ids.get('section-menu').hidden,false);
  assert.equal(ctx.MobileAppBack(),true);assert.equal(ids.get('section-menu').hidden,true);
  ids.get('menu-toggle').listeners.click();ids.get('menu-backdrop').listeners.click();assert.equal(ids.get('menu-backdrop').hidden,true);
  const pages=[];ctx.api=async path=>{
    if(path.startsWith('/api/releases?'))return {items:[],note:'Fechas de estreno'};
    const skip=Number(new URL(path,'https://test.invalid').searchParams.get('skip'));pages.push(skip);
    return {movies:[{...movie,id:String(skip+1)}],nextSkip:skip+48,hasMore:skip<400};
  };
  vm.runInContext("chooseKind('movie')",ctx);await new Promise(setImmediate);
  assert.deepEqual(pages,[0,48,96,144]);assert.equal(vm.runInContext('items.length',ctx),4);
  const hasClass=(el,name)=>el.className===name||el.children?.some(c=>hasClass(c,name));
  assert.equal(hasClass(ids.get('grid'),'shelf-actions'),false);
  assert.equal(ids.get('grid').children[0].children.length,2); // Encabezado + fila, sin aviso visible.
  await vm.runInContext('load(true)',ctx);assert.equal(vm.runInContext('items.length',ctx),6);
  ids.get('search').value='Fight';pages.length=0;await vm.runInContext('load()',ctx);assert.deepEqual(pages,[0]);
});
test('TV: inicia en México, abre señal directa, selecciona calidad y libera reproductor',async()=>{
  const {ids,document}=dom(await read('public/tv.html')),requests=[],players=[];
  const channel={id:'One.mx',name:'Canal Uno',country:'MX',categories:['news'],sourceCount:1,qualities:['720p'],website:'https://example.com',streams:[{url:'https://cdn.example.com/live.m3u8',title:'Uno',quality:'720p',labels:[]}]};
  class Hls {
    static Events={MANIFEST_PARSED:'manifest',ERROR:'error'};static isSupported(){return true;}
    constructor(){this.handlers={};this.levels=[{height:720,bitrate:2000000},{height:1080,bitrate:4000000}];players.push(this);}
    on(event,fn){this.handlers[event]=fn;} loadSource(url){this.url=url;} attachMedia(){this.handlers.manifest();} destroy(){this.destroyed=true;}
  }
  const ctx={document,Intl,URL,URLSearchParams,AbortController,AbortSignal,setTimeout,clearTimeout,Hls,location:{search:''},addEventListener(){},fetch:async path=>{requests.push(path);const value=path.includes('/filters')?{countries:[{code:'MX',name:'Mexico',count:1,flag:'🇲🇽'}],categories:[{id:'news',name:'News'},{id:'kids',name:'Kids'}],total:1}:path.includes('/channel?')?channel:{channels:[channel],total:1,nextSkip:1,hasMore:false};return {ok:true,json:async()=>value};}};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(await read('public/tv.js'),ctx);await new Promise(setImmediate);
  assert.match(requests[1],/country=MX/);assert.equal(ids.get('channels').children.length,1);
  await ids.get('channels').children[0].listeners.click();assert.equal(players[0].url,channel.streams[0].url);assert.equal(ids.get('quality').options.length,3);assert.equal(ids.get('quality').disabled,false);
  ids.get('quality').value='1';ids.get('quality').listeners.change();assert.equal(players[0].currentLevel,1);
  ids.get('stop').listeners.click();assert.equal(players[0].destroyed,true);assert.equal(ids.get('watch').hidden,true);
  ctx.location.search='?category=kids&country=all&channel=One.mx';channel.categories=['kids'];
  await vm.runInContext('init()',ctx);assert.equal(ids.get('category').value,'kids');assert.equal(ids.get('country').value,'all');
  assert.equal(ids.get('watch').hidden,false);assert.ok(requests.some(p=>p.includes('category=kids')));
  ids.get('stop').listeners.click();
});
test('Kids: arranca con cuatro estantes, abre serie protegida y respeta episodio siguiente',async()=>{
  const {ids,document}=dom(await read('public/kids.html'));
  const movie={id:'tt0000001',kind:'movie',name:'Película familiar',year:2020,genres:['Family']};
  const show={id:'tt7678620',kind:'series',name:'Bluey',year:2018,genres:['Animation']};
  const episodeList=[{season:1,episode:1,name:'Primero',upcoming:false},{season:1,episode:2,name:'Segundo',upcoming:false}];
  const ctx={document,URL,URLSearchParams,AbortController,AbortSignal,Date,Event,setTimeout,clearTimeout,candidates,canChooseQuality,addEventListener(){},location:{assign(){}},fetch:async path=>({ok:true,json:async()=>path.startsWith('/api/releases?')?{items:[]}:path.includes('/detail?')?{id:show.id,name:'Bluey',tmdbId:'82728',episodes:episodeList}: {sections:[{kind:'movie',title:'Películas',items:[movie],nextSkip:50,hasMore:true},{kind:'series',title:'Series',items:[show],nextSkip:12,hasMore:true},{kind:'anime',title:'Anime',items:[],nextSkip:20,hasMore:true},{kind:'tv',title:'TV',items:[],nextSkip:60,hasMore:false}],warnings:[]}})};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(await read('public/source-config.js'),ctx);vm.runInContext(await read('public/playback.js'),ctx);vm.runInContext(await read('public/genre-shelves.js'),ctx);
  // Política compartida recibe explícitamente los orígenes del contexto del navegador.
  ctx.candidates=(s,e,l,q)=>candidates(s,e,l,q,ctx.CineSources);
  vm.runInContext((await read('public/kids.js')).replace(/^import .*;\r?\n/gm,''),ctx);await new Promise(setImmediate);
  assert.ok(ids.get('kids-results').children.length>=4);assert.equal(ids.get('kids-results').children[0].children[0].children[0].textContent,'Últimos lanzamientos Kids');assert.equal(ids.get('surprise').disabled,false);
  await vm.runInContext("open({id:'tt7678620',kind:'series',name:'Bluey'})",ctx);
  assert.equal(ids.get('kids-player').children.length,1);assert.equal(ids.get('kids-player').children[0].attributes.sandbox,'allow-scripts allow-same-origin allow-presentation');
  ids.get('kids-next').listeners.click();assert.equal(Number(ids.get('kids-episode').value),2);assert.equal(ids.get('kids-next').disabled,true);
  assert.equal(ids.get('block-popups').checked,true);ids.get('kids-close').listeners.click();assert.equal(ids.get('kids-player').children.length,0);
});

test('móvil CLB: anime/Kids/TV, calidad real y regreso a películas sin controles contaminados',async()=>{
  const {ids,document}=dom(await read('mobile/index.html')),requests=[],players=[];
  const channel={id:'Kids.mx',name:'Canal infantil',country:'MX',categories:['kids'],streams:[{url:'https://cdn.example.com/live.m3u8',title:'Señal',quality:'Auto'}]};
  const kid={id:'tt7678620',kind:'series',name:'Bluey',year:2018,genres:['Animation']};
  class Hls {
    static Events={MANIFEST_PARSED:'manifest',ERROR:'error'};static isSupported(){return true;}
    constructor(){this.handlers={};this.levels=[{height:720,bitrate:2e6},{height:1080,bitrate:4e6}];players.push(this);}
    on(e,fn){this.handlers[e]=fn;} loadSource(url){this.url=url;} attachMedia(){this.handlers.manifest();} destroy(){this.destroyed=true;}
  }
  const ctx={installMobilePlayback:()=>({setContext(){},detach(){},attach(){},decorate:value=>value}),document,URL,URLSearchParams,Intl,Date,setTimeout,clearTimeout,location:{origin:'https://test.invalid'},platformNames,createLibrary:testLibrary,libraryItem,createGlobalSearch,searchSections,createDramaTests:testDramaTests,dramaStatuses,canChooseQuality,createPosterLoader:()=>({attach(){},reset(){}}),createLivePlayer:args=>createLivePlayer({...args,document,Hls}),scrollTo(){},api:async path=>{
    requests.push(path);
    if(path.startsWith('/api/releases?'))return {items:[],note:'Fechas de título'};
    if(path.startsWith('/api/kids/detail?'))return {...kid,playbackType:'series',tmdbId:'82728',episodes:[{season:1,episode:1,name:'Uno'},{season:1,episode:2,name:'Dos'}]};
    if(path.startsWith('/api/kids/catalog?'))return {sections:[{kind:'series',items:[kid],nextSkip:18,hasMore:false}],warnings:[]};
    if(path.startsWith('/api/tv/filters'))return {countries:[{code:'MX',name:'Mexico',flag:'🇲🇽',count:1}],categories:[{id:'kids',name:'Kids'}]};
    if(path.startsWith('/api/tv/channel?'))return channel;
    if(path.startsWith('/api/tv/catalog?'))return {channels:[channel],total:1,hasMore:false};
    return result(path);
  }};
  ctx.window=ctx;vm.createContext(ctx);
  for(const f of ['public/source-config.js','public/genre-shelves.js'])vm.runInContext(await read(f),ctx);
  ctx.candidates=(s,e,l,q)=>candidates(s,e,l,q,ctx.CineSources);
  vm.runInContext((await read('mobile/app.mjs')).replace(/^import .*;\r?\n/gm,''),ctx);await new Promise(setImmediate);
  assert.equal(document.querySelectorAll('[data-kind]').length,7);
  vm.runInContext("chooseKind('anime')",ctx);await new Promise(setImmediate);
  assert.equal(ids.get('genre-label').hidden,true);assert.equal(ids.get('brand-section').textContent,'anime');
  assert.ok(requests.some(p=>p.includes('/api/releases?kind=anime')));
  vm.runInContext("chooseKind('kids')",ctx);await new Promise(setImmediate);
  assert.equal(ids.get('grid').children[0].children[0].children[0].textContent,'Últimos lanzamientos Kids');
  assert.equal(ids.get('family-note').hidden,false);assert.equal(ids.get('manual-tools').hidden,true);
  const originalApi=ctx.api,kidPages=[];
  ctx.api=async path=>{
    if(!path.startsWith('/api/kids/catalog?'))return originalApi(path);
    const u=new URL(path,'https://test.invalid'),selection=u.searchParams.get('kind'),skip=Number(u.searchParams.get('skip'));
    kidPages.push([selection,skip]);
    return {sections:(selection==='all'?['movie','series','anime']:[selection]).map(type=>({kind:type,items:[{id:type+skip,kind:type,name:type+skip,genres:['Family']}],nextSkip:skip+1,hasMore:skip<2})),warnings:[]};
  };
  await vm.runInContext('load()',ctx);assert.deepEqual(kidPages,[['all',0],['movie',1],['series',1],['anime',1]]);
  assert.equal(vm.runInContext('items.length',ctx),6);assert.equal(ids.get('more').hidden,false);
  await vm.runInContext('load(true)',ctx);assert.deepEqual(kidPages.slice(4),[['movie',2],['series',2]]);
  ctx.api=originalApi;
  await vm.runInContext("open({id:'tt7678620',kind:'series',name:'Bluey'})",ctx);
  assert.ok(requests.some(p=>p.includes('/api/kids/detail?kind=series')));assert.equal(ids.get('watch-type').textContent,'SERIE');
  assert.equal(ids.get('player').children[0].tag,'iframe');
  const frame=ids.get('player').children[0],frameUrl=frame.src;ctx.MobileAppSuspend();ctx.MobileAppResume();assert.equal(ids.get('player').children[0],frame);assert.equal(frame.src,frameUrl);
  ids.get('reload-player').listeners.click();const reloaded=ids.get('player').children[0];assert.notEqual(reloaded,frame);assert.equal(reloaded.src,frameUrl);assert.equal(vm.runInContext('chosen().episode',ctx),1);
  ctx.MobileAppFullscreen(true);assert.equal(ids.get('exit-fullscreen').hidden,true);assert.equal(ids.get('alternative').hidden,true);assert.equal(ids.get('player').children[0],reloaded);ctx.MobileAppFullscreen(false);assert.equal(ids.get('exit-fullscreen').hidden,true);assert.equal(ids.get('player').children[0],reloaded);
  assert.equal(ids.get('episodes').children.length,1);assert.notEqual(ids.get('episodes').children[0].open,true);ids.get('episodes').children[0].children[1].children[1].listeners.click();assert.equal(vm.runInContext('chosen().episode',ctx),2);assert.match(ids.get('current-episode').textContent,/E2/);
  vm.runInContext("chooseKind('tv')",ctx);await new Promise(setImmediate);
  assert.ok(requests.some(p=>p.includes('country=MX')));assert.equal(ids.get('genre-tool').hidden,false);
  await vm.runInContext("open({id:'Kids.mx',kind:'tv',name:'Canal infantil'})",ctx);
  assert.equal(players[0].url,channel.streams[0].url);assert.equal(ids.get('quality').options.length,3);
  assert.equal(ids.get('language-label').hidden,true);assert.equal(ids.get('tv-signal-label').hidden,false);
  ids.get('quality').value='1';ids.get('quality').listeners.change();assert.equal(players[0].currentLevel,1);
  const liveVideo=ids.get('player').children[0];ctx.MobileAppSuspend();assert.notEqual(players[0].destroyed,true);assert.equal(ids.get('player').children[0],liveVideo);ctx.MobileAppResume();assert.equal(ids.get('player').children[0],liveVideo);
  vm.runInContext("chooseKind('movie')",ctx);await new Promise(setImmediate);
  await vm.runInContext("open({id:'550',name:'Fight Club'})",ctx);
  assert.deepEqual(ids.get('quality').options.map(o=>String(o.value)),['auto','720','1080','2160']);
  assert.equal(ids.get('quality').options[3].disabled,true);assert.equal(ids.get('tv-signal-label').hidden,true);
  ctx.CineDataSaver.set(true);await vm.runInContext("open({id:'550',name:'Fight Club'})",ctx);assert.equal(ids.get('player').children.length,0);assert.match(ids.get('play-status').textContent,/Ahorro de datos/);
  ids.get('play').listeners.click();assert.equal(ids.get('player').children[0].tag,'iframe');
  ctx.CineDataSaver.set(false);await vm.runInContext("open({id:'550',name:'Fight Club'})",ctx);assert.equal(ids.get('player').children[0].tag,'iframe');
  assert.equal(ctx.MobileAppBack(),true);assert.equal(ids.get('watch').hidden,true);assert.equal(ids.get('manual-tools').hidden,false);
});



test('móvil V0.30: filtros compactos, temporadas cerradas y reproducción documental directa',async()=>{
 const {ids,document}=dom(await read('mobile/index.html')),requests=[];
 const episodes=[{season:1,episode:1,name:'Uno'},{season:1,episode:2,name:'Dos'},{season:2,episode:1,name:'Otro primero'},{season:2,episode:2,name:'Futuro',upcoming:true},{season:0,episode:1,name:'Especial'}];
 const archived={id:'archive:FilmOpen',kind:'archive',playbackType:'file',name:'Archivo abierto',language:'English',episodes:[],streams:[{url:'https://archive.org/download/FilmOpen/a.mp4'},{url:'https://archive.org/download/FilmOpen/b.mp4'}]};
 const ctx={installMobilePlayback:()=>({setContext(){},detach(){},attach(){},decorate:value=>value}),document,URL,URLSearchParams,Intl,Date,setTimeout,clearTimeout,location:{origin:'https://test.invalid'},platformNames,createLibrary:testLibrary,libraryItem,createGlobalSearch,searchSections,createDramaTests:testDramaTests,dramaStatuses,canChooseQuality,createPosterLoader:()=>({attach(){},reset(){}}),createLivePlayer:args=>createLivePlayer({...args,document}),scrollTo(){},api:async path=>{
  requests.push(path);
  if(path.startsWith('/api/documentaries/detail'))return archived;
  if(path.startsWith('/api/documentaries/catalog'))return {items:[{...archived,genres:['Documentary']}],nextSkip:1,hasMore:false,warnings:[]};
  if(path.startsWith('/api/series/detail'))return {id:'tt0903747',name:'Serie',tmdbId:'1396',episodes};
  return result(path);
 }};
 ctx.window=ctx;vm.createContext(ctx);for(const f of ['public/source-config.js','public/genre-shelves.js'])vm.runInContext(await read(f),ctx);
 ctx.candidates=(s,e,l,q)=>candidates(s,e,l,q,ctx.CineSources);vm.runInContext((await read('mobile/app.mjs')).replace(/^import .*;\r?\n/gm,''),ctx);await new Promise(setImmediate);
 assert.equal(ids.has('season'),false);assert.equal(ids.has('episode'),false);assert.equal(ids.has('next'),false);
 assert.equal(ids.get('search-form').hidden,true);ids.get('search-tool').listeners.click();assert.equal(ids.get('search-form').hidden,false);
 ids.get('year-tool').listeners.click();assert.equal(ids.get('search-form').hidden,true);assert.equal(ids.get('year-label').hidden,false);
 assert.equal(ctx.MobileAppBack(),true);assert.equal(ids.get('year-label').hidden,true);
 ids.get('year').value='2020';ids.get('year').listeners.change();await new Promise(setImmediate);assert.equal(ids.get('year-tool').dataset.active,'true');assert.ok(requests.some(p=>p.includes('year=2020')));
 vm.runInContext("chooseKind('series')",ctx);await new Promise(setImmediate);await vm.runInContext("open({id:'tt0903747',name:'Serie'})",ctx);
 const groups=ids.get('episodes').children;assert.equal(groups.length,3);assert.equal(groups[0].children[0].textContent,'Especiales · 1 capítulos');assert.ok(groups.every(g=>!g.open));
 const season2=groups[2];assert.equal(season2.children[1].children[1].disabled,true);season2.open=true;season2.children[1].children[0].listeners.click();
 assert.equal(vm.runInContext('chosen().season',ctx),2);assert.equal(vm.runInContext('chosen().episode',ctx),1);assert.equal(season2.open,true);assert.match(ids.get('current-episode').textContent,/T2 · E1/);
 const currentButtons=groups.flatMap(g=>g.children[1].children).filter(b=>b.getAttribute('aria-current')==='true');assert.equal(currentButtons.length,1);assert.equal(currentButtons[0].dataset.season,2);
 vm.runInContext("chooseKind('documentary')",ctx);await new Promise(setImmediate);assert.equal(ids.get('heading').textContent,'Documentales');assert.equal(ids.get('source').options.length,5);
 assert.ok(requests.some(p=>p.startsWith('/api/documentaries/catalog')));assert.equal(requests.some(p=>p.includes('/api/releases?kind=documentary')),false);
 await vm.runInContext("open({id:'archive:FilmOpen',kind:'archive',name:'Archivo abierto'})",ctx);
 const video=ids.get('player').children[0];assert.equal(video.tag,'video');assert.equal(video.src,archived.streams[0].url);assert.equal(ids.get('language-label').hidden,true);assert.equal(ids.get('watch-type').textContent,'DOCUMENTAL');
 ids.get('alternative').listeners.click();assert.equal(video.paused,true);assert.equal(ids.get('player').children[0].src,archived.streams[1].url);
 const second=ids.get('player').children[0];second.currentTime=42;ctx.MobileAppSuspend();ctx.MobileAppSuspend();assert.equal(second.paused,true);assert.equal(ids.get('player').children[0],second);ctx.MobileAppResume();assert.equal(ids.get('player').children[0],second);assert.equal(second.currentTime,42);
});

test('móvil V0.40: Mi lista persiste, retoma el capítulo y el minuto solo en archivos; búsqueda global conserva contexto',async()=>{
 const disk=new Map(),storage={getItem:k=>disk.get(k),setItem:(k,v)=>disk.set(k,v)};
 let delayOld=false,finishOld;
 const episodeList=[{season:1,episode:1,name:'Uno'},{season:2,episode:1,name:'Dos'}];
 const file={id:'archive:FilmOpen',kind:'archive',section:'documentary',playbackType:'file',name:'Archive film',language:'English',episodes:[],streams:[{url:'https://archive.org/download/FilmOpen/film.mp4'}]};
 async function setup(){
  const {ids,document}=dom(await read('mobile/index.html'));
  const ctx={installMobilePlayback:()=>({setContext(){},detach(){},attach(){},decorate:value=>value}),document,URL,URLSearchParams,Intl,Date,setTimeout,clearTimeout,location:{origin:'https://test.invalid'},platformNames,createLibrary:()=>createLibrary({storage}),libraryItem,createGlobalSearch,searchSections,createDramaTests:testDramaTests,dramaStatuses,canChooseQuality,createPosterLoader:()=>({attach(){},reset(){}}),createLivePlayer:args=>createLivePlayer({...args,document}),scrollTo(){},api:async path=>{
   if(delayOld&&path.startsWith('/api/catalog')&&path.includes('q=Old'))return new Promise(resolve=>{finishOld=resolve;});
   if(path.startsWith('/api/series/detail'))return {id:show.id,name:show.name,tmdbId:'1396',episodes:episodeList};
   if(path.startsWith('/api/documentaries/detail'))return file;
   if(path.startsWith('/api/tv/catalog'))throw Error('TV no disponible');
   if(path.startsWith('/api/documentaries/catalog'))return {items:[file],nextSkip:1,hasMore:false};
   if(path.startsWith('/api/kids/catalog'))return {sections:[]};
   if(path.startsWith('/api/anime/catalog'))return {series:[]};
   return result(path);
  }};
  ctx.window=ctx;vm.createContext(ctx);for(const f of ['public/source-config.js','public/genre-shelves.js'])vm.runInContext(await read(f),ctx);
  ctx.candidates=(s,e,l,q)=>candidates(s,e,l,q,ctx.CineSources);vm.runInContext((await read('mobile/app.mjs')).replace(/^import .*;\r?\n/gm,''),ctx);await new Promise(setImmediate);return {ctx,ids};
 }
 const a=await setup();assert.equal(a.ids.get('continue-shelf').hidden,true);
 await vm.runInContext("open({id:'tt0903747',name:'Breaking Bad',kind:'series',section:'series'})",a.ctx);
 a.ids.get('save-list').listeners.click();assert.equal(a.ids.get('save-list').getAttribute('aria-pressed'),'true');
 vm.runInContext('episodeButtons[1]',a.ctx).listeners.click();assert.equal(vm.runInContext('chosen().season',a.ctx),2);
 a.ctx.MobileAppBack();assert.equal(a.ids.get('continue-shelf').hidden,true);vm.runInContext("chooseKind('series')",a.ctx);await new Promise(setImmediate);assert.equal(a.ids.get('continue-shelf').hidden,false);
 a.ids.get('open-list').listeners.click();assert.equal(a.ids.get('library-view').hidden,false);assert.equal(a.ids.get('library-grid').children.length,1);
 firstCard(a.ids.get('library-grid')).listeners.click();await new Promise(setImmediate);assert.equal(vm.runInContext('chosen().season',a.ctx),2);a.ctx.MobileAppBack();assert.equal(a.ids.get('library-view').hidden,false);
 const b=await setup();b.ids.get('open-history').listeners.click();firstCard(b.ids.get('library-grid')).listeners.click();await new Promise(setImmediate);assert.equal(vm.runInContext('chosen().season',b.ctx),2);assert.equal(vm.runInContext('library.favorites().length',b.ctx),1);
 b.ctx.MobileAppBack();b.ids.get('library-grid').children[0].children[1].listeners.click();assert.equal(vm.runInContext('library.history().length',b.ctx),0);assert.equal(vm.runInContext('library.favorites().length',b.ctx),1);
 await vm.runInContext("open({id:'archive:FilmOpen',name:'Archive film',kind:'archive',section:'documentary'})",b.ctx);
 let video=b.ids.get('player').children[0];video.currentTime=95;video.duration=600;video.listeners.timeupdate();video.currentTime=97;b.ctx.MobileAppBack();
 const oldVideo=video;
 await vm.runInContext("open({id:'archive:FilmOpen',name:'Archive film',kind:'archive',section:'documentary'})",b.ctx);video=b.ids.get('player').children[0];video.duration=600;video.listeners.loadedmetadata();assert.equal(video.currentTime,97);
 oldVideo.currentTime=0;oldVideo.listeners.pause();assert.equal(vm.runInContext("library.find({id:'archive:FilmOpen',kind:'archive'}).position",b.ctx),97);
 video.currentTime=600;video.ended=true;video.listeners.ended();video.ended=false;video.listeners.pause();assert.equal(vm.runInContext("library.history().filter(r=>r.item.kind==='archive').length",b.ctx),0);b.ctx.MobileAppBack();
 b.ids.get('open-global').listeners.click();b.ids.get('global-query').value='Breaking Bad';await vm.runInContext('searchEverywhere()',b.ctx);
 assert.equal(vm.runInContext("searchGroups.get('tv').status",b.ctx),'error');assert.equal(vm.runInContext("searchGroups.get('series').items[0].section",b.ctx),'series');
 const seriesShelf=b.ids.get('global-results').children[1];firstCard(seriesShelf).listeners.click();await new Promise(setImmediate);assert.equal(vm.runInContext('watchSection',b.ctx),'series');assert.equal(b.ids.get('watch').hidden,false);b.ctx.MobileAppBack();assert.equal(b.ids.get('global-view').hidden,false);
 delayOld=true;b.ids.get('global-query').value='Old';const oldSearch=vm.runInContext('searchEverywhere()',b.ctx);await new Promise(setImmediate);
 b.ids.get('global-query').value='New';await vm.runInContext('searchEverywhere()',b.ctx);
 finishOld({movies:[{id:'123',name:'Old title'}],nextSkip:48,hasMore:false});await oldSearch;
 assert.equal(vm.runInContext("searchGroups.get('movie').q",b.ctx),'New');assert.equal(vm.runInContext("searchGroups.get('movie').items.some(i=>i.name==='Old title')",b.ctx),false);

});

test('móvil V0.61: K-dramas inicia por defecto, ReelShort retirado y estados manuales conservados',async()=>{
 const {ids,document}=dom(await read('mobile/index.html'));const id='tt1234567';
 const fixture={id,kind:'series',name:'Drama asiático',announcedEpisodes:2,restricted:true,episodes:[{season:1,episode:1,name:'Uno'},{season:1,episode:2,name:'Dos',locked:true}]};
 const ctx={installMobilePlayback:()=>({setContext(){},detach(){},attach(){},decorate:value=>value}),document,URL,URLSearchParams,Intl,Date,setTimeout,clearTimeout,location:{origin:'https://test.invalid'},platformNames,createLibrary:testLibrary,libraryItem,createGlobalSearch,searchSections,createDramaTests:testDramaTests,dramaStatuses,canChooseQuality,createPosterLoader:()=>({attach(){},reset(){}}),createLivePlayer:args=>createLivePlayer({...args,document}),scrollTo(){},api:async path=>path.startsWith('/api/series/detail')?fixture:path.startsWith('/api/dramas/catalog')?{items:[{...fixture,section:'drama',genres:['K-dramas']}],hasMore:false,nextSkip:1}:result(path)};
 ctx.window=ctx;vm.createContext(ctx);for(const f of ['public/source-config.js','public/genre-shelves.js'])vm.runInContext(await read(f),ctx);ctx.candidates=(s,e,l,q)=>candidates(s,e,l,q,ctx.CineSources);vm.runInContext((await read('mobile/app.mjs')).replace(/^import .*;\r?\n/gm,''),ctx);await new Promise(setImmediate);
 vm.runInContext("library.remember({id:'550',kind:'movie',section:'movie',name:'Movie'});library.remember({id:'tt0903747',kind:'series',section:'series',name:'Series'});library.remember({id:'mal:223',kind:'anime',section:'anime',name:'Anime'});renderContinue()",ctx);
 assert.equal(ids.get('continue-shelf').children[0].children[1].children.length,1);assert.equal(firstCard(ids.get('continue-shelf')).attributes['aria-label'],'Ver Movie');
 vm.runInContext("chooseKind('anime')",ctx);await new Promise(setImmediate);assert.equal(firstCard(ids.get('continue-shelf')).attributes['aria-label'],'Ver Anime');
 const html=await read('mobile/index.html');assert.equal((html.match(/class="menu-divider"/g)||[]).length,2);assert.match(html,/>Créditos<\/a><p class="menu-account">Cuenta Plus<\/p>/);
 vm.runInContext("chooseKind('drama')",ctx);await new Promise(setImmediate);assert.equal(ids.get('drama-note').hidden,false);assert.ok(firstCard(ids.get('grid')).children.some(e=>/Sin validar/.test(e.textContent)));
 assert.equal(ids.get('source').value,'kdrama');
 vm.runInContext("library.remember({id:'reelshort:6854d0b51cc7f0fc460aa389',kind:'drama',section:'drama',name:'Retirado'});library.remember({id:'tt34852924',kind:'series',section:'drama',name:'Chino retirado',genres:['Dramas chinos']});renderContinue()",ctx);assert.equal(ids.get('continue-shelf').hidden,true);
 await vm.runInContext(`open({id:'${id}',kind:'series',section:'drama',name:'Drama asiático'})`,ctx);assert.match(ids.get('player').children[0].src,/tt1234567/);assert.equal(ids.get('language-label').hidden,false);assert.equal(ids.get('drama-validation').hidden,false);assert.equal(vm.runInContext('episodeButtons[1].disabled',ctx),true);
 ids.get('drama-result').value='complete';ids.get('drama-count').value='2';ids.get('drama-finished').checked=true;ids.get('drama-test-form').requestSubmit();assert.match(ids.get('drama-test-status').textContent,/no está completa|bloqueados/);
 ids.get('drama-result').value='partial';ids.get('drama-count').value='1';ids.get('drama-test-form').requestSubmit();assert.match(ids.get('drama-test-status').textContent,/Inconcluso/);ctx.MobileAppBack();assert.ok(firstCard(ids.get('grid')).children.some(e=>/Inconcluso/.test(e.textContent)));
 assert.equal(ids.get('player').children.length,0);assert.equal(ids.get('format-tool-caption').textContent,'Estado');
 assert.ok(ids.get('source').options.some(o=>o.value==='kdrama'));assert.ok(!ids.get('source').options.some(o=>['ai','reelshort'].includes(o.value)));
 ids.get('format').value='complete';ids.get('format').dispatchEvent({type:'change'});assert.equal(firstCard(ids.get('grid')),null);
 ids.get('format').value='partial';ids.get('format').dispatchEvent({type:'change'});assert.ok(firstCard(ids.get('grid')));
 ctx.location.origin='http://127.0.0.1:4173';await vm.runInContext(`open({id:'${id}',kind:'series',section:'drama',name:'Drama asiático'})`,ctx);assert.equal(ids.get('player').children.length,0);assert.match(ids.get('play-status').textContent,/identificador compatible/);
 fixture.tmdbId='123';await vm.runInContext(`open({id:'${id}',kind:'series',section:'drama',name:'Drama asiático'})`,ctx);assert.match(ids.get('player').children[0].src,/^https:\/\/cinesrc\.st\//);
});


test('web: historial reabre capítulo exacto con política del proveedor y rechaza episodios ausentes',async()=>{
 const {ids,ctx}=await desktop('series'),tracked=[];
 ctx.CLBWeb={stop(){},setItem(){},decorate:url=>url,track:(frame,provider,item,episode)=>tracked.push({frame,provider,item,episode})};
 ctx.fetch=async()=>({ok:true,json:async()=>({id:show.id,name:show.name,kind:'series',tmdbId:'1396',playbackType:'series',episodes:[{season:2,episode:8,name:'Better Call Saul'},{season:2,episode:9,name:'4 Days Out'},{season:2,episode:10,name:'Future',upcoming:true}]})});
 await vm.runInContext("openShow({id:'tt0903747',name:'Breaking Bad'},{season:2,episode:8})",ctx);
 assert.equal(ids.get('series-catalog').hidden,true);assert.equal(ids.get('season').value,2);assert.equal(ids.get('episode').value,8);
 assert.match(ids.get('series-player').children[0].src,/\/e\/serie\/1396\/2\/8/);assert.equal(ids.get('series-player').children[0].attributes.sandbox,undefined);assert.match(ids.get('playback-protection').textContent,/Sin protección sandbox/);
 assert.equal(tracked[0].item.section,'series');assert.equal(tracked[0].episode.episode,8);
 ids.get('series-close').listeners.click();assert.equal(ids.get('series-catalog').hidden,false);
 await vm.runInContext("openShow({id:'tt0903747',name:'Breaking Bad'},{season:8,episode:99})",ctx);
 assert.equal(ids.get('series-player').querySelectorAll('iframe').length,0);assert.equal(ids.get('episode-play').disabled,true);assert.match(ids.get('episode-status').textContent,/no está disponible/);
});

test('web: botón latino recupera FacilitoPlay conservando película y sin alterar protección de CineSrc',async()=>{
 const {ids,ctx}=await desktop('movie');ids.get('movie-id').value='550';ids.get('movie-name').value='Fight Club';await ids.get('player-form').requestSubmit();
 assert.equal(ids.get('provider').value,'facilito');assert.equal(ids.get('player').children[0].attributes.sandbox,undefined);
 ids.get('retry-provider').listeners.click();await new Promise(setImmediate);assert.equal(ids.get('provider').value,'cinesrc');assert.equal(ids.get('player').children[0].attributes.sandbox,'allow-scripts allow-same-origin allow-presentation');
 ids.get('latino-player').listeners.click();await new Promise(setImmediate);assert.equal(ids.get('provider').value,'facilito');assert.match(ids.get('player').children[0].src,/facilitoplay/);assert.equal(ids.get('movie-id').value,'550');assert.equal(ids.get('audio-preference').value,'latino');assert.equal(ids.get('block-popups').checked,true);assert.match(ids.get('playback-protection').textContent,/Sin protección sandbox/);
});

test('web: rotación y selectores solo ofrecen las cuatro fuentes reportadas funcionales',async()=>{
 const {ids}=await desktop('movie');assert.deepEqual(ids.get('provider').options.map(o=>o.value).sort(),['cinesrc','facilito','sh','to']);ids.get('movie-id').value='550';ids.get('movie-name').value='Fight Club';await ids.get('player-form').requestSubmit();
 const seen=new Set();for(let i=0;i<8;i++){const id=ids.get('provider').value;seen.add(id);assert.ok(['facilito','cinesrc','sh','to'].includes(id));assert.equal(ids.get('player').children[0].attributes.sandbox,id==='cinesrc'?'allow-scripts allow-same-origin allow-presentation':undefined);ids.get('retry-provider').listeners.click();await new Promise(setImmediate);}
 assert.equal(seen.size,4);
 const series=await desktop('series');assert.deepEqual(series.ids.get('series-provider').options.map(o=>o.value).sort(),['cinesrc','facilito','sh','to']);
});


test('web: temporadas desplegables conservan selección exacta, capítulos bloqueados y siguiente',async()=>{
 const {ids,ctx}=await desktop('series');
 ctx.fetch=async()=>({ok:true,json:async()=>({id:show.id,name:show.name,kind:'series',tmdbId:'1396',episodes:[
 {season:1,episode:1,name:'Primero'},{season:1,episode:2,name:'Bloqueado',locked:true},
 {season:2,episode:1,name:'Nueva temporada',sourceSeason:3,sourceEpisode:7},{season:2,episode:2,name:'Futuro',upcoming:true}]})});
 await vm.runInContext("openShow({id:'tt0903747',name:'Breaking Bad'})",ctx);
 const groups=ids.get('episode-grid').children;
 assert.equal(groups.length,2);assert.equal(groups[0].open,true);assert.equal(groups[1].open,false);
 let buttons=ids.get('episode-grid').querySelectorAll('button');
 assert.equal(buttons[0].attributes['aria-current'],'true');assert.equal(buttons[2].attributes['aria-current'],'false');assert.equal(buttons[1].disabled,true);assert.equal(buttons[3].disabled,true);
 assert.equal(ids.get('series-player').querySelectorAll('iframe').length,0);
 ids.get('episode-next').listeners.click();
 assert.equal(Number(ids.get('season').value),2);assert.equal(Number(ids.get('episode').value),1);
 assert.equal(groups[1].open,true);assert.equal(buttons[0].attributes['aria-current'],'false');assert.equal(buttons[2].attributes['aria-current'],'true');
 assert.match(ids.get('series-player').children[0].src,/\/3\/7/);assert.equal(ids.get('episode-next').disabled,true);
 buttons[0].listeners.click();assert.equal(Number(ids.get('season').value),1);assert.match(ids.get('series-player').children[0].src,/\/1\/1/);
 ids.get('series-close').listeners.click();await vm.runInContext("openShow({id:'tt0903747',name:'Breaking Bad'},{season:1,episode:2})",ctx);
 assert.equal(ids.get('episode-play').disabled,true);assert.equal(ids.get('series-player').querySelectorAll('iframe').length,0);
});


test('web Anime: fuente inicial activa y cambio de idioma conserva identificadores compatibles',async()=>{
 const {ids,ctx}=await desktop('anime');assert.equal(ids.get('series-provider').value,'sh');assert.doesNotMatch(ids.get('playback-hint').textContent,/VidLink|VidFast/);
 ctx.fetch=async()=>({ok:true,json:async()=>({id:'mal:999990',kind:'anime',name:'Solo IMDb',imdbId:'tt1234567',tmdbId:null,episodes:[{season:1,episode:1,name:'Uno'}]})});
 await vm.runInContext("openShow({id:'mal:999990',name:'Solo IMDb'})",ctx);
 ids.get('series-language').value='latino';ids.get('series-language').listeners.change();assert.equal(ids.get('series-provider').value,'sh');assert.equal(ids.get('series-provider').options.find(o=>o.value==='facilito').disabled,true);
 vm.runInContext('play()',ctx);assert.match(ids.get('series-player').children[0].src,/vidsrc\.sh/);
 ctx.fetch=async()=>({ok:true,json:async()=>({id:'mal:999991',kind:'anime',name:'Sin correspondencia',imdbId:null,tmdbId:null,episodes:[{season:1,episode:1,name:'Uno'}]})});
 await vm.runInContext("openShow({id:'mal:999991',name:'Sin correspondencia'})",ctx);assert.equal(ids.get('episode-play').disabled,true);assert.match(ids.get('series-player-status').textContent,/correspondencia/);assert.equal(ids.get('series-player').querySelectorAll('iframe').length,0);
});

test('WEB: movie and series cards route to detail without starting an iframe',async()=>{
 for(const page of ['movie','series']){const {ids,ctx}=await desktop(page);const opened=[];ctx.CLBDetails={open:item=>{opened.push(item);return true;}};firstCard(ids.get(page==='movie'?'movie-grid':'series-grid')).listeners.click();await new Promise(setImmediate);assert.equal(opened.length,1);assert.equal(opened[0].kind,page==='movie'?'movie':'series');assert.equal(ids.get(page==='movie'?'player':'series-player').children.filter(e=>e.tag==='iframe').length,0);}
});
import {installMobilePlayback} from '../mobile/mobile-playback.mjs';
import{detailItem,detailURL,sourceContext}from'../public/ficha-core.mjs';import{within1080}from'../public/audio-1080-core.mjs';
async function detailScreen(requested={}){
 const {ids,document}=dom(await read('public/ficha.html')),requests=[];const item={id:'27205',kind:'movie',section:'movie',name:'Inception',...requested.item};const p=new URLSearchParams({clb:JSON.stringify(item),...requested.episode});const data=path=>{if(path.startsWith('/api/ficha/title'))return {name:item.name,description:'Sinopsis de prueba',tmdbId:item.id,episodes:requested.episodes||[]};if(path.startsWith('/api/ficha/availability'))return {state:'listed',message:'Listado por proveedor'};return {error:'Sin archivos'};};const ctx={document,URL,URLSearchParams,AbortController,AbortSignal,Date,Intl,setTimeout,clearTimeout,location:{href:'http://127.0.0.1:4173/ficha?'+p},localStorage:{getItem:()=>null,setItem(){}},createLibrary:()=>testLibrary(),installMobilePlayback,structuredClone,detailItem,detailURL,sourceContext,within1080,fetch:async path=>{requests.push(path);return {ok:!path.startsWith('/api/catalognet/'),status:path.startsWith('/api/catalognet/')?404:200,json:async()=>data(path)};},addEventListener(){}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(await read('public/source-config.js'),ctx);const script=(await read('public/ficha.mjs')).replace(/^import .*;\r?\n/gm,'');vm.runInContext(script,ctx);await new Promise(setImmediate);return{ids,requests,ctx};
}
test('WEB: missing CATALOGNET files do not hide original providers and detail never autoplays',async()=>{const{ids,requests}=await detailScreen();assert.equal(ids.get('detail-summary').textContent,'Sinopsis de prueba');assert.equal(ids.get('detail-providers').children.length,3);assert.ok(ids.get('detail-providers').children.every(e=>!e.disabled));assert.match(ids.get('files-status').textContent,/no informa archivos/);assert.equal(ids.get('detail-embed').children.length,0);assert.ok(requests.some(p=>p.includes('provider=sh')));});
test('WEB: series sources use the explicitly requested episode, never a substitute',async()=>{const{requests}=await detailScreen({item:{kind:'series',section:'series'},episode:{season:'1',episode:'2'},episodes:[{season:1,episode:1,name:'First'},{season:1,episode:2,name:'Second'}]});const availability=requests.filter(p=>p.includes('/availability?'));assert.equal(availability.length,3);assert.ok(availability.every(p=>new URL(p,'http://local').searchParams.get('episode')==='2'));});

test('WEB: CineSrc selection uses an actual provider URL and remembers the title without autoplay on detail load',async()=>{const {ids}=await detailScreen();ids.get('detail-providers').children[1].onclick();const frame=ids.get('detail-embed').children[0];assert.match(frame.src,/^https:\/\/cinesrc\.st\/embed\/movie\/27205/);assert.equal(ids.get('embed-section').hidden,false);});
import{supportedDimensions,wasmResource,spanishTrack,playbackFailure}from'../public/audio-1080-core.mjs';
test('WEB: AVPlayer resumes the exact saved file in milliseconds and persists seconds/completion',async()=>{
 const {ids,document}=dom(await read('public/audio-1080.html'));const library=testLibrary(),item={id:'27205',kind:'movie',section:'movie',name:'Inception'};library.remember(item,{provider:'catalognet',streamIndex:0,episode:null});library.progress(item,{position:10,duration:120,provider:'catalognet',streamIndex:0,episode:null,evidence:'file'});let engine;
 class MockPlayer{constructor(){engine=this;this.currentTime=0n;this.events={};}on(name,fn){(this.events[name]||=[]).push(fn);}emit(name){for(const fn of this.events[name]||[])fn();}async load(source,options){this.loadOptions=options;}getStreams(){return[{id:0,codecparProxy:{codecType:0,width:1920,height:1080}}];}getDuration(){return 120000n;}async play(){this.emit('played');}async seek(value){this.currentTime=value;}async destroy(){} }
 MockPlayer.audioContext={resume:async()=>{}};const query=new URLSearchParams({from:'ficha',id:'27205',kind:'movie',index:'0',clb:JSON.stringify(item)});const ctx={document,URL,URLSearchParams,AbortController,AbortSignal,DOMException,Date,BigInt,Intl,setTimeout,clearTimeout,isSecureContext:true,AudioWorkletNode:function(){},AVPlayer:MockPlayer,location:{href:'http://127.0.0.1:4173/reproductor?'+query},preparePlayerLanguage(){},localizePlayer(){},installWebPlayerControls(){},createLibrary:()=>library,detailItem,detailURL,within1080,supportedDimensions,wasmResource,spanishTrack,playbackFailure,addEventListener(){},fetch:async path=>({ok:true,json:async()=>path.includes('/links?')?{sources:[{index:0,quality:'1080p'}]}:{url:'https://s123.yandex.net/sample.mkv'}})};ctx.window=ctx;vm.createContext(ctx);vm.runInContext((await read('public/audio-1080.mjs')).replace(/^import .*;\r?\n/gm,''),ctx);await new Promise(setImmediate);assert.equal(engine.loadOptions?.http?.referrerPolicy,'no-referrer');assert.equal(engine.currentTime,10000n);engine.currentTime=25000n;engine.emit('paused');assert.equal(library.find(item).position,25);engine.currentTime=120000n;engine.emit('ended');await new Promise(setImmediate);assert.equal(library.find(item).completed,true);assert.equal(library.history().length,0);
});
