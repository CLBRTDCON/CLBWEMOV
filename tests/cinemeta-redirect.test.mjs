import test from 'node:test';
import assert from 'node:assert/strict';
import {cinemeta} from '../catalog-api.mjs';
test('Cinemeta: permite redirección de metadatos a live conservando identidad y rechaza otros destinos',async()=>{
 const original=globalThis.fetch;let destination,calls;
 globalThis.fetch=async url=>{calls++;if(new URL(url).hostname==='v3-cinemeta.strem.io')return new Response(null,{status:307,headers:{Location:destination}});return Response.json({meta:{id:new URL(url).pathname.match(/tt\d+/)[0],type:'series',videos:[{season:1,episode:1}]}});};
 try{
  calls=0;destination='https://cinemeta-live.strem.io/meta/series/tt34852924.json';const result=await cinemeta('meta/series/tt34852924.json');assert.equal(result.meta.videos.length,1);assert.equal(calls,2);
  let number=1234567;
  for(const target of ['https://cinemeta-live.strem.io/meta/series/tt9999999.json','https://cinemeta-live.strem.io/catalog/series/top/skip=0.json','https://cinemeta-live.strem.io.evil.test/meta/series/tt1234567.json','https://user@cinemeta-live.strem.io/meta/series/tt1234567.json']){calls=0;destination=target;await assert.rejects(()=>cinemeta('meta/series/tt'+(number++)+'.json'),/redirect/);assert.equal(calls,1);}
 }finally{globalThis.fetch=original;}
});
