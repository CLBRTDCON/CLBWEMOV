const KEY='clb.library.v1';
const sections=['movie','series','anime','kids','documentary','tv','drama'];
const kinds=['movie','series','anime','archive','tv','drama'];
const string=(v,n)=>typeof v==='string'?v.slice(0,n):'';
export function libraryItem(value){
 if(!value||!kinds.includes(value.kind)||!sections.includes(value.section))return null;
 if(!{movie:['movie','kids','documentary'],series:['series','kids','documentary','drama'],anime:['anime','kids'],archive:['documentary'],tv:['tv','kids'],drama:['drama']}[value.kind].includes(value.section))return null;
 const id=string(String(value.id||''),120);
 if(!/^(?:tt\d{7,12}|[1-9]\d{0,11}|(?:kitsu|mal|anilist):\d{1,10}|reelshort:[a-f0-9]{24}|archive:[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99})$/.test(id)&&!(value.kind==='tv'&&/^[\w.-]{1,120}$/.test(id)))return null;
 if(!string(value.name,200))return null;
 let posterUrl='';try{const u=new URL(value.posterUrl);if(u.protocol==='https:'&&!u.username&&!u.password)posterUrl=u.href.slice(0,2000);}catch{}
 return {id,kind:value.kind,section:value.section,name:string(value.name,200),country:/^[A-Z]{2}$/.test(value.country||'')?value.country:null,year:/^\d{4}$/.test(String(value.year))?Number(value.year):null,imdbId:/^tt\d{7,12}$/.test(value.imdbId||'')?value.imdbId:null,posterUrl,genres:(Array.isArray(value.genres)?value.genres:[]).filter(g=>typeof g==='string').slice(0,10).map(g=>g.slice(0,60)),platforms:(Array.isArray(value.platforms)?value.platforms:[]).filter(g=>typeof g==='string').slice(0,20).map(g=>g.slice(0,30)),catalog:string(value.catalog,100),format:string(value.format,30)};
}
export function libraryKey(item){return item.kind+':'+(item.kind==='movie'&&item.imdbId?item.imdbId:item.id);}
function episode(value){return value&&Number.isInteger(value.season)&&value.season>=0&&Number.isInteger(value.episode)&&value.episode>0?{season:value.season,episode:value.episode}:null;}
function verified(value){return ['native','cinesrc','file'].includes(value?.evidence);}
function record(value){const item=libraryItem(value?.item);if(!item)return null;return {item,updatedAt:Number(value.updatedAt)||0,episode:episode(value.episode),language:['latino','castellano','original','english'].includes(value.language)?value.language:'original',quality:['auto','720','1080'].includes(value.quality)?value.quality:'auto',evidence:verified(value)?value.evidence:null,provider:string(value.provider,40),position:(item.kind==='archive'||verified(value))&&Number.isFinite(value.position)&&value.position>=0&&value.position<=86400?value.position:0,duration:(item.kind==='archive'||verified(value))&&Number.isFinite(value.duration)&&value.duration>0&&value.duration<=86400?value.duration:0,streamIndex:Number.isInteger(value.streamIndex)&&value.streamIndex>=0?value.streamIndex:0,completed:value.completed===true};}
export function createLibrary({storage,onError=()=>{}}={}){
 let disk,state={version:1,favorites:[],history:[]};
 try{disk=storage||globalThis.localStorage;const raw=disk?.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(parsed.version!==1)throw Error('Versión de biblioteca desconocida.');for(const key of ['favorites','history'])state[key]=(Array.isArray(parsed[key])?parsed[key]:[]).map(record).filter(Boolean).slice(0,key==='favorites'?300:100);}}catch{onError('No se pudo leer tu biblioteca guardada.');}
 function commit(next){try{if(!disk)throw Error('Sin almacenamiento');disk.setItem(KEY,JSON.stringify(next));state=next;return true;}catch{onError('No se pudo guardar en el teléfono. Revisa el espacio disponible.');return false;}}
 function get(key){return state[key].map(r=>structuredClone(r));}
 function find(item){return get('history').find(r=>libraryKey(r.item)===libraryKey(item))||null;}
 return {
  favorites:()=>get('favorites'),history:()=>get('history').filter(r=>!r.completed),find,
  has:item=>state.favorites.some(r=>libraryKey(r.item)===libraryKey(item)),
  toggle(item){item=libraryItem(item);if(!item)return false;const found=state.favorites.some(r=>libraryKey(r.item)===libraryKey(item));if(!found&&state.favorites.length>=300){onError('Tu lista llegó a 300 títulos. Quita uno para guardar otro.');return false;}return commit({...state,favorites:found?state.favorites.filter(r=>libraryKey(r.item)!==libraryKey(item)):[record({item,updatedAt:Date.now()}),...state.favorites]});},
  remember(item,preferences={}){item=libraryItem(item);if(!item||item.kind==='tv')return false;const old=find(item),next=record({item,...preferences,updatedAt:Date.now()}),same=JSON.stringify(old?.episode)===JSON.stringify(next.episode)&&old?.streamIndex===next.streamIndex;if(same&&preferences.position===undefined&&!old?.completed){next.position=old?.position||0;next.duration=old?.duration||0;next.evidence=old?.evidence||null;next.provider=old?.provider||'';}return commit({...state,history:[next,...state.history.filter(r=>libraryKey(r.item)!==libraryKey(item))].slice(0,100)});},
  progress(item,{position,duration,streamIndex=0,completed=false,evidence=null,provider='',episode:expectedEpisode}){const old=find(item);if((item.kind!=='archive'&&!verified({evidence}))||!old||!Number.isFinite(position)||position<0||position>86400||!Number.isFinite(duration)||duration<=0||duration>86400)return false;if(expectedEpisode!==undefined&&JSON.stringify(episode(expectedEpisode))!==JSON.stringify(old.episode))return false;const updated={...old,position,duration,streamIndex,completed,evidence,provider};return commit({...state,history:state.history.map(r=>libraryKey(r.item)===libraryKey(item)?record(updated):r)});},
  remove(type,item){if(!['favorites','history'].includes(type))return false;return commit({...state,[type]:state[type].filter(r=>libraryKey(r.item)!==libraryKey(item))});}
 };
}
