import {remoteURL} from './addon-network.mjs';
// Observed direct-video domain; DNS and every redirect remain checked by publicRequest.
export function deepflixHost(value){try{const u=remoteURL(value);return u.hostname.endsWith('.swzablvpm.com');}catch{return false;}}
export const deepflixSecret=config=>config.latinobrid?'deepflix-relay:'+config.latinobrid:null;
