import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogEligible,catalog} from '../catalog-api.mjs';
import {animeApi} from '../anime-api.mjs';
import {seriesApi} from '../series-api.mjs';

const now=Date.parse('2026-10-23T18:00:00Z');
async function invoke(handler,url,metadata){let status=200,body;await handler({url},{setHeader(){},writeHead(s){status=s;},end(raw){body=JSON.parse(raw);}},metadata);return {status,body};}
test('catálogos: rechaza fechas/años futuros y anuncios; no confunde cancelación posterior ni datos desconocidos con falta de vídeo',()=>{
 for(const item of [{released:'2026-12-01'},{year:2027},{releaseInfo:'2027–'},{status:'NOT_YET_RELEASED'},{startDate:{year:2026,month:12,day:1}},{status:'CANCELLED'}])assert.equal(catalogEligible(item,now),false,JSON.stringify(item));
 for(const item of [{year:1999},{released:'2026-10-01'},{status:'CANCELLED',released:'2015-01-01'},{}])assert.equal(catalogEligible(item,now),true);
});
test('películas: popular y búsqueda excluyen títulos futuros conservando cursor de la fuente',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({metas:[{id:'tt9999901',name:'Ya estrenada',releaseInfo:'2000',released:'2000-01-01'},{id:'tt9999902',name:'Anunciada',releaseInfo:'2999',released:'2999-01-01'}]}));
 try{for(const query of ['kind=popular&year=all&skip=9870','kind=search&year=all&skip=9871&q=eligibility-regression']){const r=await invoke(catalog,'/api/catalog?'+query);assert.equal(r.status,200);assert.deepEqual(r.body.movies.map(m=>m.name),['Ya estrenada']);assert.equal(r.body.hasMore,true);assert.equal(r.body.nextSkip,Number(new URLSearchParams(query).get('skip'))+2);}}finally{globalThis.fetch=original;}
});
test('series: filtros se aplican también al catálogo general sin adelantar ni cortar paginación',async()=>{
 const metadata=async()=>({metas:[{id:'tt9999911',type:'series',name:'Publicado',releaseInfo:'2001'},{id:'tt9999912',type:'series',name:'Futuro',releaseInfo:'2999'}]});
 const r=await invoke(seriesApi,'/api/series/catalog?platform=internet&skip=9700',metadata);assert.equal(r.status,200);assert.deepEqual(r.body.series.map(s=>s.name),['Publicado']);assert.equal(r.body.nextSkip,9702);assert.equal(r.body.hasMore,true);
});
test('Anime: AniList y Kitsu filtran futuros sin desplazar correspondencias o cursor',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async url=>new Response(JSON.stringify(String(url).includes('graphql')?{data:{Page:{pageInfo:{hasNextPage:true},media:[{id:9999921,idMal:9999921,title:{romaji:'Publicado'},startDate:{year:2000}},{id:9999922,title:{romaji:'Futuro'},startDate:{year:2999}}]}}}:{metas:[{id:'kitsu:9999921',name:'Publicado',releaseInfo:'2000'},{id:'kitsu:9999922',name:'Futuro',releaseInfo:'2999'}]}));
 try{for(const source of ['anilist','kitsu']){const r=await invoke(animeApi,`/api/anime/catalog?source=${source}&skip=9600&q=eligibility-filter-${source}`);assert.equal(r.status,200);assert.deepEqual(r.body.series.map(s=>s.name),['Publicado']);assert.equal(r.body.nextSkip,source==='anilist'?9624:9602);assert.equal(r.body.hasMore,true);}}finally{globalThis.fetch=original;}
});
