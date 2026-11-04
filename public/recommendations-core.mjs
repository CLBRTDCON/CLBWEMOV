const aliases={accion:'action',aventura:'adventure',comedia:'comedy',crimen:'crime',cienciaficcion:'scifi',sciencefiction:'scifi',fantasia:'fantasy',terror:'horror',suspense:'thriller',animacion:'animation',misterio:'mystery',romance:'romance',documental:'documentary'};
const genres=item=>new Set((item.genres||[]).map(g=>{const key=g.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');return aliases[key]||key;}));
const key=item=>item.kind+':'+(item.imdbId||item.id);
export function recommendations(items,history,{section,year=new Date().getFullYear(),limit=24}={}){
 const watched=(history||[]).filter(r=>['native','file','cinesrc'].includes(r.evidence)&&(r.position>=300||r.completed)&&r.item.section===section).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,10);
 const seen=new Set(watched.map(r=>key(r.item))),weights=new Map();watched.forEach((r,index)=>{for(const g of genres(r.item))weights.set(g,(weights.get(g)||0)+1/(index+1));});
 const unique=new Map();for(const item of items){if(item.section!==section||seen.has(key(item))||item.year<year-1||item.year>year||!Number.isInteger(item.year))continue;const score=[...genres(item)].reduce((n,g)=>n+(weights.get(g)||0),0);if(score>0&&!unique.has(key(item)))unique.set(key(item),{item,score});}
 const ranked=[...unique.values()].sort((a,b)=>b.score-a.score||b.item.year-a.item.year||a.item.name.localeCompare(b.item.name)).slice(0,limit).map(r=>r.item);
 const seed=watched.find(r=>ranked.some(item=>[...genres(item)].some(g=>genres(r.item).has(g))))?.item;
 return {items:ranked,seed:seed||null};
}
