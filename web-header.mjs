const sections=[['/','Películas','cinema'],['/series','Series','series'],['/anime','Anime','anime'],['/documentales','Documentales','docs'],['/tv','TV en vivo','live'],['/kids','Kids ✦','kids'],['/adult','Adult +18','cinema'],['/biblioteca?view=search','Buscar en todo','cinema'],['/biblioteca','Mi lista','cinema'],['/activar','Acceso Latinobrid','cinema']];
export function webHeader(path){
 const active=sections.find(([href])=>href===path);
 const primary=sections.filter(([href])=>['/','/series','/anime','/documentales','/tv','/biblioteca'].includes(href));
 const links=primary.map(([href,label])=>`<a href="${href}"${href===path?' aria-current="page"':''}>${label}</a>`).join('');
 return `<header class="clb-web-header"><a class="brand" href="/" title="Cinema Lounge Base" aria-label="CLB · Cinema Lounge Base"><span class="brand-mark" aria-hidden="true">◒</span><span class="brand-word">CLB</span><span class="brand-section">${active?.[2]||'cinema'}</span></a><nav aria-label="Secciones">${links}</nav><div class="header-actions"><details class="header-more"><summary>Más</summary><div><a href="/kids">Kids</a><a href="/adult">Adult +18</a></div></details><a class="web-nav-search" href="/biblioteca?view=search" aria-label="Buscar en todo" title="Buscar en todo"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></a><a class="header-access" href="/activar">Mi acceso</a></div></header>`;
}
export function withWebHeader(html,path){
 if(['/','/series','/anime'].includes(path)){
  const search=html.match(/<label class="search-label">.*?<\/label>/s)?.[0];
  const year=html.match(path==='/'?/<label>Año<select id="release-year".*?<\/label>/s:/<label>Año de inicio<select id="series-year".*?<\/label>/s)?.[0];
  if(search&&year){html=html.replace(search,'').replace(year,'');const filters=`<div class="web-catalog-filters" hidden>${search}${year}</div>`;html=path==='/'?html.replace(/<div class="catalog-views"[^>]*>\s*<\/div>/,filters):html.replace('<details id="platform-picker"',filters+'<details id="platform-picker"');}
 }
 // Mobile assets are shared with the APK; only their HTTP web presentation changes.
 if(['/documentales'].includes(path))html=html.replace(/<header>.*?<\/header>/s,m=>m.replace('<header>','<div class="web-legacy-header" hidden>').replace('</header>','</div>')).replace('<select id="year"><option value="all">Todos</option>','<select id="year"><option value="all">Todos los años</option>');
 else if(!['/ficha','/reproductor'].includes(path))html=html.replace(/<header\b[^>]*>.*?<\/header>/s,'');
 if(path==='/reproductor')html=html.replace(/<header>.*?<\/header>/s,m=>m.replace('<header>','<nav id="player-return" class="player-return">').replace('</header>','</nav>'));
 if(path==='/documentales')html=html.replace('class="web-catalog-filters"','class="web-catalog-filters" hidden');
 return html.replace(/(<body\b[^>]*>)/,`$1${webHeader(path)}`).replace('</head>','<link rel="stylesheet" href="/web-header.css"><link rel="stylesheet" href="/premium.css"><script src="/premium.js" defer></script></head>');
}
