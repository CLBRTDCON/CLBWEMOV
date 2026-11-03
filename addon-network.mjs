import http from 'node:http';
import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {BlockList,isIP} from 'node:net';

const denied=new BlockList();
for(const [ip,bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]])denied.addSubnet(ip,bits,'ipv4');
const global6=new BlockList();global6.addSubnet('2000::',3,'ipv6');
for(const [ip,bits] of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]])denied.addSubnet(ip,bits,'ipv6');
export function publicAddress(ip){const family=isIP(ip);return family===4?!denied.check(ip,'ipv4'):family===6&&global6.check(ip,'ipv6')&&!denied.check(ip,'ipv6');}
export function remoteURL(value,{httpsOnly=false}={}){let u;try{u=new URL(value);}catch{throw Error('Dirección del complemento inválida.');}if(!(httpsOnly?u.protocol==='https:':['https:','http:'].includes(u.protocol))||u.username||u.password||u.port||u.hash||u.href.length>8192||isIP(u.hostname.replace(/^\[|\]$/g,''))||!u.hostname.includes('.')||u.hostname.endsWith('.local'))throw Error('Solo se admiten dominios públicos, sin credenciales ni puertos especiales.');return u;}
// Resolve every hop and pin its address in the socket lookup; DNS rebinding cannot
// turn an approved hostname into localhost between validation and connection.
export async function publicRequest(value,{method='GET',headers={},signal,httpsOnly=false,resolver=lookup}={}){
 let url=remoteURL(value,{httpsOnly});
 for(let hop=0;hop<5;hop++){
  let timer;let addresses;try{addresses=await Promise.race([resolver(url.hostname,{all:true,verbatim:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('DNS del proveedor sin respuesta.')),10000);timer.unref();})]);}finally{clearTimeout(timer);}
  if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error('El proveedor apunta a una red no permitida.');
  signal?.throwIfAborted();
  const picked=addresses.find(a=>a.family===4)||addresses[0];
  const response=await new Promise((resolve,reject)=>{
   const req=(url.protocol==='https:'?https:http).request(url,{method,headers,signal,agent:false,lookup:(_host,options,callback)=>options?.all?callback(null,[picked]):callback(null,picked.address,picked.family)},resolve);
   req.setTimeout(20000,()=>req.destroy(Error('El proveedor dejó de responder.')));req.once('error',reject);req.end();
  });
  if([301,302,303,307,308].includes(response.statusCode)){
   const location=response.headers.location;response.destroy();if(!location)throw Error('Redirección sin destino.');url=remoteURL(new URL(location,url).href,{httpsOnly});continue;
  }
  return {response,url};
 }
 throw Error('Demasiadas redirecciones del proveedor.');
}
export async function readLimited(response,limit=2_000_000){let size=0;const chunks=[];try{for await(const part of response){size+=part.length;if(size>limit)throw Error('Respuesta del proveedor demasiado grande.');chunks.push(part);}return Buffer.concat(chunks);}catch(error){response.destroy();throw error;}}
