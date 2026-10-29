import {requestHandler} from '../server.mjs';
export default async function handler(req,res){
 try{await requestHandler(req,res);}catch{
  if(res.headersSent){res.end();return;}
  res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
  res.end('No se pudo completar la solicitud.');
 }
}
