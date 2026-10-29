import {createHash,timingSafeEqual} from 'node:crypto';
const digest=value=>createHash('sha256').update(value).digest();
const equal=(a,b)=>timingSafeEqual(digest(a),digest(b));
export function serveAccess(req,res,env=process.env){
 const deployed=env.VERCEL==='1';
 const hosts=new Set(deployed?[]:['127.0.0.1:'+String(env.PORT||4190),'localhost:'+String(env.PORT||4190)]);
 for(const value of [env.VERCEL_URL,env.VERCEL_BRANCH_URL,env.VERCEL_PROJECT_PRODUCTION_URL,...(env.CLB_ALLOWED_HOSTS||'').split(',')]){
  const host=String(value||'').trim().toLowerCase();if(/^[a-z0-9.-]+(?::\d{1,5})?$/.test(host))hosts.add(host);
 }
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(!hosts.has(String(req.headers.host||'').toLowerCase())){res.writeHead(403);res.end('Host no permitido');return false;}
 const user=env.CLB_ACCESS_USER,password=env.CLB_ACCESS_PASSWORD;
 if(deployed&&(!user||!password)){
  res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'});
  res.end('Falta configurar el acceso privado de CLB en Vercel.');return false;
 }
 if(user||password){
  const auth=req.headers.authorization;let valid=false;
  if(typeof auth==='string'&&auth.length<4096&&/^Basic [A-Za-z0-9+/]+=*$/i.test(auth)){
   const text=Buffer.from(auth.slice(6),'base64').toString('utf8'),colon=text.indexOf(':');
   if(colon>=0&&user&&password)valid=equal(text.slice(0,colon),user)&&equal(text.slice(colon+1),password);
  }
  if(!valid){res.writeHead(401,{'WWW-Authenticate':'Basic realm="CLB", charset="UTF-8"','Content-Type':'text/plain; charset=utf-8'});res.end('Acceso privado.');return false;}
 }
 // Even authenticated responses must never be cached for another visitor.
 const writeHead=res.writeHead;
 res.writeHead=function(status,...args){
  if(args[0]&&typeof args[0]==='object')args[0]={...args[0],'Cache-Control':'private, no-store'};
  this.setHeader('Cache-Control','private, no-store');return writeHead.call(this,status,...args);
 };
 return true;
}
