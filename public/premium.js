// Presentation only: reuse visible catalogue data, no extra requests or playback engine.
(()=>{
 const path=location.pathname,kind=path==='/'?'movie':path==='/series'?'series':path==='/anime'?'anime':path==='/documentales'?'documentary':null;
 document.body.classList.add('clb-premium');
 if(!kind)return;
 const host=document.getElementById(path==='/'?'catalog':path==='/documentales'?'grid':'series-catalog');if(!host)return;
 const copy={movie:['Tu próxima gran historia.','Cine para disfrutar, a tu ritmo.','Explorar estrenos'],series:['Una historia más. Un episodio más.','Encuentra tu próxima serie favorita.','Explorar series'],anime:['Historias que van más allá.','Descubre tu próximo anime.','Explorar anime'],documentary:['La realidad también sorprende.','Historias reales. Nuevas perspectivas.','Explorar documentales']}[kind];
 const hero=document.createElement('section');hero.className='premium-hero';hero.setAttribute('aria-label','Explorar '+{movie:'películas',series:'series',anime:'anime',documentary:'documentales'}[kind]);
 const text=document.createElement('div');text.className='premium-hero-copy';const eyebrow=document.createElement('p');eyebrow.className='premium-kicker';eyebrow.textContent='CINEMA LOUNGE BASE';const title=document.createElement('h1');title.textContent=copy[0];const summary=document.createElement('p');summary.textContent=copy[1];const go=document.createElement('a');go.className='premium-cta';go.textContent=copy[2];go.href=kind==='documentary'?'#grid':'#platform-catalogs';text.append(eyebrow,title,summary,go);
 const visual=document.createElement('div');visual.className='premium-hero-visual';visual.setAttribute('aria-hidden','true');hero.append(visual,text);
 if(kind==='documentary')host.parentElement.prepend(hero);else host.prepend(hero);
 const heading=kind==='movie'?host.querySelector('.catalog-heading'):kind==='documentary'?document.querySelector('main>h1'):host.querySelector('.catalog-heading');if(heading)heading.hidden=true;
 const grid=document.getElementById(kind==='documentary'?'grid':'platform-catalogs');let chosen=false;
 const update=()=>{if(chosen)return;const link=grid?.querySelector('a.movie-card');if(!link)return;const image=link.querySelector('img');if(!image)return;let item;try{item=JSON.parse(new URL(link.href,location.href).searchParams.get('clb'));}catch{return;}
  const art=document.createElement('img');art.src=item.backgroundUrl||image.src;art.alt='';art.decoding='async';art.referrerPolicy='no-referrer';art.className=item.backgroundUrl?'premium-backdrop':'premium-poster-art';art.onerror=()=>art.remove();visual.append(art);chosen=true;observer?.disconnect();
 };
 const observer=grid?new MutationObserver(update):null;observer?.observe(grid,{childList:true,subtree:true});update();
})();
