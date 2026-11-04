import {randomBytes,randomUUID,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {fileAccessStore,redisAccessStore} from './access-store.mjs';
const scrypt=promisify(scryptCallback),DAY=86400000;
const hash=s=>createHash('sha256').update(s).digest('hex');
export async function passwordHash(password){const salt=randomBytes(16).toString('hex');return salt+':'+Buffer.from(await scrypt(password,salt,64)).toString('hex');}
async function validPassword(password,encoded){if(!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(encoded||''))return false;const [salt,expected]=encoded.split(':');return timingSafeEqual(Buffer.from(await scrypt(password,salt,64)),Buffer.from(expected,'hex'));}
export function createAccessApi({env=process.env,now=Date.now,store}={}){
 const deployed=env.VERCEL==='1';
 if(!store){if(deployed){if((env.UPSTASH_REDIS_REST_URL||env.KV_REST_API_URL||env.clbweb_KV_REST_API_URL)&&(env.UPSTASH_REDIS_REST_TOKEN||env.KV_REST_API_TOKEN||env.clbweb_KV_REST_API_TOKEN))store=redisAccessStore({url:env.UPSTASH_REDIS_REST_URL||env.KV_REST_API_URL||env.clbweb_KV_REST_API_URL,token:env.UPSTASH_REDIS_REST_TOKEN||env.KV_REST_API_TOKEN||env.clbweb_KV_REST_API_TOKEN});}else store=fileAccessStore();}
 const cookies={admin:'clb_admin',viewer:'clb_access'};
 function cookie(req,role){const value=String(req.headers.cookie||'').split(';').map(p=>p.trim()).find(p=>p.startsWith(cookies[role]+'='))?.slice(cookies[role].length+1);return /^[a-f0-9]{64}$/.test(value||'')?hash(value):null;}
 function setCookie(res,role,value,seconds){res.setHeader('Set-Cookie',`${cookies[role]}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${seconds}${deployed?'; Secure':''}`);}
 async function transaction(fn){if(!store)throw Error('storage');return store.update(data=>{data.accounts||={};for(const group of ['codes','sessions','attempts']){data[group]||={};for(const [id,v]of Object.entries(data[group]))if(v.expires<=now())delete data[group][id];}return fn(data);});}
 function viewerAccount(data,value){if(value.role!=='viewer')return true;const account=data.accounts?.[value.accountId];return account&&!account.disabled&&account.expires>now();}
 function migrate(data){data.accounts||={};for(const c of Object.values(data.codes)){if(c.accountId)continue;c.accountId=c.id;c.maxDevices=1;c.redemptions=c.used?1:0;data.accounts[c.id]||={id:c.id,label:c.label||'Mi cuenta',maxDevices:1,created:c.created,expires:null,activations:c.used?1:0};}for(const value of Object.values(data.sessions)){if(value.role!=='viewer'||value.accountId)continue;const id=value.codeId||randomUUID();value.accountId=id;value.deviceId=randomUUID();value.platform='legacy';data.accounts[id]||={id,label:value.label||'Mi cuenta',maxDevices:1,created:value.created,expires:value.expires,activations:1};data.accounts[id].expires=Math.max(data.accounts[id].expires||0,value.expires);}}
 async function session(req,role='viewer'){const id=cookie(req,role);if(!id)return null;let data=store?.read?await store.read():await transaction(d=>d);if(data.sessions?.[id]?.role==='viewer'&&!data.sessions[id].accountId){await transaction(d=>{migrate(d);});data=store?.read?await store.read():await transaction(d=>d);}const value=data.sessions?.[id];return value?.role===role&&value.expires>now()&&viewerAccount(data,value)?{...value,id}:null;}

 async function authorize(req,res,role='viewer'){try{const value=await session(req,role);if(value){req.clbAccess=value;return value;}}catch{res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'El servicio de accesos no está disponible.'}));return null;}res.writeHead(401,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:role==='admin'?'Inicia sesión en Administración.':'Activa este dispositivo para acceder a Latinobrid.',activationRequired:true}));return null;}
 async function issue(req,res,role,label,codeId){const token=randomBytes(32).toString('hex'),expires=now()+(role==='admin'?8*3600000:30*DAY);await transaction(data=>{if(Object.keys(data.sessions).length>=200)throw Error('capacity');data.sessions[hash(token)]={role,label,codeId,created:now(),expires};});setCookie(res,role,token,Math.floor((expires-now())/1000));return expires;}
 async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>4096)throw Error('input');}return JSON.parse(text);}
 async function api(req,res){let status=200,result;const action=new URL(req.url,'http://local').pathname.split('/').at(-1);
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  try{
   if(!store||deployed&&!env.CLB_ADMIN_PASSWORD_HASH){status=503;throw Error('notConfigured');}
   if(req.method==='POST'){
    const host=String(req.headers.host||'');const expected=(deployed?'https://':'http://')+host;
    if(req.headers.origin!==expected||!String(req.headers['content-type']).startsWith('application/json')){status=403;throw Error('origin');}
   }else if(req.method!=='GET'||action!=='status'){status=405;throw Error('method');}
   if(action==='status'){const admin=await session(req,'admin'),viewer=await session(req);result={setupRequired:!deployed&&await transaction(d=>!d.adminHash),admin:!!admin,authorized:!!viewer,expires:viewer?.expires||null,account:viewer?await transaction(d=>{const a=d.accounts[viewer.accountId];return {id:a.id,label:a.label,maxDevices:a.maxDevices,activeDevices:Object.values(d.sessions).filter(s=>s.role==='viewer'&&s.accountId===a.id).length};}):null};}
   else{
    const input=await body(req);
    if(['setup','login','redeem'].includes(action)){
     const allowed=await transaction(d=>{const limit=action==='redeem'?30:10;const bucket=action==='redeem'?'redeem':'login';const value=d.attempts[bucket]||{count:0,expires:now()+10*60000};value.count++;d.attempts[bucket]=value;return value.count<=limit;});if(!allowed){status=429;throw Error('rate');}
    }
    if(action==='setup'){
     if(deployed||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)){status=403;throw Error('origin');}
     if(typeof input.password!=='string'||input.password.length<8||input.password.length>128){status=400;throw Error('password');}
     const encoded=await passwordHash(input.password);const saved=await transaction(d=>{if(d.adminHash)return false;d.adminHash=encoded;return true;});if(!saved){status=409;throw Error('setup');}await issue(req,res,'admin','Administración');result={ok:true};
    }else if(action==='login'){
     const encoded=deployed?env.CLB_ADMIN_PASSWORD_HASH:await transaction(d=>d.adminHash);
     if(typeof input.password!=='string'||input.password.length>128||!await validPassword(input.password,encoded)){status=401;throw Error('login');}await issue(req,res,'admin','Administración');result={ok:true};
    }else if(action==='redeem'){
     const code=String(input.code||'').toUpperCase().replace(/[\s-]/g,'');const label=typeof input.label==='string'?input.label.trim().slice(0,60):'';
     if(!/^[A-HJ-NP-Z2-9]{10}$/.test(code)||!label){status=400;throw Error('code');}
     const token=randomBytes(32).toString('hex'),tokenId=hash(token),existingId=cookie(req,'viewer');
     const requestedDevice=typeof input.deviceId==='string'&&/^[a-f0-9-]{32,36}$/i.test(input.deviceId)?input.deviceId:randomUUID(),platform=['web','android','tv'].includes(input.platform)?input.platform:'web';
     const accepted=await transaction(d=>{migrate(d);const c=d.codes[hash(code)];if(!c||c.revoked)throw Error('code');const account=d.accounts[c.accountId];if(!account||account.disabled)throw Error('code');
      const previous=d.sessions[existingId];if(previous?.accountId===account.id&&previous.expires>now())return {expires:previous.expires,accountId:account.id,reused:true};
      if(c.used)throw Error('code');const active=Object.values(d.sessions).filter(s=>s.role==='viewer'&&s.accountId===account.id&&s.expires>now());if(active.length>=account.maxDevices)throw Error('deviceLimit');
      if(Object.keys(d.sessions).length>=200)throw Error('capacity');
      if(!account.expires||account.expires<=now())account.expires=now()+30*DAY;
      c.activatedAt||=now();c.expires=account.maxDevices>1?account.expires:c.expires;c.redemptions=(c.redemptions||0)+1;c.used=account.maxDevices===1;
      // A browser installation ID is not proof of an existing session: only its cookie avoids a new slot.
      d.sessions[tokenId]={role:'viewer',label,codeId:c.id,accountId:account.id,deviceId:requestedDevice,platform,created:now(),expires:account.expires};account.activations=(account.activations||0)+1;
      return {expires:account.expires,accountId:account.id,reused:false};
     });
     if(!accepted.reused)setCookie(res,'viewer',token,Math.max(1,Math.floor((accepted.expires-now())/1000)));result={ok:true,...accepted};
    }else if(action==='logout'){setCookie(res,input.admin?'admin':'viewer','',0);const id=cookie(req,input.admin?'admin':'viewer');if(id)await transaction(d=>delete d.sessions[id]);result={ok:true};}
    else{
     if(!await authorize(req,res,'admin'))return;
     if(action==='create'){
      const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',code=Array.from(randomBytes(10),b=>alphabet[b%32]).join(''),id=randomUUID(),expires=now()+10*60000;
      const label=String(input.label||'Mi cuenta').trim().slice(0,60),maxDevices=input.maxDevices===undefined?1:Number(input.maxDevices);
      if(!Number.isInteger(maxDevices)||maxDevices<1||maxDevices>10){status=400;throw Error('devices');}
      if(input.accountId&&!/^[a-f0-9-]{36}$/i.test(input.accountId)){status=400;throw Error('account');}const accountId=input.accountId||randomUUID();
      await transaction(d=>{migrate(d);if(Object.keys(d.codes).length>=100||Object.keys(d.accounts).length>=200&&!d.accounts[accountId])throw Error('capacity');if(input.accountId&&!Object.hasOwn(d.accounts,accountId))throw Error('account');const a=d.accounts[accountId]||{id:accountId,label,created:now(),expires:null,activations:0};const active=Object.values(d.sessions).filter(s=>s.role==='viewer'&&s.accountId===accountId).length;if(maxDevices<active)throw Error('activeLimit');a.label=label;a.maxDevices=maxDevices;a.disabled=false;d.accounts[accountId]=a;d.codes[hash(code)]={id,accountId,label,created:now(),expires,used:false,maxDevices,redemptions:0};});result={code:code.slice(0,5)+'-'+code.slice(5),expires,accessDays:30,accountId,maxDevices};
     }else if(action==='list')result=await transaction(d=>{migrate(d);return {codes:Object.values(d.codes).map(({id,label,expires,used,accountId,redemptions=0})=>({id,label,expires,used,accountId,redemptions,maxDevices:d.accounts[accountId]?.maxDevices||1})),accounts:Object.values(d.accounts).map(a=>({...a,activeDevices:Object.values(d.sessions).filter(s=>s.role==='viewer'&&s.accountId===a.id).length})),devices:Object.entries(d.sessions).filter(([,s])=>s.role==='viewer').map(([id,{label,created,expires,accountId,platform}])=>({id,label,created,expires,accountId,platform}))};});
     else if(action==='revoke'){await transaction(d=>{if(typeof input.id!=='string')return;const s=d.sessions[input.id];if(s?.role==='viewer')delete d.sessions[input.id];for(const [key,c]of Object.entries(d.codes))if(c.id===input.id)delete d.codes[key];if(input.account===true&&Object.hasOwn(d.accounts,input.id)){d.accounts[input.id].disabled=true;for(const [key,s]of Object.entries(d.sessions))if(s.accountId===input.id)delete d.sessions[key];for(const [key,c]of Object.entries(d.codes))if(c.accountId===input.id)delete d.codes[key];}});result={ok:true};}
     else{status=404;throw Error('route');}
    }
   }
  }catch(e){const messages={notConfigured:'Falta configurar el almacenamiento y el administrador de accesos.',origin:'Solicitud no permitida.',password:'Usa una contraseña de entre 8 y 128 caracteres.',setup:'La administración ya está configurada.',login:'Contraseña incorrecta.',rate:'Demasiados intentos. Espera diez minutos.',code:'Código inválido o vencido. Escribe también el nombre del dispositivo.',devices:'Elige entre 1 y 10 dispositivos.',deviceLimit:'Esta cuenta alcanzó su límite de dispositivos. Desvincula uno desde Administración.',activeLimit:'El cupo no puede ser menor que los dispositivos activos.',account:'La cuenta ya no existe.',capacity:'Límite de accesos alcanzado.'};if(status===200)status=['code','deviceLimit','devices','activeLimit','account'].includes(e.message)?400:503;result={error:messages[e.message]||'No se pudo completar la operación. Reintenta.'};}
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(result));
 }
 return {api,authorize,session};
}
