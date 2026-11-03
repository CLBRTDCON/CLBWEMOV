globalThis.CLBShelves=(()=>{
  const snapshots=new WeakMap();
  const priority=['Acción','Aventura','Comedia','Drama','Ciencia ficción','Suspenso','Terror','Fantasía','Romance','Animación','Familiar','Documental'];
  function groups(items,labels={}){
    const buckets=new Map();
    for(const item of items){
      if(item?.id==null)continue;
      const names=[...new Set((Array.isArray(item.genres)?item.genres:[]).filter(g=>typeof g==='string'&&g.trim()).map(g=>labels[g]||g.trim()))];
      for(const name of names.length?names:['Por descubrir']){
        if(!buckets.has(name))buckets.set(name,new Map());
        if(!buckets.get(name).has(String(item.id)))buckets.get(name).set(String(item.id),item);
      }
    }
    return [...buckets].sort(([a],[b])=>{const ai=priority.indexOf(a),bi=priority.indexOf(b);return (ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b,'es');}).map(([name,rows])=>({name,items:[...rows.values()]}));
  }
  function render(container,items,createCard,{labels={},search=false,leading=null,featured=null,controls=true,notes=true,emptyText='No hay resultados.'}={}){
    const gate=globalThis.CLBAvailability;
    if(gate&&['movie-grid','series-grid','grid'].includes(container.id)){
      const originalItems=items,original={labels,search,leading,featured,controls,notes,emptyText};const candidates=[...(featured?.items||[]),...(leading?.items||[]),...items];
      gate.track(container,candidates,()=>render(container,originalItems,createCard,original));
      items=items.filter(gate.has);if(leading)leading={...leading,items:leading.items.filter(gate.has)};if(featured)featured={...featured,items:featured.items.filter(gate.has)};
      if(!items.length&&!leading?.items.length&&!featured?.items.length){container.replaceChildren();const status=document.createElement('p');status.className='muted';status.setAttribute('role','status');status.textContent=gate.pending(candidates)?'Comprobando archivos disponibles…':gate.failed(candidates)?'No se pudo completar la comprobación de archivos. Reintenta más tarde.':'No encontramos archivos disponibles en esta selección.';container.append(status);return;}
    }
    const signature=JSON.stringify([items.map(i=>[i.kind,i.id,i.name,i.posterUrl,i.year,i.genres]),leading,featured,labels,search,controls,notes,emptyText]);const previous=snapshots.get(container);if(!items.some(i=>i.section==='drama')&&previous?.signature===signature&&previous.first===container.firstChild)return;
    container.replaceChildren();
    if(!items.length&&!leading){const p=document.createElement('p');p.className='muted';p.textContent=emptyText;container.append(p);return;}
    const sections=search?[{name:'Resultados de búsqueda',items:[...new Map(items.map(i=>[String(i.id),i])).values()]}]:[...(featured?[featured]:[]),...(leading?[leading]:[]),...groups(items,labels)];
    for(const section of sections){
      const shelf=document.createElement('section');shelf.className='genre-shelf';
      const head=document.createElement('div');head.className='genre-heading';
      const title=document.createElement('h3');title.textContent=section.name;
      const count=document.createElement('span');count.className='shelf-count';count.textContent=`${section.items.length} títulos`;
      const row=document.createElement('div');row.className=search?'search-results-grid':'genre-row';row.tabIndex=0;row.setAttribute('aria-label',section.name);
      head.append(title,count);
      if(!search&&controls){const actions=document.createElement('div');actions.className='shelf-actions';
        for(const [direction,text] of [[-1,'←'],[1,'→']]){const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',`${direction<0?'Anterior':'Siguiente'} en ${section.name}`);b.addEventListener('click',()=>row.scrollBy({left:direction*Math.max(240,row.clientWidth*.85),behavior:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));actions.append(b);}head.append(actions);
      }
      for(const item of section.items)row.append(createCard(item));
      if(!section.items.length){const p=document.createElement('p');p.className='hint';p.textContent=section.message||'No hay lanzamientos con fecha confirmada en esta selección.';row.append(p);}
      shelf.append(head);if(section.note&&notes){const p=document.createElement('p');p.className='hint';p.textContent=section.note;shelf.append(p);}else if(section.note)head.setAttribute('aria-description',section.note);shelf.append(row);container.append(shelf);
    }
    snapshots.set(container,{signature,first:container.firstChild});
  }
  function recent(items,year=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'America/Mexico_City'}).format(new Date()))){return items.filter(item=>{const value=Number(String(item.year||item.released||'').slice(0,4));return Number.isInteger(value)&&value>=year-1&&value<=year;});}
  return {groups,render,recent};
})();
