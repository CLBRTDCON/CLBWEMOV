import test from 'node:test';
import assert from 'node:assert/strict';
import {animeApi} from '../anime-api.mjs';
async function request(path,cinemeta=async()=>({meta:{}})) {
  let status,body;await animeApi({url:path},{writeHead(s){status=s;},end(s){body=JSON.parse(s);}},cinemeta);return {status,body};
}
test('AniList filtra y pagina en origen, conservando MAL y portadas permitidas',async()=> {
  const original=globalThis.fetch;let requestBody;
  globalThis.fetch=async(url,options)=> {
    assert.equal(url,'https://graphql.anilist.co');assert.equal(options.method,'POST');requestBody=JSON.parse(options.body);
    return new Response(JSON.stringify({data:{Page:{pageInfo:{hasNextPage:true},media:[{id:123,idMal:223,title:{english:'Dragon Ball'},format:'TV',startDate:{year:1986},genres:['Adventure'],coverImage:{large:'https://s4.anilist.co/test.jpg'}},{id:456,idMal:null,title:{romaji:'Example'},coverImage:{large:'https://evil.example/poster.jpg'}}]}}}));
  };
  try {
    const result=await request('/api/anime/catalog?source=anilist&skip=24&year=1986&genre=Adventure&format=TV&sort=rating&q=unit-anilist');
    assert.equal(result.status,200);assert.equal(requestBody.variables.page,2);assert.equal(requestBody.variables.from,19860000);assert.equal(requestBody.variables.to,19870000);assert.equal(requestBody.variables.format,'TV');assert.equal(requestBody.variables.genre,'Adventure');assert.deepEqual(requestBody.variables.sort,['SCORE_DESC']);
    assert.equal(result.body.series[0].id,'mal:223');assert.equal(result.body.series[1].id,'anilist:456');assert.equal(result.body.series[1].posterUrl,'');assert.equal(result.body.nextSkip,48);assert.equal(result.body.hasMore,true);assert.equal(result.body.total,null);
  }finally{globalThis.fetch=original;}
});
test('Kitsu conserva avance upstream aunque el año descarte fichas',async()=> {
  const original=globalThis.fetch;
  globalThis.fetch=async url=>{assert.match(url,/kitsu-anime-list/);return new Response(JSON.stringify({metas:[{id:'kitsu:99',name:'A',releaseInfo:'2000',animeType:'TV'},{id:'kitsu:98',name:'B',releaseInfo:'2001',animeType:'MOVIE'}]}));};
  try {const result=await request('/api/anime/catalog?source=kitsu&skip=100&year=2000&q=unit-kitsu');assert.equal(result.status,200);assert.equal(result.body.nextSkip,102);assert.equal(result.body.series.length,1);assert.equal(result.body.series[0].id,'kitsu:99');}
  finally{globalThis.fetch=original;}
});
test('detalle de anime usa correspondencia por episodio y no confunde MAL con IMDb',async()=> {
  const original=globalThis.fetch;let metadataPath;
  globalThis.fetch=async url=>{assert.match(url,/meta\/anime\/mal:999981\.json$/);return new Response(JSON.stringify({meta:{id:'kitsu:999981',type:'series',name:'Test cour',imdb_id:'tt1234567',videos:[{season:1,episode:1,absoluteEpisode:1,title:'Episode one',imdbSeason:3,imdbEpisode:12,released:'2020-01-01'},{season:1,episode:1,title:'duplicate'},{season:1,episode:-2,title:'invalid'}]}}));};
  try {
    const result=await request('/api/anime/detail?id=mal:999981',async path=>{metadataPath=path;return {meta:{moviedb_id:123}};});
    assert.equal(result.status,200);assert.equal(metadataPath,'meta/series/tt1234567.json');assert.equal(result.body.malId,999981);assert.equal(result.body.tmdbId,'123');assert.equal(result.body.episodes.length,1);assert.equal(result.body.episodes[0].sourceSeason,3);assert.equal(result.body.episodes[0].sourceEpisode,12);assert.equal(result.body.episodes[0].absoluteEpisode,1);
  }finally{globalThis.fetch=original;}
});
test('errores de fuente y límite temporal quedan visibles; filtros inválidos se rechazan',async()=> {
  const original=globalThis.fetch;
  globalThis.fetch=async()=>new Response('{}',{status:429});
  try {
    const limited=await request('/api/anime/catalog?q=unit-rate');assert.equal(limited.status,502);assert.match(limited.body.error,/límite temporal/);
    for(const path of ['/api/anime/catalog?source=bad','/api/anime/catalog?skip=1','/api/anime/catalog?format=bad','/api/anime/detail?id=../private'])assert.equal((await request(path)).status,400);
  }finally{globalThis.fetch=original;}
});

test('calendario AniList bloquea episodios futuros aunque Kitsu copie la fecha de estreno',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url)=>new Response(JSON.stringify(String(url).includes('graphql')?{data:{Media:{idMal:999983,status:'RELEASING',nextAiringEpisode:{episode:2},airingSchedule:{nodes:[{episode:1,airingAt:1500000000},{episode:2,airingAt:4102444800}]}}}}:{meta:{id:'kitsu:999983',name:'Part 2',videos:[{season:1,episode:1,absoluteEpisode:14,imdbEpisode:14,released:'2017-01-01'},{season:1,episode:2,absoluteEpisode:15,imdbEpisode:15,released:'2017-01-01'},{season:1,episode:7,released:'2017-01-01'}]}}));
 try{const r=await request('/api/anime/detail?id=mal:999983');assert.equal(r.status,200);assert.deepEqual(r.body.episodes.map(e=>e.upcoming),[false,true,true]);assert.equal(r.body.episodes[0].malEpisode,1);assert.equal(r.body.episodes[0].sourceEpisode,14);assert.match(r.body.episodeSource,/AniList/);}finally{globalThis.fetch=original;}
});
test('Kitsu obtiene MAL por mapping explícito y trata películas como películas',async()=> {
  const original=globalThis.fetch;
  globalThis.fetch=async url=>new Response(JSON.stringify(String(url).includes('/mappings')?{data:[{attributes:{externalSite:'anilist/anime',externalId:'999'}},{attributes:{externalSite:'myanimelist/anime',externalId:'9876'}}]}:{meta:{id:'kitsu:999982',type:'movie',name:'Test movie',videos:[]}}));
  try {
    const result=await request('/api/anime/detail?id=kitsu:999982');
    assert.equal(result.status,200);assert.equal(result.body.malId,9876);assert.equal(result.body.playbackType,'movie');assert.equal(result.body.episodes.length,1);assert.equal(result.body.episodes[0].name,'Película completa');
  }finally{globalThis.fetch=original;}
});

test('AniList reciente excluye cancelados y fechas sin información mediante límites de fecha',async()=>{
 const original=globalThis.fetch;let sent;globalThis.fetch=async(_,opts)=>{sent=JSON.parse(opts.body);return new Response(JSON.stringify({data:{Page:{pageInfo:{hasNextPage:false},media:[{id:99,idMal:99,title:{english:'Release'},startDate:{year:2020,month:6,day:1},genres:[],coverImage:{}}]}}}));};
 try{const r=await request('/api/anime/catalog?source=anilist&sort=recent&q=unit-release-bounds');assert.equal(r.status,200);assert.equal(sent.variables.from,19000000);assert.ok(sent.variables.to>20200101);assert.match(sent.query,/status_not_in:\[NOT_YET_RELEASED,CANCELLED\]/);assert.equal(r.body.series[0].released,'2020-06-01T00:00:00.000Z');}finally{globalThis.fetch=original;}
});
