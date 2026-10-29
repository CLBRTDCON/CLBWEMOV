const key='clb.drama-tests.v1';
export const dramaStatuses={pending:'Sin validar',partial:'Inconcluso',complete:'Completo',failed:'No reproduce'};
export function createDramaTests({storage,onError=()=>{}}={}){
 let disk,data={};try{disk=storage||globalThis.localStorage;data=JSON.parse(disk?.getItem(key)||'{}');if(!data||Array.isArray(data)||typeof data!=='object')data={};}catch{onError('No se pudieron leer las pruebas de Dramas.');}
 return {get(id,detail={}){const d=data[id];if(!d||!Object.hasOwn(dramaStatuses,d.status))return {status:'pending',count:0};return d.status==='complete'&&(detail.restricted||d.count<(detail.announcedEpisodes||detail.episodes?.length||0))?{...d,status:'pending',changed:true}:{...d};},set(id,{status,count=0,finished=false},detail={}){
  if(!/^(?:tt\d{7,12}|reelshort:[a-f0-9]{24})$/.test(id)||!Object.hasOwn(dramaStatuses,status)||!Number.isInteger(count)||count<0||count>10000)throw Error('Resultado de prueba inválido.');
  if(status==='complete'&&detail.playbackType==='official'&&detail.publicEpisodes<detail.announcedEpisodes)throw Error('La fuente no ofrece todos los capítulos públicos; la prueba no está completa.');
  if(status==='complete'&&(!finished||count<1||detail.restricted||detail.episodes?.some(e=>e.locked||e.upcoming)||count<(detail.announcedEpisodes||detail.episodes?.length||1)))throw Error(detail.restricted?'La fuente indica capítulos bloqueados; no se puede marcar como completo.':'Para marcar Completo confirma el final y todos los capítulos anunciados y publicados.');
  const next={...data,[id]:{status,count,finished:!!finished,updatedAt:Date.now()}};if(Object.keys(next).length>500)delete next[Object.keys(next)[0]];
  try{if(!disk)throw Error();disk.setItem(key,JSON.stringify(next));data=next;return true;}catch{onError('No se pudo guardar la prueba en el teléfono.');return false;}
 }};
}
