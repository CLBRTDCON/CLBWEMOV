const hosts=new Set(['images.metahub.space','image.tmdb.org','m.media-amazon.com','images.justwatch.com','media.kitsu.app','media.kitsu.io','s4.anilist.co','static.tvmaze.com','archive.org','v-img.crazymaplestudios.com','v-mps.crazymaplestudios.com']);
export function posterCandidates(item){
  const urls=[];
  try{const u=new URL(item.posterUrl);if(u.protocol==='https:'&&hosts.has(u.hostname)){if(u.hostname==='image.tmdb.org')u.pathname=u.pathname.replace(/\/t\/p\/(original|w\d+)\//,'/t/p/w342/');urls.push(u.href);}}catch{}
  const imdb=item.imdbId||item.id;
  if(/^tt\d{7,12}$/.test(imdb||''))urls.push(`https://images.metahub.space/poster/medium/${imdb}/img`);
  return [...new Set(urls)];
}
export function createPosterLoader({document=globalThis.document,ImageClass=globalThis.Image,Observer=globalThis.IntersectionObserver,timeout=6000,concurrency=6}={}){
  const cache=new Map(),queue=[];let active=0;
  function pump(){while(active<(globalThis.CineDataSaver?.enabled?2:concurrency)&&queue.length){active++;const job=queue.shift();job().finally(()=>{active--;pump();});}}
  function request(url){
    const saved=cache.get(url);if(saved&&saved.expires>Date.now())return saved.task;
    const task=new Promise(resolve=>{queue.push(()=>new Promise(done=>{
      const img=new ImageClass();let finished=false;
      const end=ok=>{if(finished)return;finished=true;clearTimeout(timer);img.onload=null;img.onerror=null;if(!ok)img.removeAttribute('src');resolve(ok);done();};
      const timer=setTimeout(()=>end(false),timeout);img.onload=()=>end(true);img.onerror=()=>end(false);img.referrerPolicy='no-referrer';img.src=url;
    }));});
    if(cache.size>=400)cache.delete(cache.keys().next().value);cache.set(url,{task,expires:Date.now()+300000});pump();return task;
  }
  async function show(art,item){
    art.dataset.cover='loading';
    for(const url of posterCandidates(item).slice(0,globalThis.CineDataSaver?.enabled?1:2).map(u=>globalThis.CineDataSaver?.poster(u)||u))if(await request(url)){
      const img=document.createElement('img');img.alt='';img.width=342;img.height=513;img.decoding='async';img.referrerPolicy='no-referrer';img.src=url;
      img.addEventListener('error',()=>{img.remove();art.dataset.cover='missing';});art.append(img);art.dataset.cover='ready';return;
    }
    art.dataset.cover='missing';art.setAttribute('aria-label',`Portada no disponible: ${item.name}`);
  }
  const observer=Observer?new Observer(entries=>{for(const e of entries)if(e.isIntersecting){observer.unobserve(e.target);show(e.target,e.target.coverItem);e.target.coverItem=null;}},{rootMargin:'120px'}):null;
  return {attach(art,item){if(item.kind==='tv')return;art.coverItem=item;if(observer)observer.observe(art);else show(art,item);},reset(){observer?.disconnect();}};
}

