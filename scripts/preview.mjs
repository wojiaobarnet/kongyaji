import { copyFile, mkdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
await mkdir('dist/server',{recursive:true});
try{await copyFile('.dev.vars','dist/server/.dev.vars');}catch(error){if(error.code!=='ENOENT')throw error;await rm('dist/server/.dev.vars',{force:true});}
const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--ip','127.0.0.1','--persist-to','.wrangler/state',...process.argv.slice(2)],{stdio:'inherit'});
process.on('SIGINT',()=>child.kill('SIGINT'));process.on('SIGTERM',()=>child.kill('SIGTERM'));child.on('exit',code=>process.exit(code||0));
