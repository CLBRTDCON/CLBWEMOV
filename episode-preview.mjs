// Public episode metadata only. Never substitute a series poster for an episode still.
const hosts=new Set(['episodes.metahub.space','images.metahub.space','image.tmdb.org','m.media-amazon.com','static.tvmaze.com','media.kitsu.app','media.kitsu.io','s4.anilist.co']);
export function episodePreview(value){
 let thumbnailUrl='';const candidate=typeof value.thumbnail==='string'?value.thumbnail:value.image?.medium||value.image?.original||'';
 try{const u=new URL(candidate);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&hosts.has(u.hostname))thumbnailUrl=u.href;}catch{}
 const description=String(value.overview||value.description||value.summary||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,650);
 const duration=Number(value.runtime);return {thumbnailUrl,description,runtime:Number.isFinite(duration)&&duration>0&&duration<=600?Math.round(duration):null};
}
