import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalognetApi,shareURL,mediaURL,resolveYandexDelivery} from '../catalognet-api.mjs';
const metadata={id:'movie:27205',name:'Origen',type:'movie',releaseInfo:'2010',poster:'https://image.tmdb.org/t/p/w342/a.jpg'};
const share='https://yadi.sk/d/PublicSample';
function fixture(){const calls=[];const fetcher=async(url,options)=>{const u=new URL(url);calls.push({url:u,options});let data;
 if(u.hostname==='downloader.disk.yandex.ru')return new Response(null,{status:302,headers:{Location:'https://mds.storage.yandex.net/video.mp4'}});
 if(u.hostname==='mds.storage.yandex.net')return new Response(new Uint8Array([0]),{status:206,headers:{'Content-Type':'video/mp4'}});
 if(u.pathname.includes('/catalog/'))data={metas:[metadata,{...metadata,id:'movie:1',releaseInfo:'2099'},{...metadata,id:'series:2'}]};
 else if(u.pathname.includes('/meta/series/'))data={meta:{...metadata,id:'series:1396',type:'series',videos:[{season:1,episode:1,title:'Uno'},{season:1,episode:2,title:'Dos'},{season:1,episode:3,released:'2099-01-01'}]}};
 else if(u.pathname.includes('/meta/'))data={meta:metadata};
 else if(u.pathname.includes('/links/'))data=[{share,title:'Origen',quality:'1080p',langs:['Dual'],size:'7 GB'}];
 else if(u.pathname.endsWith('/download'))data={href:'https://downloader.disk.yandex.ru/disk/PublicToken?filename=movie.mp4'};
 else if(u.pathname==='/v1/disk/public/resources')data={type:'file',name:'movie.mp4',mime_type:'video/mp4',size:1234567};
 else throw Error('Unexpected '+u.origin+u.pathname);return new Response(JSON.stringify(data));};return {calls,api:createCatalognetApi({fetcher})};}
