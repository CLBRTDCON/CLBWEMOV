globalThis.CLBShelves=(()=>{
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
  function render(container,items,createCard,{labels={},search=false,leading=null,controls=true,notes=true,emptyText='No hay resultados.'}={}){
    container.replaceChildren();
    if(!items.length&&!leading){const p=document.createElement('p');p.className='muted';p.textContent=emptyText;container.append(p);return;}
    const sections=search?[{name:'Resultados de búsqueda',items:[...new Map(items.map(i=>[String(i.id),i])).values()]}]:[...(leading?[leading]:[]),...groups(items,labels)];
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
  }
  return {groups,render};
})();
