import test from 'node:test';
import assert from 'node:assert/strict';
import {seriesApi} from '../series-api.mjs';
async function request(params,cinemeta) {
  let status,body;
  await seriesApi({url:'/api/series/catalog?'+new URLSearchParams(params)},{writeHead(s){status=s;},end(value){body=JSON.parse(value);}},cinemeta);
  return {status,body};
}
test('Series consulta 18 plataformas sin Crunchyroll; Anime solo Crunchyroll',async()=> {
  const original=globalThis.fetch,called=[];
  globalThis.fetch=async url=> {
    const id=String(url).match(/\/series\/(\w+)\.json$/)?.[1];called.push(id);
    const number={nfx:1,hbm:2,dnp:3,amp:4,atp:5,cru:6,pmp:7,hlu:8,pcp:9,stz:10,bbc:11,vik:12,shd:13,mp9:14,dpe:15,cts:16,bbo:17,act:18,iqi:19}[id];
    return new Response(JSON.stringify({metas:[{id:`tt${String(number).padStart(7,'0')}`,type:'series',name:id,releaseInfo:'2020',genres:['Drama']}]}));
  };
  try {
    const series=await request({platform:'all'},()=>{throw new Error('unexpected');});
    assert.equal(series.status,200);assert.equal(series.body.total,18);
    assert.ok(!called.includes('cru'));
    assert.ok(series.body.platforms.every(p=>p.id!=='cru'));
    assert.ok(series.body.series.every(s=>!s.platforms.includes('cru')));
    const paramount=await request({platform:'pmp'},()=>{throw new Error('unexpected');});
    assert.equal(paramount.status,200);assert.equal(paramount.body.total,1);assert.deepEqual(paramount.body.series[0].platforms,['pmp']);
    called.length=0;
    const anime=await request({platform:'cru'},()=>{throw new Error('unexpected');});
    assert.equal(anime.status,200);assert.deepEqual(called,['cru']);assert.equal(anime.body.total,1);
    assert.deepEqual(anime.body.series[0].platforms,['cru']);
  } finally {globalThis.fetch=original;}
});
test('Internet pagina según los registros upstream aunque el filtro descarte resultados',async()=> {
  let path;
  const result=await request({platform:'internet',skip:'50',year:'2023',genre:'Drama'},async route=> {
    path=route;return {metas:[{id:'tt0000010',name:'Drama',releaseInfo:'2023',genres:['Drama']},{id:'tt0000011',name:'Comedy',releaseInfo:'2023',genres:['Comedy']},{id:'invalid',name:'Invalid'}]};
  });
  assert.equal(result.status,200);assert.match(path,/catalog\/series\/year\//);assert.match(path,/genre=2023/);assert.match(path,/skip=50/);
  assert.equal(result.body.total,null);assert.equal(result.body.nextSkip,53);assert.equal(result.body.hasMore,true);
  assert.equal(result.body.series.length,1);assert.deepEqual(result.body.series[0].platforms,[]);
});
test('búsqueda de Internet usa la consulta completa y acaba al agotarse la fuente',async()=> {
  let path;
  const result=await request({platform:'internet',q:'A & B',skip:'100'},async route=>{path=route;return {metas:[]};});
  assert.equal(result.status,200);assert.match(path,/search=A\+%26\+B/);assert.equal(result.body.nextSkip,100);assert.equal(result.body.hasMore,false);
});
test('Internet mantiene errores visibles y rechaza plataforma inválida',async()=> {
  const fail=await request({platform:'internet'},async()=>{throw new Error('offline');});assert.equal(fail.status,502);
  const invalid=await request({platform:'invalid'},async()=>{throw new Error('must not fetch');});assert.equal(invalid.status,400);
});
