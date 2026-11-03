import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withWebHeader} from '../web-header.mjs';
test('web layouts share navigation and preserve hero, player return and mobile controller IDs',async()=>{
 for(const [path,file]of[['/','public/index.html'],['/series','public/series.html'],['/anime','public/series.html'],['/documentales','public/documentaries.html'],['/ficha','public/ficha.html'],['/reproductor','public/audio-1080.html']]){
  const html=withWebHeader(await readFile(new URL('../'+file,import.meta.url),'utf8'),path);
  assert.equal((html.match(/class="clb-web-header"/g)||[]).length,1);
  const header=html.match(/<header class="clb-web-header">.*?<\/header>/s)[0];
  assert.doesNotMatch(header,/CATALOG\/\/NET|Ajustes/);assert.match(header,/Documentales/);assert.match(header,/href="\/activar"[^>]*>Mi acceso<\/a>/);
  if(path==='/ficha')assert.match(html,/header class="hero"/);
  if(path==='/reproductor')assert.match(html,/nav id="player-return"/);
  assert.doesNotMatch(header,/href="\/dramas"/);if(path==='/documentales'){assert.match(html,/id="doc-search"/);assert.match(html,/id="doc-year"/);assert.equal((html.match(/id="grid"/g)||[]).length,1);assert.doesNotMatch(html,/source-select|mobile\/app|microdramas/);}
  if(['/','/series','/anime','/documentales'].includes(path))assert.match(html,/class="web-catalog-filters" hidden/);assert.match(header,/aria-label="Buscar en todo"/);assert.match(html,/href="\/premium.css"/);
 }
});

import vm from 'node:vm';
test('recommendations retain only the current and previous year',async()=>{const ctx={Intl,Date};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(await readFile(new URL('../public/genre-shelves.js',import.meta.url),'utf8'),ctx);const result=ctx.CLBShelves.recent([{id:'now',year:2026},{id:'previous',year:'2025'},{id:'old',year:2024},{id:'future',year:2027},{id:'unknown'}],2026);assert.deepEqual(Array.from(result,item=>item.id),['now','previous']);});

test('Kids stays in primary navigation while saved list and adult access remain under More',()=>{const html=withWebHeader('<html><head></head><body><main></main></body></html>','/');const nav=html.match(/<nav aria-label="Secciones">(.*?)<\/nav>/s)[1],more=html.match(/<details class="header-more">(.*?)<\/details>/s)[1];assert.match(nav,/href="\/kids"/);assert.doesNotMatch(nav,/href="\/biblioteca"|href="\/adult"/);assert.match(more,/href="\/biblioteca"/);assert.match(more,/href="\/adult"/);});
