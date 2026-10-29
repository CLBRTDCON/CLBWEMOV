const imdb=value=>/^tt\d{7,12}$/.test(value||'')?value:null;
const tmdb=value=>/^[1-9]\d{0,11}$/.test(String(value||''))?String(value):null;
export function candidates(selected,entry,language,quality,sources=globalThis.CineSources) {
  if(!selected)return [];
  const movie=selected.playbackType==='movie';
  const id=imdb(entry?.imdbId)||imdb(selected.imdbId)||imdb(selected.id);
  const alternate=entry?.imdbId&&selected.imdbId&&entry.imdbId!==selected.imdbId;
  const numeric=alternate?null:tmdb(selected.tmdbId);
  const season=movie?undefined:entry?.sourceSeason??entry?.season;
  const episode=movie?undefined:entry?.sourceEpisode??entry?.episode;
  const list=[],seen=new Set();
  function add(provider,mal=false) {
    const sourceId=sources.providers[provider].tmdb?numeric:id;
    if(mal?!selected.malId:!sourceId)return;
    try {
      const url=mal?sources.animeUrl(selected.malId,entry?.malEpisode||entry?.episode||1):sources.url(provider,sourceId,season,episode,'es',quality);
      if(!seen.has(url.href)){seen.add(url.href);list.push({provider,url:url.href});}
    }catch{}
  }
  if(quality!=='auto')add('cinesrc');
  if(['latino','castellano'].includes(language))add('facilito');
  if(language==='original'&&selected.kind==='anime')add('vidlink',true);
  add('vidfast');add('sh');add('to');add('cinesrc');add('vidlink');
  if(!['latino','castellano'].includes(language))add('facilito');
  return list;
}
export function canChooseQuality(selected,entry,language) {
  return !['latino','castellano'].includes(language)&&!!tmdb(selected?.tmdbId)&&!(entry?.imdbId&&selected?.imdbId&&entry.imdbId!==selected.imdbId);
}
