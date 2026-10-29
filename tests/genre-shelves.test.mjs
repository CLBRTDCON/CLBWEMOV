import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/genre-shelves.js';
test('CLB: clasifica títulos en todos sus géneros sin duplicarlos dentro de una fila',()=>{
  const a={id:'a',genres:['Action','Adventure','Action']},b={id:'b',genres:['Action']};
  const rows=CLBShelves.groups([a,b,a],{Action:'Acción',Adventure:'Aventura'});
  assert.deepEqual(rows.map(r=>r.name),['Acción','Aventura']);assert.deepEqual(rows[0].items.map(i=>i.id),['a','b']);assert.deepEqual(rows[1].items.map(i=>i.id),['a']);
  assert.deepEqual(a.genres,['Action','Adventure','Action']);
});
test('CLB: no inventa género para fichas incompletas y admite etiquetas ya traducidas',()=>{
  const rows=CLBShelves.groups([{id:1,genres:['Comedia']},{id:2,genres:[]},{id:3},{id:4,genres:[null,' ',33]}]);
  assert.deepEqual(rows.map(r=>r.name),['Comedia','Por descubrir']);assert.equal(rows[1].items.length,3);
});
test('CLB: paginación conserva todos los IDs únicos y agrupa el nuevo contenido',()=>{
  const first=Array.from({length:48},(_,id)=>({id,genres:['Drama']}));
  const next=Array.from({length:48},(_,id)=>({id:id+40,genres:['Drama','Comedia']}));
  const rows=CLBShelves.groups([...first,...next]);assert.equal(rows.find(r=>r.name==='Drama').items.length,88);assert.equal(rows.find(r=>r.name==='Comedia').items.length,48);
});
