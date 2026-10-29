import test from 'node:test';
import assert from 'node:assert/strict';
import {publicHttps,buildCatalog,createTvApi} from '../tv-api.mjs';
const channels=[{id:'One.mx',name:'Televisión Uno',country:'MX',categories:['news'],is_nsfw:false,website:'https://example.com'},{id:'Adult.mx',name:'Adult',country:'MX',is_nsfw:true},{id:'Closed.us',name:'Closed',country:'US',closed:'2020-01-01'},{id:'Missing.us',name:'Missing',country:'US'}];
const stream=(channel,url='https://cdn.example.com/live.m3u8',extra={})=>({channel,url,quality:'720p',labels:[],...extra});
const countries=[{code:'MX',name:'Mexico',flag:'🇲🇽'},{code:'US',name:'United States',flag:'🇺🇸'}],categories=[{id:'news',name:'News'}];
function fixtureFetcher(data,requests=[]){return async url=>{requests.push(url);const file=new URL(url).pathname.split('/').at(-1).replace('.json','');return new Response(JSON.stringify(data[file]));};}
const dataset={channels,streams:[stream('One.mx')],countries,categories};
async function call(api,path){let status,body;await api({url:path},{writeHead(s){status=s;},end(v){body=JSON.parse(v);}});return {status,body};}
test('TV: solo HTTPS público, sin credenciales, red local o puertos alternativos',()=>{
  assert.equal(publicHttps('https://cdn.example.com/x.m3u8'),'https://cdn.example.com/x.m3u8');
  for(const url of ['http://cdn.example.com/x','javascript:alert(1)','https://user:pass@example.com/x','https://localhost/x','https://127.0.0.1/x','https://10.1.2.3/x','https://172.16.4.2/x','https://192.168.1.1/x','https://169.254.169.254/x','https://2130706433/x','https://[::1]/x','https://example.com:8443/x','https://host.local/x'])assert.equal(publicHttps(url),null,url);
});
test('TV: cruza IDs, deduplica señales y excluye adultos, cerrados y headers especiales',()=>{
  const d=buildCatalog(channels,[stream('One.mx'),stream('One.mx'),stream('Adult.mx'),stream('Closed.us'),stream('One.mx','https://cdn.example.com/header.m3u8',{referrer:'https://foo.test'}),stream('One.mx','https://cdn.example.com/agent.m3u8',{user_agent:'custom'}),stream('Missing.us','http://cdn.example.com/a.m3u8'),stream('Missing.us','https://cdn.example.com/stream.ts')],countries,categories);
  assert.equal(d.channels.length,1);assert.equal(d.channels[0].streams.length,1);assert.equal(d.countries.length,1);assert.equal(d.countries[0].count,1);
});
test('TV: búsqueda con acentos, filtros y detalle conservan la señal exacta',async()=>{
  const requests=[],api=createTvApi(fixtureFetcher(dataset,requests));
  const filters=await call(api,'/api/tv/filters');assert.equal(filters.body.total,1);
  const result=await call(api,'/api/tv/catalog?country=MX&category=news&q=TELEVISION');assert.equal(result.body.channels[0].id,'One.mx');assert.equal(result.body.channels[0].sourceCount,1);assert.equal(result.body.channels[0].streams,undefined);
  const detail=await call(api,'/api/tv/channel?id=One.mx');assert.equal(detail.body.streams[0].url,dataset.streams[0].url);
  assert.equal((await call(api,'/api/tv/channel?id=unknown')).status,404);assert.equal(requests.length,4);
  assert.ok(requests.every(u=>u.startsWith('https://iptv-org.github.io/api/')));
});
test('TV: primera carga concurrente comparte descarga y pagina sin perder canales',async()=>{
  const rows=Array.from({length:95},(_,i)=>({id:`${i}.mx`,name:`Canal ${i}`,country:'MX',categories:['news']}));
  const requests=[],api=createTvApi(fixtureFetcher({...dataset,channels:rows,streams:rows.map(c=>stream(c.id))},requests));
  const [a,b]=await Promise.all([call(api,'/api/tv/filters'),call(api,'/api/tv/catalog')]);assert.equal(a.body.total,95);assert.equal(requests.length,4);assert.equal(b.body.channels.length,60);assert.equal(b.body.nextSkip,60);assert.equal(b.body.hasMore,true);
  const more=await call(api,'/api/tv/catalog?skip=60');assert.equal(more.body.channels.length,35);assert.equal(more.body.hasMore,false);
});
test('TV: fallo inicial queda visible y se permite reintentar; parámetros inválidos no consultan red',async()=>{
  let fail=true;const fetcher=fixtureFetcher(dataset),api=createTvApi(async url=>fail?new Response('{}',{status:503}):fetcher(url));
  assert.equal((await call(api,'/api/tv/catalog')).status,502);fail=false;assert.equal((await call(api,'/api/tv/catalog')).status,200);
  for(const p of ['skip=-1','country=../../etc','q='+('x'.repeat(121)),'category=https://evil.test'])assert.equal((await call(api,'/api/tv/catalog?'+p)).status,400);
});
test('TV: caché expirada conserva último catálogo si la fuente se cae',async()=>{
  const original=Date.now;let now=original(),fail=false;Date.now=()=>now;
  try{const fetcher=fixtureFetcher(dataset),api=createTvApi(async url=>fail?new Response('{}',{status:503}):fetcher(url));
    assert.equal((await call(api,'/api/tv/filters')).body.stale,false);now+=3600001;fail=true;
    const r=await call(api,'/api/tv/filters');assert.equal(r.status,200);assert.equal(r.body.stale,true);assert.equal(r.body.total,1);
  }finally{Date.now=original;}
});
