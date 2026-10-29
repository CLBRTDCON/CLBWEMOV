import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../popup-guard/background.js',import.meta.url),'utf8');
function guard(initialEnabled=true) {
  let settings={enabled:initialEnabled}; const listeners={},removed=[],parents=new Map(),badges=[];
  const event=name=>({addListener(fn){listeners[name]=fn;}});
  const chrome={storage:{local:{async get(){return settings;},async set(value){settings={...settings,...value};}}},tabs:{onCreated:event('created'),async get(id){return parents.get(id)||{};},async remove(id){removed.push(id);}},action:{onClicked:event('clicked'),async setBadgeText(data){badges.push(data.text);},async setBadgeBackgroundColor(){},async setTitle(){}},runtime:{onInstalled:event('installed'),onStartup:event('startup')}};
  vm.runInNewContext(source,{chrome,URL,console});return {listeners,removed,parents,badges};
}
test('cierra pestañas de la app y deja intactas pestañas ajenas o sin abridor',async()=> {
  const g=guard();
  g.parents.set(1,{url:'http://127.0.0.1:4173/series'});
  g.parents.set(2,{url:'http://localhost:4173/anime'});
  g.parents.set(3,{url:'https://example.com/'});
  g.parents.set(4,{url:'http://127.0.0.1:9999/'});
  g.parents.set(5,{url:'http://localhost.evil.example:4173/'});
  for(let i=1;i<=6;i++)await g.listeners.created({id:100+i,openerTabId:i});
  await g.listeners.created({id:200});
  assert.deepEqual(g.removed,[101,102]);
});
test('OFF persiste al reiniciar y el botón vuelve a activar el cierre',async()=> {
  const g=guard(false);g.parents.set(1,{url:'http://127.0.0.1:4173/'});
  await g.listeners.startup();assert.equal(g.badges.at(-1),'OFF');
  await g.listeners.created({id:2,openerTabId:1});assert.equal(g.removed.length,0);
  await g.listeners.clicked();assert.equal(g.badges.at(-1),'ON');
  await g.listeners.created({id:3,openerTabId:1});assert.deepEqual(g.removed,[3]);
});
test('manifiesto no pide permisos globales de pestañas ni sitios externos',async()=> {
  const manifest=JSON.parse(await readFile(new URL('../popup-guard/manifest.json',import.meta.url),'utf8'));
  assert.equal(manifest.manifest_version,3);
  assert.deepEqual(manifest.permissions,['storage']);
  assert.deepEqual(manifest.host_permissions,['http://127.0.0.1:4173/*','http://localhost:4173/*']);
});
