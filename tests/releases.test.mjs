import test from 'node:test';
import assert from 'node:assert/strict';
import {latestTitles,createReleasesApi} from '../releases-api.mjs';
import {animeRelease} from '../anime-api.mjs';
const row=(id,released,extra={})=>({id,released,genres:['Drama'],name:id,...extra});
const handler=fn=>async(req,res)=>{res.writeHead(200);res.end(JSON.stringify(fn(req)));};
async function call(api,path){let status,data;await api({url:path},{writeHead(s){status=s},end(v){data=JSON.parse(v)}});return{status,data};}
test('estrenos: orden descendente, IDs únicos, sin fechas futuras ni año inventado',()=>{
  const items=[row('a','2020-04-01'),row('b','2021-06-01'),row('a','2020-04-01'),row('future','2999-01-01'),row('unknown',null),row('year','2021')];
  assert.deepEqual(latestTitles(items).map(i=>i.id),['b','a']);
  const anime=row('kids',null,{kind:'anime',year:2021});assert.equal(latestTitles([anime]).length,0);assert.equal(latestTitles([anime],18,true)[0].released,null);
});
test('estrenos: AniList conserva fecha completa sin convertir datos incompletos en enero',()=>{
  assert.equal(animeRelease({year:2020,month:2,day:29}),'2020-02-29T00:00:00.000Z');
  assert.equal(animeRelease({year:2020}),null);assert.equal(animeRelease({year:2021,month:2,day:29}),null);
});
test('estrenos: consulta catálogo reciente independiente de populares y cachea filtros',async()=>{
  const paths=[],api=createReleasesApi({movies:handler(req=>{paths.push(req.url);return {movies:[row('new','2024-01-01'),row('old','2020-01-01')]};})});
  const a=await call(api,'/api/releases?kind=movie');assert.equal(a.status,200);assert.equal(paths.length,2);assert.ok(paths.every(p=>p.includes('kind=recent')));assert.equal(a.data.items[0].id,'new');
  await call(api,'/api/releases?kind=movie');assert.equal(paths.length,2);
});
test('estrenos: Kids mantiene clasificación del adaptador y no mezcla series al elegir películas',async()=>{
  const paths=[],api=createReleasesApi({kids:handler(req=>{paths.push(req.url);return {sections:[{items:[row('family','2022-01-01',{kind:'movie'})]}],warnings:[]};})});
  const d=await call(api,'/api/releases?kind=kids&selection=movie');assert.equal(d.status,200);assert.equal(d.data.items.length,1);assert.equal(paths.length,3);assert.ok(paths.every(p=>p.includes('kind=movie')&&p.includes('sort=recent')));
});
test('estrenos: fallo parcial no impide mostrar títulos y fallo total permite reintentar',async()=>{
  let fail=true;const api=createReleasesApi({movies:async(req,res)=>{if(fail)throw Error('offline');res.writeHead(200);res.end(JSON.stringify({movies:[row('ok','2022-01-01')]}));}});
  assert.equal((await call(api,'/api/releases?kind=movie')).status,502);fail=false;assert.equal((await call(api,'/api/releases?kind=movie')).status,200);
  const partial=createReleasesApi({movies:async(req,res)=>{if(req.url.includes(String(new Date().getFullYear()-1)))throw Error('offline');res.writeHead(200);res.end(JSON.stringify({movies:[row('ok','2022-01-01')]}));}});
  assert.equal((await call(partial,'/api/releases?kind=movie')).data.partial,true);
  assert.equal((await call(api,'/api/releases?kind=adult')).status,400);
});
