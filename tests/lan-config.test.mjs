import test from 'node:test';
import assert from 'node:assert/strict';
import {lanConfiguration} from '../lan-config.mjs';
const interfaces={wifi:[{address:'10.10.21.14',internal:false}],virtual:[{address:'172.28.34.10',internal:false}]};
test('LAN: modo local por defecto y lista explícita de hosts al compartir',()=>{
 const local=lanConfiguration(undefined,interfaces);assert.equal(local.lanHost,null);assert.deepEqual([...local.allowedHosts],['localhost:4173','127.0.0.1:4173']);
 const lan=lanConfiguration('10.10.21.14',interfaces);assert.equal(lan.lanHost,'10.10.21.14');assert.ok(lan.allowedHosts.has('10.10.21.14:4173'));assert.equal(lan.allowedHosts.has('172.28.34.10:4173'),false);assert.equal(lan.allowedHosts.has('attacker.invalid:4173'),false);
});
test('LAN: rechaza interfaces inexistentes, comodines, loopback y direcciones públicas',()=>{
 for(const host of ['0.0.0.0','127.0.0.1','10.10.21.99','example.com','8.8.8.8','::'])assert.throws(()=>lanConfiguration(host,interfaces));
 assert.throws(()=>lanConfiguration('8.8.8.8',{external:[{address:'8.8.8.8',internal:false}]}));
});
