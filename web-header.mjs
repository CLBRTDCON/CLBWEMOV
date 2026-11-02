const sections=[['/','Películas','cinema'],['/series','Series','series'],['/anime','Anime','anime'],['/documentales','Documentales','docs'],['/dramas','Dramas','dramas'],['/tv','TV en vivo','live'],['/kids','Kids ✦','kids'],['/adult','Adult +18','cinema'],['/biblioteca?view=search','Buscar en todo','cinema'],['/biblioteca','Mi lista','cinema']];
export function webHeader(path){
 const active=sections.find(([href])=>href===path);
 return `<header class="clb-web-header"><a class="brand" href="/" title="Cinema Lounge Base" aria-label="CLB · Cinema Lounge Base"><span class="brand-mark" aria-hidden="true">◒</span><span class="brand-word">CLB</span><span class="brand-section">${active?.[2]||'cinema'}</span></a><nav aria-label="Secciones">${sections.map(([href,label])=>`<a href="${href}"${href===path?' aria-current="page"':''}${href.includes('view=search')?' class="web-nav-search"':''}>${label}</a>`).join('')}</nav></header>`;
}
export function withWebHeader(html,path){
 if(['/','/series','/anime'].includes(path)){
  const search=html.match(/<label class="search-label">.*?<\/label>/s)?.[0];
  const year=html.match(path==='/'?/<label>Año<select id="release-year".*?<\/label>/s:/<label>Año de inicio<select id="series-year".*?<\/label>/s)?.[0];
  if(search&&year){html=html.replace(search,'').replace(year,'');const filters=`<div class="web-catalog-filters">${search}${year}</div>`;html=path==='/'?html.replace(/<div class="catalog-views"[^>]*>\s*<\/div>/,filters):html.replace('<details id="platform-picker"',filters+'<details id="platform-picker"');}
 }
 // Mobile assets are shared with the APK; only their HTTP web presentation changes.
 if(['/documentales','/dramas'].includes(path))html=html.replace(/<header>.*?<\/header>/s,m=>m.replace('<header>','<div class="web-legacy-header" hidden>').replace('</header>','</div>')).replace('<select id="year"><option value="all">Todos</option>','<select id="year"><option value="all">Todos los años</option>');
 else if(!['/ficha','/reproductor'].includes(path))html=html.replace(/<header\b[^>]*>.*?<\/header>/s,'');
 if(path==='/reproductor')html=html.replace(/<header>.*?<\/header>/s,m=>m.replace('<header>','<nav id="player-return" class="player-return">').replace('</header>','</nav>'));
 return html.replace(/(<body\b[^>]*>)/,`$1${webHeader(path)}`).replace('</head>','<link rel="stylesheet" href="/web-header.css"></head>');
}
