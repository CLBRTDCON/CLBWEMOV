import http from 'node:http';
import handler from './api/index.mjs';
const port=Number(process.env.PORT||4190);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('PORT inválido.');
http.createServer(handler).listen(port,'127.0.0.1',()=>console.log(`CLB Web: http://127.0.0.1:${port}`));
