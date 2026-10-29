import {catalogEligible} from './catalog-api.mjs';
const cache=new Map();
const kitsu='https://anime-kitsu.strem.fun';
const formats=['TV','TV_SHORT','MOVIE','SPECIAL','OVA','ONA','TV_SPECIAL'];
const genres=['Action','Adventure','Comedy','Drama','Fantasy','Horror','Mahou Shoujo','Mecha','Music','Mystery','Psychological','Romance','Sci-Fi','Slice of Life','Sports','Supernatural','Thriller'];
async function json(key,url,options={}) {
  const previous=cache.get(key);
  if(previous && previous.expires>Date.now()) return previous.data;
  const response=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(15000)});
  if(response.status===429) throw new Error('La fuente de anime alcanzó su límite temporal. Espera un momento y reintenta.');
  if(!response.ok) throw new Error('La fuente de anime no respondió. Puedes probar el otro catálogo.');
  const body=await response.text();if(body.length>4_000_000) throw new Error('Respuesta de anime demasiado grande.');
  const data=JSON.parse(body);
  if(data.errors?.length) throw new Error('La consulta de anime fue rechazada por la fuente.');
  if(cache.size>=40) cache.delete(cache.keys().next().value);
  cache.set(key,{data,expires:Date.now()+300000});return data;
}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function poster(value){try{const u=new URL(value);return u.protocol==='https:' && ['media.kitsu.app','media.kitsu.io','s4.anilist.co'].includes(u.hostname)?u.href:'';}catch{return '';}}
function date(value){const timestamp=Date.parse(value);return Number.isFinite(timestamp)?new Date(timestamp).toISOString():null;}
function imdb(value){return /^tt\d{7,12}$/.test(value||'')?value:null;}
const number=value=>Number.isSafeInteger(Number(value)) && Number(value)>0?Number(value):null;
export function animeRelease(parts){
  if(!parts||!Number.isInteger(parts.year)||!Number.isInteger(parts.month)||!Number.isInteger(parts.day))return null;
  const d=new Date(Date.UTC(parts.year,parts.month-1,parts.day));
  return d.getUTCFullYear()===parts.year&&d.getUTCMonth()+1===parts.month&&d.getUTCDate()===parts.day?d.toISOString():null;
}
function animeItem(m) {
  if(!catalogEligible(m)||!/^kitsu:\d{1,10}$/.test(m?.id||'') || typeof m.name!=='string') return null;
  return {id:m.id,name:m.name.slice(0,200),released:date(m.released),year:Number(String(m.releaseInfo||m.year||'').slice(0,4))||null,posterUrl:poster(m.poster),genres:Array.isArray(m.genres)?m.genres.filter(g=>typeof g==='string').slice(0,10):[],platforms:[],catalog:'Kitsu',format:String(m.animeType||'Anime').slice(0,25)};
}
export async function animeApi(req,res,cinemeta) {
  const url=new URL(req.url,'https://app.invalid');
  if(url.pathname==='/api/anime/detail') {
    const id=url.searchParams.get('id');
    if(!/^(kitsu|mal|anilist):\d{1,10}$/.test(id||'')){send(res,400,{error:'Identificador de anime inválido.'});return;}
    try {
      const data=await json('detail:'+id,`${kitsu}/meta/anime/${id}.json`),m=data.meta;
      if(!m || !/^kitsu:\d+$/.test(m.id||'') || (id.startsWith('kitsu:') && m.id!==id)){send(res,404,{error:'No se encontró la ficha de ese anime.'});return;}
      const imdbId=imdb(m.imdb_id);let tmdbId=null;
      let malId=id.startsWith('mal:')?number(id.slice(4)):null;
      const movie=m.type==='movie' || String(m.animeType).toUpperCase()==='MOVIE';
      if(!malId) {
        try {
          const mapping=await json('mapping:'+m.id,`https://kitsu.app/api/edge/anime/${m.id.slice(6)}/mappings`);
          malId=number(mapping.data?.find(row=>row.attributes?.externalSite==='myanimelist/anime')?.attributes?.externalId);
        }catch{}
      }
      if(imdbId) {
        try {const metadata=await cinemeta(`meta/${movie?'movie':'series'}/${imdbId}.json`);const tmdb=number(metadata.meta?.moviedb_id);if(tmdb)tmdbId=String(tmdb);}catch{}
      }
      let airing=null;
      if(malId||id.startsWith('anilist:')) {
        try {
          const variables=malId?{mal:malId}:{id:number(id.slice(8))};
          const query='query($mal:Int,$id:Int){Media(idMal:$mal,id:$id,type:ANIME){id idMal status nextAiringEpisode{episode airingAt} airingSchedule(perPage:50){nodes{episode airingAt}}}}';
          const result=await json('airing:'+JSON.stringify(variables),'https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,variables})});
          const media=result.data?.Media;
          if(media&&(malId?media.idMal===malId:media.id===variables.id))airing=media;
        }catch{}
      }
      const schedule=new Map((airing?.airingSchedule?.nodes||[]).filter(n=>number(n.episode)&&Number.isSafeInteger(n.airingAt)&&n.airingAt>0).map(n=>[n.episode,new Date(n.airingAt*1000).toISOString()]));
      const seen=new Set();
      const episodes=(Array.isArray(m.videos)?m.videos:[]).flatMap(v=> {
        const season=Number(v.season??1),episode=number(v.episode),absolute=number(v.absoluteEpisode)||episode;
        if(!Number.isInteger(season)||season<0||season>1000||!episode||episode>10000||seen.has(`${season}:${episode}`))return [];
        seen.add(`${season}:${episode}`);const released=schedule.get(episode)||date(v.released);
        const upcoming=['NOT_YET_RELEASED','CANCELLED'].includes(airing?.status)||!!released&&Date.parse(released)>Date.now()||airing?.status==='RELEASING'&&number(airing.nextAiringEpisode?.episode)!==null&&episode>=airing.nextAiringEpisode.episode;
        return [{season,episode,malEpisode:episode,absoluteEpisode:absolute,name:String(v.title||v.name||`Episodio ${episode}`).slice(0,200),released,upcoming,imdbId:imdb(v.imdb_id)||imdbId,sourceSeason:Number.isInteger(v.imdbSeason)&&v.imdbSeason>=0?v.imdbSeason:season,sourceEpisode:number(v.imdbEpisode)||episode}];
      }).sort((a,b)=>a.season-b.season||a.episode-b.episode);
      if(movie && !episodes.length) episodes.push({season:1,episode:1,absoluteEpisode:1,name:'Película completa',released:null,upcoming:false,imdbId,sourceSeason:1,sourceEpisode:1});
      send(res,200,{id,kind:'anime',malId,imdbId,tmdbId,playbackType:movie?'movie':'series',name:String(m.name||id).slice(0,200),description:String(m.description||'').slice(0,4000),posterUrl:poster(m.poster),episodes,episodeSource:airing?'Anime Kitsu + calendario AniList':'Anime Kitsu',episodeWarning:(airing?'':'No se pudo contrastar el calendario de episodios. ')+ 'Las entregas pueden tener fichas separadas. El idioma y los subtítulos dependen de cada servidor.'});
    }catch(error){send(res,502,{error:error.message});}return;
  }
  if(url.pathname!=='/api/anime/catalog'){send(res,404,{error:'Ruta no encontrada.'});return;}
  const source=url.searchParams.get('source')||'anilist',q=(url.searchParams.get('q')||'').trim(),genre=url.searchParams.get('genre')||'all',sort=url.searchParams.get('sort')||'popular',format=url.searchParams.get('format')||'all';
  const skip=Number(url.searchParams.get('skip')||0),yearText=url.searchParams.get('year')||'all',year=yearText==='all'?null:Number(yearText);
  const currentYear=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'America/Mexico_City'}).format(new Date()));
  if(!['anilist','kitsu'].includes(source)||!['popular','rating','recent'].includes(sort)||q.length>120||/[\u0000-\u001f]/.test(q)||genre.length>60||!Number.isInteger(skip)||skip<0||skip>50000||(source==='anilist'&&skip%24!==0)||(year!==null&&(!Number.isInteger(year)||year<1920||year>currentYear))||(format!=='all'&&!formats.includes(format))){send(res,400,{error:'Filtros de anime inválidos.'});return;}
  try {
    if(source==='anilist') {
      const now=new Date();const tomorrow=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1));const until=tomorrow.getUTCFullYear()*10000+(tomorrow.getUTCMonth()+1)*100+tomorrow.getUTCDate();
      const variables={page:skip/24+1,sort:sort==='rating'?['SCORE_DESC']:sort==='recent'?['START_DATE_DESC']:['POPULARITY_DESC'],search:q||undefined,genre:genre==='all'?undefined:genre,format:format==='all'?undefined:format,from:year===null?(sort==='recent'?19000000:undefined):year*10000,to:sort==='recent'?Math.min(year===null?until:(year+1)*10000,until):year===null?undefined:(year+1)*10000};
      const query=`query($page:Int,$sort:[MediaSort],$search:String,$genre:String,$format:MediaFormat,$from:FuzzyDateInt,$to:FuzzyDateInt){Page(page:$page,perPage:24){pageInfo{hasNextPage}media(type:ANIME,isAdult:false,status_not_in:[NOT_YET_RELEASED,CANCELLED],sort:$sort,search:$search,genre:$genre,format:$format,startDate_greater:$from,startDate_lesser:$to){id idMal status title{romaji english}format genres coverImage{large}startDate{year month day}}}}`;
      const data=await json('anilist:'+JSON.stringify(variables),'https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,variables})});
      const page=data.data?.Page;if(!Array.isArray(page?.media))throw new Error('Formato de catálogo de anime no reconocido.');
      const series=page.media.filter(m=>number(m.id)&&catalogEligible(m)).map(m=>({id:number(m.idMal)?`mal:${m.idMal}`:`anilist:${m.id}`,name:String(m.title?.english||m.title?.romaji||'Anime').slice(0,200),year:number(m.startDate?.year),released:animeRelease(m.startDate),posterUrl:poster(m.coverImage?.large),genres:Array.isArray(m.genres)?m.genres.filter(g=>typeof g==='string').slice(0,10):[],platforms:[],catalog:'AniList',format:m.format}));
      send(res,200,{series,total:null,nextSkip:skip+24,hasMore:!!page.pageInfo?.hasNextPage,platforms:[],genres,warnings:[],region:'No verificada',source:'AniList',paged:true});
    } else {
      const extras=new URLSearchParams({skip:String(skip)});let catalog=q?'kitsu-anime-list':sort==='rating'?'kitsu-anime-rating':sort==='recent'?'kitsu-anime-airing':'kitsu-anime-popular';
      if(q)extras.set('search',q);else if(genre!=='all')extras.set('genre',genre);
      const data=await json('kitsu:'+catalog+':'+extras,`${kitsu}/catalog/anime/${catalog}/${extras}.json`);
      if(!Array.isArray(data.metas))throw new Error('Formato de catálogo de anime no reconocido.');
      let series=data.metas.map(animeItem).filter(Boolean);if(year!==null)series=series.filter(s=>s.year===year);if(q&&genre!=='all')series=series.filter(s=>s.genres.includes(genre));
      send(res,200,{series,total:null,nextSkip:skip+data.metas.length,hasMore:data.metas.length>0,platforms:[],genres,warnings:year!==null||format!=='all'?['En Kitsu, el año se filtra por página; el formato se filtra con AniList.']:[],region:'No verificada',source:'Anime Kitsu',paged:true});
    }
  }catch(error){send(res,502,{error:error.message});}
}
