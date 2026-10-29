import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentariesApi,openLicense} from '../documentaries-api.mjs';
async function invoke(api,path){let status=200,body;await api({url:path},{writeHead(s){status=s},end(s){body=JSON.parse(s)}});return {status,...body};}
const documentary={id:'tt1234567',name:'Documental',genres:['Documentary'],releaseInfo:'2020',released:'2020-05-02'};
const archive={identifier:'FilmOpen',title:'Film Open',mediatype:'movies',subject:['Documentary'],year:2000,licenseurl:'https://creativecommons.org/publicdomain/zero/1.0/'};
test('documentales: clasificación estricta, deduplicación entre fuentes y fallos parciales visibles',async()=>{
 const api=createDocumentariesApi({metadata:async path=>({metas:[documentary,{id:'tt1234568',name:'Ficción',genres:['Drama']}, {...documentary,id:'bad'}]}),fetcher:async url=>{
  if(url.includes('archive.org'))throw Error('Archive caído');return new Response(JSON.stringify([{id:8,name:'Otra ficha',type:'Documentary',genres:[],externals:{imdb:'tt1234567'},premiered:'2020-05-02'},{id:9,type:'Scripted',genres:['Drama'],externals:{imdb:'tt7654321'}}]));
 }});
 const result=await invoke(api,'/api/documentaries/catalog?source=all');assert.equal(result.status,200);assert.equal(result.items.length,2);assert.ok(result.items.every(i=>i.genres.includes('Documentary')));assert.equal(result.warnings.length,1);assert.equal(result.nextSkip,1);
});
test('documentales: año y búsqueda se conservan; cursor representa páginas de 50 fichas',async()=>{
 const requested=[];const api=createDocumentariesApi({metadata:async path=>{requested.push(path);return {metas:[documentary,{...documentary,id:'tt7654321',releaseInfo:'2021'}]};}});
 const r=await invoke(api,'/api/documentaries/catalog?source=movie&year=2020&q=Océano&skip=2');assert.equal(r.items.length,1);assert.match(requested[0],/skip=100/);assert.match(requested[0],/search=Oc%C3%A9ano/);assert.equal(r.hasMore,true);
});
test('documentales: Archive excluye licencia no abierta o tema ajeno y pagina por fuente',async()=>{
 const api=createDocumentariesApi({fetcher:async url=>new Response(JSON.stringify({response:{numFound:48,docs:[archive,{...archive,identifier:'Closed',licenseurl:'https://example.com'},{...archive,identifier:'Fiction',subject:['Comedy']}]}}))});
 const r=await invoke(api,'/api/documentaries/catalog?source=archive');assert.equal(r.items.length,1);assert.equal(r.items[0].id,'archive:FilmOpen');assert.equal(r.hasMore,true);
 assert.equal(openLicense('https://creativecommons.org.evil.test/publicdomain/zero/1.0/'),false);
 assert.equal(openLicense('https://creativecommons.org/licenses/by/4.0/'),false);
});
test('documentales: detalle Archive valida identidad, licencia y archivos antes de reproducir',async()=>{
 let data={metadata:archive,files:[{name:'a film.mp4',height:'720'},{name:'../private.mp4'},{name:'locked.mp4',private:true},{name:'other.avi'}]};
 const api=createDocumentariesApi({fetcher:async()=>new Response(JSON.stringify(data))});
 const r=await invoke(api,'/api/documentaries/detail?id=archive:FilmOpen');assert.equal(r.status,200);assert.equal(r.streams.length,1);assert.equal(r.streams[0].url,'https://archive.org/download/FilmOpen/a%20film.mp4');assert.equal(r.playbackType,'file');
 const mismatched=createDocumentariesApi({fetcher:async()=>new Response(JSON.stringify({...data,metadata:{...archive,identifier:'Wrong'}}))});assert.equal((await invoke(mismatched,'/api/documentaries/detail?id=archive:FilmOpen')).status,422);
 const restricted=createDocumentariesApi({fetcher:async()=>new Response(JSON.stringify({...data,metadata:{...archive,nodownload:'true'}}))});assert.equal((await invoke(restricted,'/api/documentaries/detail?id=archive:FilmOpen')).status,422);
});
test('documentales: entradas inválidas no consultan Internet y fallo total permite reintentar',async()=>{
 let calls=0;const api=createDocumentariesApi({metadata:async()=>{calls++;throw Error('Caído')}});
 assert.equal((await invoke(api,'/api/documentaries/catalog?source=evil')).status,400);assert.equal((await invoke(api,'/api/documentaries/catalog?source=movie&skip=-1')).status,400);assert.equal(calls,0);
 assert.equal((await invoke(api,'/api/documentaries/catalog?source=movie')).status,502);assert.equal((await invoke(api,'/api/documentaries/catalog?source=movie')).status,502);assert.equal(calls,2);
});
