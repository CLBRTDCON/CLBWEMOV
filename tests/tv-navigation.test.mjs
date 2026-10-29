import test from 'node:test';
import assert from 'node:assert/strict';
import {nextFocus,contentNeighbor} from '../mobile/tv-navigation.mjs';
const item=(name,x,y,w=100,h=100)=>({name,rect:{left:x,top:y,right:x+w,bottom:y+h}});
test('TV: borde izquierdo vuelve a la sección activa independientemente de la altura',()=>{
 const active={id:'series'},first=item('reality',300,12000),second=item('next',510,12000);first.element={id:'first'};second.element={id:'second'};
 assert.equal(contentNeighbor(first,[first,second],'left',active),active);
 assert.equal(contentNeighbor(second,[first,second],'left',active),first.element);
 assert.equal(contentNeighbor(second,[first,second],'right',active),undefined);
});
test('TV: flechas eligen vecino alineado y no saltan a controles de otra fila',()=>{
 const center=item('center',100,100),left=item('left',0,100),right=item('right',210,100),up=item('up',100,0),down=item('down',100,210),diagonal=item('diagonal',205,205);
 const items=[center,left,right,up,down,diagonal];
 assert.equal(nextFocus(center,items,'left'),left);assert.equal(nextFocus(center,items,'right'),right);
 assert.equal(nextFocus(center,items,'up'),up);assert.equal(nextFocus(center,items,'down'),down);
 assert.equal(nextFocus(left,[left,center],'left'),undefined);
});
test('TV: admite tarjetas de dimensiones distintas y conserva dirección correcta',()=>{
 const current=item('card',300,400,180,300),header=item('header',0,0,700,60),next=item('next row',320,750,180,300),offRow=item('distant',1200,710,180,300);
 assert.equal(nextFocus(current,[current,header,next,offRow],'down'),next);
 assert.equal(nextFocus(current,[current,header,next,offRow],'up'),header);
});
