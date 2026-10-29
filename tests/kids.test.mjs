import test from 'node:test';
import assert from 'node:assert/strict';
import {createKidsApi,kidsEligible,childrenSeries} from '../kids-api.mjs';
const film={id:'tt0000001',name:'Historia familiar',genres:['Animation','Family','Adventure'],releaseInfo:'2020',poster:'https://image.tmdb.org/test.jpg',moviedb_id:123};
const toon={id:'kitsu:486',name:'Anime Kids',genres:['Kids','Adventure'],year:1997,posterUrl:''};
const handler=data=>async(req,res)=>{res.writeHead(200);res.end(JSON.stringify(typeof data==='function'?data(req):data));};
const metadata=async path=>path.startsWith('meta/series/')?{meta:{id:path.split('/').at(-1).replace('.json',''),name:'Bluey',genres:['Animation','Comedy'],year:'2018'}}:path.startsWith('meta/movie/')?{meta:{...film,genres:['Animation','Comedy'],description:'Descripción'}}:{metas:[film,{id:'tt0000002',name:'Animación adulta',genres:['Animation','Comedy']},{...film,id:'tt0000003',genres:['Family','Horror']}]};
const deps={metadata,anime:handler({series:[toon,{...toon,id:'kitsu:999',genres:['Animation','Ecchi']}],nextSkip:20,hasMore:true}),series:handler({id:childrenSeries[0],name:'Bluey',episodes:[{season:1,episode:1}],tmdbId:'82728'}),tv:handler({channels:[{id:'Kids.mx',name:'Canal Kids',country:'MX',categories:['kids']}],nextSkip:60,hasMore:true,total:226})};
async function call(api,path){let status,body;await api({url:path},{writeHead(s){status=s;},end(v){body=JSON.parse(v);}});return{status,body};}
test('Kids: animación sola y Family de adultos no equivalen a infantil',()=>{
  assert.equal(kidsEligible({genres:['Animation']},'movie'),false);
  assert.equal(kidsEligible({id:'tt0118375',genres:['Animation','Family']},'series'),false);
  assert.equal(kidsEligible({id:childrenSeries[0],genres:['Animation','Comedy']},'series'),true);
  for(const genres of [['Family','Horror'],['Kids','Ecchi'],['Kids','Gore']])assert.equal(kidsEligible({genres},genres.includes('Kids')?'anime':'movie'),false);
  assert.equal(kidsEligible({...film,released:'2999-01-01'},'movie'),false);assert.equal(kidsEligible({...toon,year:2999},'anime'),false);
  assert.equal(kidsEligible(null,'movie'),false);
});
test('Kids: reúne cuatro secciones y conserva cursores del origen aunque descarte títulos',async()=>{
  const api=createKidsApi(deps),r=await call(api,'/api/kids/catalog');assert.equal(r.status,200);assert.equal(r.body.sections.length,4);
  const movie=r.body.sections.find(s=>s.kind==='movie');assert.equal(movie.items.length,1);assert.equal(movie.nextSkip,3);assert.equal(movie.hasMore,true);
  const anime=r.body.sections.find(s=>s.kind==='anime');assert.equal(anime.items.length,1);assert.equal(anime.nextSkip,20);
  const series=r.body.sections.find(s=>s.kind==='series');assert.equal(series.items.length,12);assert.equal(series.nextSkip,12);assert.equal(series.hasMore,true);
});
test('Kids: detalle de película conserva clasificación Family observada si el detalle recorta géneros',async()=>{
  const api=createKidsApi(deps);
  assert.equal((await call(api,'/api/kids/detail?kind=movie&id='+film.id)).status,422);
  await call(api,'/api/kids/catalog?kind=movie');
  const detail=await call(api,'/api/kids/detail?kind=movie&id='+film.id);assert.equal(detail.status,200);assert.equal(detail.body.tmdbId,'123');assert.equal(detail.body.playbackType,'movie');
});
test('Kids: búsqueda de series recorre la selección completa, y filtros no inventan edades',async()=>{
  const paths=[],api=createKidsApi({...deps,metadata:async path=>{paths.push(path);return metadata(path);}});
  const r=await call(api,'/api/kids/catalog?kind=series&q=Bluey');assert.equal(r.status,200);assert.equal(paths.length,childrenSeries.length);assert.equal(r.body.sections[0].hasMore,false);
  const filtered=await call(api,'/api/kids/catalog?theme=animation&year=2020');assert.ok(filtered.body.sections.every(s=>s.kind!=='tv'));
  assert.equal(filtered.body.sections.find(s=>s.kind==='movie').items.length,1);
});
test('Kids: anime valida identidad y etiqueta Kids antes de abrir episodios',async()=>{
  let animeCalls=0;
  const api=createKidsApi({...deps,fetcher:async()=>new Response(JSON.stringify({meta:{id:'kitsu:486',genres:['Animation','Comedy']}})),anime:async(...args)=>{animeCalls++;return deps.anime(...args);}});
  assert.equal((await call(api,'/api/kids/detail?kind=anime&id=kitsu:486')).status,422);assert.equal(animeCalls,0);
  const good=createKidsApi({...deps,fetcher:async()=>new Response(JSON.stringify({meta:{id:'kitsu:486',genres:['Kids']}})),anime:handler({id:'kitsu:486',name:'Pokemon',episodes:[]})});
  assert.equal((await call(good,'/api/kids/detail?kind=anime&id=kitsu:486')).status,200);
});
test('Kids: títulos localizados encuentran la serie por ID sin coincidencias aproximadas',async()=>{
  const api=createKidsApi(deps),r=await call(api,'/api/kids/catalog?kind=series&q=Patrulla%20Canina');
  assert.equal(r.body.sections[0].items.length,1);assert.equal(r.body.sections[0].items[0].id,'tt3121722');
});
test('Kids: fallos parciales mantienen secciones disponibles y entradas inválidas no consultan fuentes',async()=>{
  let calls=0;const api=createKidsApi({...deps,anime:async()=>{throw Error('Anime no disponible');},metadata:async p=>{calls++;return metadata(p);}});
  const r=await call(api,'/api/kids/catalog');assert.equal(r.status,200);assert.equal(r.body.sections.length,3);assert.equal(r.body.warnings[0].kind,'anime');
  const before=calls;for(const p of ['kind=adult','skip=-1','theme=horror','year=2999'])assert.equal((await call(api,'/api/kids/catalog?'+p)).status,400);assert.equal(calls,before);
  assert.equal((await call(api,'/api/kids/detail?kind=movie&id=https://evil.test')).status,400);
});