async function query(api,path){let status,headers,body;await api({url:'/api/catalognet/'+path},{writeHead:(s,h)=>{status=s;headers=h;},end:s=>body=JSON.parse(s)});return {status,headers,body};}
test('CATALOGNET: lista filtrada conserva cursor upstream y no añade títulos de otro tipo',async()=>{
 const {api}=fixture(),r=await query(api,'catalog?kind=movie');assert.equal(r.status,200);assert.equal(r.body.items.length,1);assert.equal(r.body.items[0].id,'27205');assert.equal(r.body.nextSkip,3);
});
test('CATALOGNET: consultar opciones no descarga ni resuelve vídeos y Dual no se convierte en latino',async()=>{
 const {api,calls}=fixture(),r=await query(api,'links?kind=movie&id=27205');assert.equal(r.status,200);assert.deepEqual(r.body.sources[0].languages,['Dual']);assert.equal(r.body.sources[0].share,undefined);assert.equal(calls.length,1);assert.equal(calls[0].url.hostname,'victory-incl-elephant-diesel.trycloudflare.com');
});
test('CATALOGNET: resolución pide metadatos y href a Yandex, sin descargar el archivo',async()=>{
 const {api,calls}=fixture(),r=await query(api,'resolve?kind=movie&id=27205&index=0');assert.equal(r.status,200);assert.equal(r.body.format,'mp4');assert.equal(r.body.bytes,1234567);assert.ok(r.body.url.startsWith('https://mds.storage.yandex.net/'));assert.equal(calls.length,5);const download=calls.find(c=>c.url.pathname.endsWith('/download'));assert.equal(download.url.origin,'https://cloud-api.yandex.net');assert.equal(download.url.searchParams.get('public_key'),share);assert.equal(calls.at(-1).options.headers.Range,'bytes=0-0');assert.equal(calls.every(c=>c.options.redirect==='manual'),true);assert.equal(r.headers['Cache-Control'],'no-store');
});
test('CATALOGNET: no consulta una temporada/episodio ausente ni sustituye capítulo',async()=>{
 const {api,calls}=fixture(),r=await query(api,'links?kind=series&id=1396&season=1&episode=3');assert.equal(r.status,404);assert.equal(calls.length,1);assert.ok(calls[0].url.pathname.includes('/meta/'));
 const valid=await query(api,'links?kind=series&id=1396&season=1&episode=2');assert.equal(valid.status,200);assert.equal(calls.at(-1).url.searchParams.get('e'),'2');
});
test('CATALOGNET: rechaza identidad/índices inválidos sin red',async()=>{
 const {api,calls}=fixture();for(const path of ['links?kind=movie&id=http://localhost','links?kind=series&id=1396','resolve?kind=movie&id=27205&index=-1','resolve?kind=movie&id=27205&index=12','catalog?kind=adult','catalog?skip=-1'])assert.equal((await query(api,path)).status,400);assert.equal(calls.length,0);
});
test('CATALOGNET: URLs públicas y retornadas rechazan destinos ajenos, credenciales y engaños de sufijo',()=>{
 for(const url of ['http://yadi.sk/d/abc','https://user:pass@yadi.sk/d/abc','https://yadi.sk.evil.example/d/abc','https://127.0.0.1/d/abc','https://yadi.sk/d/abc?redirect=localhost'])assert.throws(()=>shareURL(url));
 for(const url of ['https://yandex.net.evil.example/x','https://127.0.0.1/x','http://downloader.disk.yandex.ru/x','https://disk.yandex.ru:444/x'])assert.throws(()=>mediaURL(url));
 assert.equal(mediaURL('https://s123.storage.yandex.net/x'),'https://s123.storage.yandex.net/x');
});
test('CATALOGNET: errores 429 son visibles y no se siguen redirecciones',async()=>{
 const limited=createCatalognetApi({fetcher:async()=>new Response('{}',{status:429})});const r=await query(limited,'links?kind=movie&id=27205');assert.equal(r.status,429);assert.equal(r.headers['Retry-After'],'30');
 const redirect=createCatalognetApi({fetcher:async()=>new Response('',{status:302,headers:{Location:'http://127.0.0.1/private'}})});assert.equal((await query(redirect,'links?kind=movie&id=27205')).status,502);
});
test('CATALOGNET: caché y consultas concurrentes comparten metadatos, no URLs temporales',async()=>{
 const {api,calls}=fixture();await Promise.all([query(api,'links?kind=movie&id=27205'),query(api,'links?kind=movie&id=27205')]);assert.equal(calls.length,1);await query(api,'resolve?kind=movie&id=27205&index=0');await query(api,'resolve?kind=movie&id=27205&index=0');assert.equal(calls.filter(c=>c.url.pathname.endsWith('/download')).length,2);
});

test('Yandex delivery bypasses redirect URL, cancels body and preserves exact signed destination',async()=>{let cancelled=0;const calls=[];const final='https://mds.storage.yandex.net/file?signature=sample';const fetcher=async(url,options)=>{calls.push({url,options});return {status:calls.length===1?302:206,headers:new Headers(calls.length===1?{Location:final}:{'Content-Type':'video/x-matroska'}),body:{async cancel(){cancelled++;}}};};assert.equal(await resolveYandexDelivery('https://downloader.disk.yandex.ru/file',{fetcher}),final);assert.equal(cancelled,2);assert.ok(calls.every(c=>c.options.redirect==='manual'&&c.options.headers.Range==='bytes=0-0'));});
test('Yandex delivery rejects untrusted redirects before fetching them',async()=>{for(const target of ['http://mds.storage.yandex.net/file','https://127.0.0.1/file','https://yandex.net.evil.example/file']){let calls=0;await assert.rejects(()=>resolveYandexDelivery('https://downloader.disk.yandex.ru/file',{fetcher:async()=>{calls++;return new Response(null,{status:302,headers:{Location:target}});}}));assert.equal(calls,1);}});
test('Yandex delivery terminates cycles and surfaces non-video or expired responses',async()=>{const url='https://downloader.disk.yandex.ru/file';await assert.rejects(()=>resolveYandexDelivery(url,{fetcher:async()=>new Response(null,{status:302,headers:{Location:url}})}),/ciclo/);await assert.rejects(()=>resolveYandexDelivery(url,{fetcher:async()=>new Response('expired',{status:403})}),/HTTP 403/);await assert.rejects(()=>resolveYandexDelivery(url,{fetcher:async()=>new Response('<html>verify</html>',{headers:{'Content-Type':'text/html'}})}),/página/);});
