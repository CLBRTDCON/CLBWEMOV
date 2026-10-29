import {isIP} from 'node:net';

// Escucha adicional opcional: solo una IPv4 privada asignada a este equipo.
export function lanConfiguration(address,interfaces){
 const allowedHosts=new Set(['localhost:4173','127.0.0.1:4173']);
 const lanHost=(address||'').trim();
 if(!lanHost)return {lanHost:null,allowedHosts};
 const parts=lanHost.split('.').map(Number);
 const privateAddress=isIP(lanHost)===4&&(parts[0]===10||(parts[0]===172&&parts[1]>=16&&parts[1]<=31)||(parts[0]===192&&parts[1]===168));
 const local=Object.values(interfaces).flat().some(entry=>entry&&!entry.internal&&entry.address===lanHost);
 if(!privateAddress||!local)throw new Error('CLB_LAN_ADDRESS debe ser una IPv4 privada asignada a este equipo.');
 allowedHosts.add(lanHost+':4173');
 return {lanHost,allowedHosts};
}
