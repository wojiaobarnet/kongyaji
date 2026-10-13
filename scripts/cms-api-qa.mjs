import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adminIdentity } from '../worker/cms.js';
const base='http://127.0.0.1:4173';
const protectedEnv={CMS_ADMIN_EMAIL:'owner@example.test'};
assert.equal(adminIdentity(new Request('https://site.example/admin/'),protectedEnv),null);
assert.equal(adminIdentity(new Request('https://site.example/admin/',{headers:{'oai-authenticated-user-email':'visitor@example.test'}}),protectedEnv),null);
assert.ok(adminIdentity(new Request('https://site.example/admin/',{headers:{'oai-authenticated-user-email':'owner@example.test'}}),protectedEnv));
assert.equal(adminIdentity(new Request('https://site.example/admin/'),{CMS_LOCAL_DEV:'1'}),null);
const request=async(action,data,expected=200)=>{
 const r=await fetch(base+'/api/admin/'+action,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
 const result=await r.json();assert.equal(r.status,expected,JSON.stringify(result));return result;
};
const list=await request('documents');assert.ok(list.documents.length>=180);
const original=list.documents.find(d=>d.desktop==='/news/enterprise/2026-08-19/161.html');
let originalDoc=await request('document?id='+original.id);
const initial=structuredClone(originalDoc.document);
const first=structuredClone(initial);first.meta.title='后台验收 · 新闻标题';first.meta.description='后台修改摘要验收';
first.blocks.body.value='<h2>后台验收正文</h2><p>电脑和手机共用正文。</p><script>alert(1)</script><img src="/public/images/logo.png" onerror="alert(1)">';
let r=await request('draft',{id:original.id,document:first,revision:originalDoc.revision});let revision=r.revision;
assert.ok(!(await (await fetch(base+original.desktop)).text()).includes('后台验收正文'));
await request('draft',{id:original.id,document:first,revision:originalDoc.revision},409);
const preview=await (await fetch(base+'/api/admin/preview?id='+original.id)).text();assert.ok(preview.includes('后台验收正文'));assert.ok(!preview.includes('alert(1)'));
await request('publish',{id:original.id,revision});
for(const path of [original.desktop,original.mobile,'/news/enterprise/','/mobile/listinfo-8-0.html']){
 const html=await (await fetch(base+path)).text();assert.ok(html.includes('后台验收 · 新闻标题'),path);
 if(path===original.desktop||path===original.mobile){assert.ok(html.includes('后台验收正文'));assert.ok(!html.includes('alert(1)'));}
}
const second=structuredClone(first);second.meta.title='后台验收 · 第二版';r=await request('draft',{id:original.id,document:second,revision});revision=r.revision;await request('publish',{id:original.id,revision});
const history=await request('history?id='+original.id);assert.ok(history.revisions.length>=2);
r=await request('restore',{id:original.id,historyId:history.revisions.find(v=>v.revision===revision-1).id,revision});revision=r.revision;
await request('publish',{id:original.id,revision});assert.ok((await (await fetch(base+original.desktop)).text()).includes('后台验收 · 新闻标题'));
r=await request('draft',{id:original.id,document:initial,revision});await request('publish',{id:original.id,revision:r.revision});
const create=await request('create',{title:'新建新闻验收',templateId:original.id},201);
let newDoc=await request('document?id='+create.id);
assert.equal((await fetch(base+newDoc.document.meta.desktop)).status,404);
newDoc.document.blocks.body.value='<p>这是新增新闻的正文。</p>';
r=await request('draft',{id:create.id,document:newDoc.document,revision:newDoc.revision});await request('publish',{id:create.id,revision:r.revision});
assert.ok((await (await fetch(base+'/news/enterprise/')).text()).includes('新建新闻验收'));
assert.ok((await (await fetch(base+newDoc.document.meta.desktop)).text()).includes('这是新增新闻的正文。'));
assert.ok((await (await fetch(base+newDoc.document.meta.mobile)).text()).includes('这是新增新闻的正文。'));
newDoc=await request('document?id='+create.id);newDoc.document.meta.hidden=true;r=await request('draft',{id:create.id,document:newDoc.document,revision:newDoc.revision});await request('publish',{id:create.id,revision:r.revision});
assert.equal((await fetch(base+newDoc.document.meta.desktop)).status,404);
assert.ok(!(await (await fetch(base+'/news/enterprise/')).text()).includes('新建新闻验收'));
const file=await readFile('source/desktop/public/images/logo.png');const form=new FormData();form.set('file',new Blob([file],{type:'image/png'}),'验收.png');
let response=await fetch(base+'/api/admin/upload',{method:'POST',body:form});assert.equal(response.status,201);const uploaded=await response.json();response=await fetch(base+uploaded.url);assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/png');assert.deepEqual(Buffer.from(await response.arrayBuffer()),file);
const badForm=new FormData();badForm.set('file',new Blob(['<svg onload="alert(1)"></svg>'],{type:'image/svg+xml'}),'bad.svg');assert.equal((await fetch(base+'/api/admin/upload',{method:'POST',body:badForm})).status,400);
response=await fetch(base+'/api/admin/draft',{method:'POST',headers:{Origin:'https://foreign.example','Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403);
const settings=await request('document?id=settings');const changed=structuredClone(settings.document);changed.values.company='后台验收公司';changed.values.phone='13800138000';
r=await request('draft',{id:'settings',document:changed,revision:settings.revision});await request('publish',{id:'settings',revision:r.revision});
for(const path of ['/','/mobile/','/contact/']){const html=await (await fetch(base+path)).text();assert.ok(html.includes('后台验收公司'));assert.ok(html.includes('13800138000'));assert.ok(html.includes('index.js')||html.includes('app.js'));}
const settingsAgain=await request('document?id=settings');r=await request('draft',{id:'settings',document:settings.document,revision:settingsAgain.revision});await request('publish',{id:'settings',revision:r.revision});
const id=crypto.randomUUID();response=await fetch(base+'/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,name:'后台留言验收',phone:'13900000000',message:'咨询跟进验收',source:'desktop'})});assert.equal(response.status,200);
await request('inquiry',{id,status:'handled',note:'已电话沟通'});const inquiries=await request('inquiries');assert.equal(inquiries.inquiries.find(x=>x.id===id).note,'已电话沟通');
const csv=await (await fetch(base+'/api/admin/export')).text();assert.ok(csv.includes('已电话沟通'));
console.log(JSON.stringify({documents:list.documents.length,auth:'passed',draftIsolation:'passed',publicationBothDevices:'passed',concurrency:'passed',sanitization:'passed',history:'passed',newContent:'passed',hiddenContent:'passed',uploads:'passed',settings:'passed',inquiries:'passed'}));
