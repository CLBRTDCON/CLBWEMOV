import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../public/source-config.js';
import {candidates,canChooseQuality} from '../mobile/player-policy.mjs';
import {api,installAndroidTransport} from '../mobile/api.mjs';
const movie={kind:'movie',playbackType:'movie',imdbId:'tt0137523',tmdbId:'550'};
const anime={kind:'anime',playbackType:'series',malId:223,imdbId:'tt0280249',tmdbId:'217282'};
const episode={season:1,episode:153,absoluteEpisode:153,imdbId:'tt0280249'};
test('móvil: latino prioriza fuente TMDB, película sin ruta de episodios',()=>{
  const list=candidates(movie,null,'latino','auto');
  assert.equal(list[0].url,'https://facilitoplay.com/e/pelicula/550');
  assert.equal(new Set(list.map(v=>v.url)).size,list.length);
  assert.equal(canChooseQuality(movie,null,'latino'),false);
});
test('móvil: anime original prioriza MAL y episodio de su ficha SUB',()=>{
  assert.equal(candidates(anime,episode,'original','auto')[0].url,'https://vidlink.pro/anime/223/153/sub?autoplay=false');
});

test('anime dividido: MAL usa episodio relativo y IMDb conserva el mapeo acumulado',()=>{
  const part={...anime,malId:62484};
  const entry={season:1,episode:1,absoluteEpisode:14,sourceSeason:1,sourceEpisode:14};
  const list=candidates(part,entry,'original','auto');
  assert.match(list[0].url,/\/anime\/62484\/1\/sub/);
  assert.match(list.find(s=>s.provider==='vidfast').url,/\/tv\/tt0280249\/1\/14/);
  assert.equal(candidates(part,entry,'castellano','auto')[0].provider,'facilito');
});
test('móvil: calidad solicitada prioriza CineSrc y no inventa 4K',()=>{
  const list=candidates(movie,null,'english','1080');
  assert.equal(list[0].provider,'cinesrc');assert.equal(new URL(list[0].url).searchParams.get('quality'),'1080');
  assert.equal(canChooseQuality(movie,null,'english'),true);
  assert.ok(candidates(movie,null,'english','2160').every(v=>!new URL(v.url).searchParams.has('quality')));
});
test('móvil: una edición IMDb diferente no reutiliza TMDB de otra serie',()=>{
  const entry={...episode,imdbId:'tt0088509'};
  assert.equal(canChooseQuality(anime,entry,'original'),false);
  const list=candidates(anime,entry,'english','auto');
  assert.ok(list.length);assert.ok(list.every(v=>!CineSources.providers[v.provider].tmdb));
  assert.ok(list.every(v=>v.url.includes('tt0088509')));
});
test('móvil: sin identificadores válidos no genera un vídeo equivocado',()=>{
  assert.deepEqual(candidates({playbackType:'movie',id:'mal:223'},null,'latino','auto'),[]);
  assert.deepEqual(candidates(null,null,'original','auto'),[]);
});
test('móvil: transporte conserva POST JSON y abort signal sin servidor HTTP',async()=>{
  const originalFetch=globalThis.fetch,originalLocation=globalThis.location;
  try{
    globalThis.location={origin:'https://appassets.androidplatform.net'};
    let received;
    installAndroidTransport(async(...args)=>{received=args;return new Response('{}');});
    const signal=new AbortController().signal;
    await fetch('https://graphql.anilist.co',{method:'POST',body:'{"query":"query{}"}',signal});
    const url=new URL(received[0]);assert.equal(url.origin,location.origin);assert.equal(url.pathname,'/network');
    assert.equal(url.searchParams.get('method'),'POST');assert.equal(url.searchParams.get('target'),'https://graphql.anilist.co/');
    assert.equal(url.searchParams.get('body'),'{"query":"query{}"}');assert.equal(received[1].signal,signal);
    await assert.rejects(fetch('http://example.com'),/HTTPS/);
    globalThis.location={origin:'https://example.com'};assert.throws(()=>installAndroidTransport(),/Origen/);
  }finally{globalThis.fetch=originalFetch;if(originalLocation===undefined)delete globalThis.location;else globalThis.location=originalLocation;}
});
test('móvil: API reutilizada filtra únicamente Paramount al seleccionar plataforma',async()=>{
  const original=globalThis.fetch,requested=[];
  try{
    globalThis.fetch=async url=>{requested.push(String(url));return new Response(JSON.stringify({metas:[{id:'tt0999999',name:'Serie de prueba móvil',releaseInfo:'2025',genres:['Drama']}]}));};
    const result=await api('/api/series/catalog?platform=pmp&skip=0');
    assert.equal(result.series.length,1);assert.equal(requested.length,1);assert.match(requested[0],/\/pmp\.json$/);
    await assert.rejects(api('/api/no-existe'),/no disponible/);
  }finally{globalThis.fetch=original;}
});
test('móvil: búsqueda de películas consulta el catálogo completo y conserva paginación',async()=>{
  const original=globalThis.fetch;let requested;
  try{
    globalThis.fetch=async url=>{requested=String(url);return new Response(JSON.stringify({metas:[{id:'tt0137523',name:'Fight Club',releaseInfo:'1999',moviedb_id:550}]}));};
    const result=await api('/api/catalog?kind=search&year=all&q=Fight%20Club&skip=48');
    assert.match(requested,/search=Fight%20Club&skip=48\.json$/);
    assert.equal(result.movies[0].id,'550');assert.equal(result.nextSkip,49);assert.equal(result.hasMore,true);
  }finally{globalThis.fetch=original;}
});
test('móvil: interfaz sin formulario técnico y controles enlazados existentes',async()=>{
  const html=await readFile(new URL('../mobile/index.html',import.meta.url),'utf8');
  const js=await readFile(new URL('../mobile/app.mjs',import.meta.url),'utf8');
  const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
  for(const match of js.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.has(match[1]),match[1]);
  assert.doesNotMatch(html,/Preparar una prueba|evidencia|Nombre para tu registro|ID de TMDB/i);
  assert.match(html,/data-kind="anime"/);assert.match(html,/data-kind="series"/);
});

test.skip('Solo APK: comprobación de empaquetado Android fuera del alcance de esta distribución web',async()=>{
  const main=await readFile(new URL('../android/app/src/main/java/com/cinelocal/app/MainActivity.java',import.meta.url),'utf8');
  const build=await readFile(new URL('../android/build.ps1',import.meta.url),'utf8');
  const assets=[...main.match(/ASSETS=.*Arrays.asList\(([^)]+)\)/)[1].matchAll(/"([^"]+)"/g)].map(m=>m[1]);
  const root=new URL('../',import.meta.url);
  for(const asset of assets){
    assert.ok(build.includes("'"+asset+"'"),asset+' falta en build');
    const url=new URL(asset,root),body=await readFile(url,'utf8');
    if(/\.m?js$/.test(asset)){
      assert.doesNotMatch(body,/from\s*['"]node:/,asset+' requiere Node');
      for(const m of body.matchAll(/from\s*['"]([^'"]+)['"]/g)){
        if(!m[1].startsWith('.'))continue;
        const dependency=new URL(m[1],url).href.slice(root.href.length);
        assert.ok(assets.includes(dependency),asset+' importa recurso ausente '+dependency);
      }
    }
    if(asset.endsWith('.html'))for(const m of body.matchAll(/(?:src|href)="([^"#]+\.(?:js|mjs|css))"/g))assert.ok(assets.includes(new URL(m[1],url).href.slice(root.href.length)),m[1]);
  }
  assert.match(main,/media-src https: blob:/);assert.match(main,/worker-src blob:/);
});
