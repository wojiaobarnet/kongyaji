import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {once} from 'node:events';
import os from 'node:os';
import path from 'node:path';
const data=await mkdtemp(path.join(os.tmpdir(),'donghan-qa-'));
const origin='http://127.0.0.1:4175',base=origin+'/donghan',password='test-only-password-12',environment={...process.env,DATA_ROOT:data,PORT:'4175',BASE_PATH:'/donghan',PUBLIC_URL:origin,INITIAL_ADMIN_PASSWORD:password};
execFileSync(process.execPath,['server/setup.mjs'],{env:environment,stdio:'ignore'});
let child,logs='',cookie;
async function start(){child=spawn(process.execPath,['server/runtime.mjs'],{env:environment,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);for(let i=0;i<100;i++){try{if((await fetch(base+'/healthz')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error(logs);}
async function stop(){const done=once(child,'exit');child.kill('SIGTERM');await done;}
async function login(pass=password){const response=await fetch(base+'/admin/login',{method:'POST',redirect:'manual',headers:{Origin:origin},body:new URLSearchParams({username:'admin',password:pass})});assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/donghan/admin/');assert.ok(response.headers.get('set-cookie').includes('Path=/donghan/'));cookie=response.headers.get('set-cookie').split(';')[0];}
async function api(action,body,status=200,extra={}){const response=await fetch(base+'/api/admin/'+action,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json',Origin:origin}:{}),...extra},body:body?JSON.stringify(body):undefined});const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return result;}
try{
 await start();
 assert.equal((await fetch(base+'/admin/',{redirect:'manual'})).status,302);
 assert.equal((await fetch(base+'/api/admin/documents',{headers:{'oai-authenticated-user-email':'admin@donghan.local'}})).status,401);
 assert.equal((await fetch(base+'/cms/catalog.json')).status,404);
 assert.equal((await fetch(base+'/%63ms/catalog.json')).status,404);
 const home=await(await fetch(base+'/')).text();assert.ok(home.includes('/donghan/public/css/'));assert.ok(home.includes('/donghan/mobile/'));assert.ok(home.includes('/donghan/replica/site-path.js'));const css=await(await fetch(base+'/public/css/style.css')).text();assert.ok(css.includes('/donghan/public/images/'));await login();const session=await api('session');assert.equal(session.authMode,'password');
 const list=await api('documents');assert.equal(list.documents.length,186);assert.ok(list.documents.every(d=>!d.title.includes('开山')));
 const original=list.documents.find(d=>d.kind==='news');const created=await api('create',{templateId:original.id,title:'服务器发布验收',blank:true},201);let d=await api('document?id='+created.id);assert.ok(!d.document.meta.cover);assert.ok(d.document.blocks.body.value.includes('在这里'));
 d.document.blocks.body.value='<p>持久化正文</p><script>alert(1)</script>';const snapshot=await api('document?id='+created.id);
 const livePreview=await fetch(base+'/api/admin/preview',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({id:created.id,device:'mobile',document:d.document})});assert.equal(livePreview.status,200);const previewHtml=await livePreview.text();assert.ok(previewHtml.includes('持久化正文'));assert.ok(!previewHtml.includes('alert(1)'));assert.equal((await api('document?id='+created.id)).revision,snapshot.revision);
 const saved=await api('draft',{id:created.id,document:d.document,revision:d.revision});await api('draft',{id:created.id,document:d.document,revision:d.revision},409);await api('publish',{id:created.id,revision:saved.revision});
 for(const url of [d.document.meta.desktop,d.document.meta.mobile,'/news/enterprise/']){const html=await(await fetch(base+url)).text();assert.ok(html.includes('服务器发布验收'));if(url!== '/news/enterprise/')assert.ok(html.includes('持久化正文'));}
 const bytes=await readFile('source/desktop/public/images/logo.png');const form=new FormData();form.set('file',new Blob([bytes],{type:'image/png'}),'test.png');form.set('purpose','news');const upload=await fetch(base+'/api/admin/upload',{method:'POST',headers:{Cookie:cookie,Origin:origin},body:form});assert.equal(upload.status,201);const image=await upload.json();assert.ok(image.width>0&&image.height>0);
 const again=await fetch(base+'/api/admin/upload',{method:'POST',headers:{Cookie:cookie,Origin:origin},body:form});assert.equal(again.status,200);assert.equal((await again.json()).url,image.url);await api('media-update',{id:image.id,name:'新闻封面验收',purpose:'news'});
 await api('draft',{id:created.id,document:d.document,revision:saved.revision},403,{Origin:'https://other.example'});
 const inquiry=crypto.randomUUID();assert.equal((await fetch(base+'/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:inquiry,name:'服务器验收',phone:'13800000000',message:'持久化留言验收',source:'mobile'})})).status,200);
 await stop();await start();
 assert.ok((await(await fetch(base+d.document.meta.mobile)).text()).includes('持久化正文'));assert.deepEqual(Buffer.from(await(await fetch(base+image.url)).arrayBuffer()),bytes);assert.equal((await api('inquiries')).inquiries.find(v=>v.id===inquiry).name,'服务器验收');
 await api('password',{current:'wrong-password',password:'new-test-password-12'},400);const oldCookie=cookie;await api('password',{current:password,password:'new-test-password-12'});assert.equal((await fetch(base+'/api/admin/session',{headers:{Cookie:oldCookie}})).status,401);await login('new-test-password-12');await stop();await start();await login('new-test-password-12');
 const logout=await fetch(base+'/api/admin/logout',{method:'POST',headers:{Cookie:cookie,Origin:origin},redirect:'manual'});assert.equal(logout.status,303);assert.ok(logout.headers.get('set-cookie').includes('Max-Age=0'));
 console.log(JSON.stringify({authentication:'passed',spoofedHeader:'blocked',livePreview:'no database write',sqlite:'passed',bothDevices:'passed',mediaDeduplication:'passed',restartPersistence:'passed',passwordRotation:'passed'}));
}finally{if(child?.exitCode===null)await stop();await rm(data,{recursive:true,force:true});}
