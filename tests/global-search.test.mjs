import test from 'node:test';
import assert from 'node:assert/strict';
import {createGlobalSearch} from '../mobile/global-search.mjs';
test('búsqueda global: consulta siete secciones por título completo y conserva rutas tipadas',async()=>{
 const paths=[],updates=[],search=createGlobalSearch({api:async path=>{paths.push(path);if(path.startsWith('/api/catalog'))return {movies:[{id:'550',name:'Fight Club'}],nextSkip:48,hasMore:true};if(path.startsWith('/api/documentaries'))return {items:[{id:'archive:Film',kind:'archive',name:'Film'}]};return {series:[]};}});
 const result=await search.search('The Long Title',s=>updates.push(s));assert.equal(paths.length,7);assert.ok(paths.every(p=>new URL(p,'https://test.invalid').searchParams.get('q')==='The Long Title'));assert.equal(updates.filter(s=>s.status==='loading').length,7);assert.equal(result[0].items[0].kind,'movie');assert.equal(result[3].items[0].section,'documentary');assert.equal(result[3].items[0].kind,'archive');
});
test('búsqueda global: fallo de una fuente no elimina las otras y anime prueba Kitsu',async()=>{
 const search=createGlobalSearch({api:async path=>{if(path.startsWith('/api/series'))throw Error('Series caída');if(path.includes('source=anilist'))throw Error('AniList caída');return {series:[{id:'kitsu:1',name:'Anime'}],hasMore:false};}});const r=await search.search('Title');assert.equal(r.find(s=>s.key==='series').status,'error');assert.equal(r.find(s=>s.key==='anime').source,'kitsu');assert.equal(r.find(s=>s.key==='anime').items.length,1);assert.equal(r.find(s=>s.key==='movie').status,'ready');
});
test('búsqueda global: paginación por origen deduplica y mantiene todos los resultados',async()=>{
 const skips=[],search=createGlobalSearch({api:async path=>{const u=new URL(path,'https://test.invalid');if(!path.startsWith('/api/catalog'))return {series:[]};const skip=Number(u.searchParams.get('skip'));skips.push(skip);return {movies:skip?[{id:'1',name:'Uno'},{id:'2',name:'Dos'}]:[{id:'1',name:'Uno'}],nextSkip:skip+48,hasMore:true};}});const first=(await search.search('Title'))[0],next=await search.more(first);assert.deepEqual(skips,[0,48]);assert.equal(next.items.length,2);assert.equal(next.nextSkip,96);
});
test('búsqueda global: vacío/entradas inválidas no generan consultas',async()=>{
 let calls=0;const search=createGlobalSearch({api:async()=>{calls++;}});await assert.rejects(search.search('  '));await assert.rejects(search.search('x'.repeat(121)));await assert.rejects(search.search('A\u0000B'));assert.equal(calls,0);
});

test('búsqueda global: integración con el adaptador real de películas no omite el año all',async()=>{
 const {api}=await import('../mobile/api.mjs'),original=globalThis.fetch;let upstream;
 try{globalThis.fetch=async url=>{upstream=String(url);return new Response(JSON.stringify({metas:[{id:'tt0137523',name:'Fight Club',releaseInfo:'1999',moviedb_id:550}]}));};
  const search=createGlobalSearch({api:path=>path.startsWith('/api/catalog?')?api(path):Promise.resolve({series:[]})});
  const movie=(await search.search('Fight Club regression'))[0];assert.equal(movie.status,'ready');assert.equal(movie.items.length,1);assert.match(upstream,/search=Fight%20Club%20regression/);
 }finally{globalThis.fetch=original;}
});
