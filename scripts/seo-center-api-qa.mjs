import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {once} from 'node:events';
import path from 'node:path';
import os from 'node:os';
const data=await mkdtemp(path.join(os.tmpdir(),'donghan-seo-api-qa-'));
const origin='http://127.0.0.1:4189',base=origin+'/donghan';
const password='isolated-seo-api-test-password',env={...process.env,DATA_ROOT:data,PORT:'4189',PUBLIC_URL:origin,BASE_PATH:'/donghan',ADMIN_PATH:'/uguest',INITIAL_ADMIN_PASSWORD:password};
delete env.ASSET_ROOT;delete env.SEO_PROXY_PORT;
execFileSync(process.execPath,['server/setup.mjs'],{env,stdio:'ignore'});
const child=spawn(process.execPath,['server/runtime.mjs'],{env,stdio:['ignore','pipe','pipe']});let logs='';child.stderr.on('data',b=>logs+=b);child.stdout.on('data',b=>logs+=b);
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/healthz')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready,logs);
 for(const method of ['GET','POST']){const r=await fetch(base+'/api/admin/seo'+(method==='POST'?'/run':''),{method});assert.equal(r.status,401);assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');}
 const login=await fetch(base+'/uguest/login',{method:'POST',headers:{Origin:origin},body:new URLSearchParams({username:'admin',password}),redirect:'manual'});assert.equal(login.status,303);const cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await fetch(base+'/api/admin/seo/run',{method:'POST',headers:{Cookie:cookie,Origin:'https://attacker.invalid'}})).status,403);
 assert.equal((await fetch(base+'/api/admin/seo/run',{method:'POST',headers:{Cookie:cookie}})).status,403);
 const headers={Cookie:cookie,Origin:origin};assert.equal((await fetch(base+'/api/admin/seo/run',{method:'POST',headers})).status,202);
 let result;for(let i=0;i<200;i++){result=await (await fetch(base+'/api/admin/seo',{headers})).json();if(result.runs[0]?.finished_at)break;await new Promise(r=>setTimeout(r,50));}
 assert.equal(result.runs[0].summary.pages,187);assert.equal(result.runs[0].summary.errors,0);assert.ok(result.actions.length>=3);
 assert.ok(result.pages.every(p=>new URL(p.url).origin===origin));
 const admin=await (await fetch(base+'/uguest/',{headers})).text();assert.ok(admin.includes('SEO 中心'));assert.ok(admin.includes('/donghan/uguest/seo.js?v=20261015-seo-center'));
 const before=result.daily.reduce((n,r)=>n+r.count,0);await fetch(base+'/',{headers:{Cookie:cookie,'User-Agent':'Mozilla/5.0'}});await fetch(base+'/',{headers:{'User-Agent':'DonghanSEO/1.0'}});
 result=await (await fetch(base+'/api/admin/seo',{headers})).json();assert.equal(result.daily.reduce((n,r)=>n+r.count,0),before);
 const robots=await (await fetch(base+'/robots.txt')).text();assert.ok(robots.includes('Disallow: /donghan/api/'));
 console.log(JSON.stringify({passed:true,canonicalPages:187,authentication:'protected',csrf:'protected',backgroundRun:'completed',metadataErrors:0,adminAssets:'mounted and cache-versioned',privateTraffic:'excluded'}));
}finally{child.kill('SIGTERM');await once(child,'exit');await rm(data,{recursive:true,force:true});}
