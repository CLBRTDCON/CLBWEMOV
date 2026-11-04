// The limit is enforced on both advertised variants and parsed video dimensions.
export function within1080(quality){const s=String(quality||'');if(/4k|2160|4320|8k/i.test(s))return false;const m=s.match(/(?:^|\D)(\d{3,4})\s*p?(?:\D|$)/i);return !!m&&Number(m[1])<=1080&&Number(m[1])>=240;}
export function supportedDimensions(streams){const v=streams.filter(s=>(s.codecparProxy||s.codecpar)?.codecType===0&&!(s.disposition&0x400));return v.length>0&&v.every(s=>{const p=s.codecparProxy||s.codecpar;return p.height>0&&p.height<=1080&&p.width>0&&p.width<=1920;});}
const codecs={7:'mjpeg',61:'png',27:'h264',173:'hevc',86018:'aac',86019:'ac3',86056:'eac3',86017:'mp3',86076:'opus',86028:'flac'};
export function wasmResource(type,id){const file=type==='decoder'&&codecs[id]?'decode/'+codecs[id]:type==='resampler'?'resample/resample':type==='stretchpitcher'?'stretchpitch/stretchpitch':null;if(!file)throw Error('Códec no disponible en el reproductor: '+id);const atomic=globalThis.crossOriginIsolated&&typeof SharedArrayBuffer==='function';return '/vendor/libmedia/'+file+(atomic?'-atomic':'')+'.wasm';}
export function spanishTrack(streams){return streams.find(s=>{const p=s.codecparProxy||s.codecpar;return p?.codecType===1&&/^(?:es|spa)(?:$|[-_\s])|español|spanish|latino/i.test(String(s.metadata?.language||'')+' '+String(s.metadata?.title||''));});}
export function playbackFailure(value){const error=Array.isArray(value)?value[0]:value;const message=typeof error==='string'?error:typeof error==='number'?'Código '+error:typeof error?.message==='string'?error.message:typeof error?.code==='number'?'Código '+error.code:'El motor no proporcionó un detalle del fallo.';return message.replace(/https?:\/\/[^\s"'<>]+/g,'[enlace temporal]').slice(0,320);}

// A temporary URL is never a file identity. Ambiguous metadata must not select a file.
export function exactVariant(sources,key,index){
 const rows=(sources||[]).filter(s=>!s.unsupported);
 if(key){const matches=rows.filter(s=>s.key===key);return matches.length===1?matches[0]:null;}
 return rows.find(s=>s.index===index)||null;
}
export function recoverablePlayback(error){const text=String(error?.message||error||'');return !/401|403|409|429|codec|códec|resolución|1080|AudioWorklet|política|identidad|lista de archivos|ya no figura/i.test(text)&&/fetch|network|red|HTTP 5\d\d|HTTP 410|expir|timeout|tardó|open stream failed|ret: -2/i.test(text);}
