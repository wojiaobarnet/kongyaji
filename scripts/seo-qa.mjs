import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {once} from 'node:events';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
const data=await mkdtemp(path.join(os.tmpdir(),'donghan-seo-qa-'));
const origin='http://127.0.0.1:4176',base=origin+'/donghan',password='test-only-password-12';
const environment={...process.env,DATA_ROOT:data,PORT:'4176',BASE_PATH:'/donghan',ADMIN_PATH:'/uguest',PUBLIC_URL:origin,INITIAL_ADMIN_PASSWORD:password};
execFileSync(process.execPath,['server/setup.mjs'],{env:environment,stdio:'ignore'});
const child=spawn(process.execPath,['server/runtime.mjs'],{env:environment,stdio:['ignore','pipe','pipe']});let logs='',cookie;
child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
const text=async url=>{const r=await fetch(base+url);assert.equal(r.status,200,url);return r.text();};
const canonical=html=>html.match(/<link rel="canonical" href="([^"]+)"/g)||[];
const api=async(action,body)=>{const r=await fetch(base+'/api/admin/'+action,{method:body?'POST':'GET',headers:{Cookie:cookie,Origin:origin,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});assert.equal(r.status,200,await r.clone().text());return r.json();};
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/healthz')).ok)break;}catch{}if(i===99)throw Error(logs);await new Promise(r=>setTimeout(r,100));}
 const catalog=JSON.parse(await readFile('dist/client/cms/catalog.json','utf8'));
 for(const meta of catalog.documents){
  for(const route of [meta.desktop,meta.mobile].filter(Boolean)){
   const html=await text(route+'?utm_source=qa&view=desktop');
   assert.deepEqual(canonical(html),[`<link rel="canonical" href="${base+meta.desktop}"`],route);
   assert.equal((html.match(/<title>/g)||[]).length,1,route);
   assert.equal((html.match(/name="description"/g)||[]).length,1,route);
   assert.ok(!html.includes('name="keywords"'),route);
   const graph=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
   assert.equal(graph['@graph'][1].url,base+meta.desktop);
   assert.ok(!JSON.stringify(graph).includes('aggregateRating'));
   if(route===meta.desktop&&meta.mobile)assert.ok(html.includes(`media="only screen and (max-width: 767px)" href="${base+meta.mobile}"`));
  }
 }
 const map=await text('/sitemap.xml');
 assert.equal((map.match(/<loc>/g)||[]).length,catalog.documents.length+1);
 assert.ok(!map.includes('<lastmod>2026-10-13</lastmod>')||map.includes(base+'/guide/'));
 assert.ok(!map.includes('/mobile/')&&!map.includes('/uguest')&&![...map.matchAll(/<loc>(.*?)<\/loc>/g)].some(m=>m[1].includes('?')));
 for(const [route,target]of Object.entries(catalog.aliases)){
  const r=await fetch(base+route,{redirect:'manual'});assert.equal(r.status,308,route);assert.equal(r.headers.get('location'),base+target,route);
 }
 for(const route of ['/index.html','/product/lgs/index.html']){const r=await fetch(base+route,{redirect:'manual'});assert.equal(r.status,308);}
 const robots=await text('/robots.txt');assert.ok(robots.includes('Sitemap: '+base+'/sitemap.xml'));assert.ok(robots.includes('Disallow: /donghan/uguest'));assert.ok(!robots.includes('Disallow: /\n'));
 const home=await text('/'),mobile=await text('/mobile/');for(const html of [home,mobile])assert.equal((html.match(/class="dh-guide-entry"/g)||[]).length,1);
 const guide=await text('/guide/');assert.deepEqual(canonical(guide),[`<link rel="canonical" href="${base}/guide/"`]);assert.ok(guide.includes('energy.gov/'));
 for(const route of ['/uguest/login','/api/admin/session','/cms/catalog.json','/missing-page.html','/healthz'])assert.equal((await fetch(base+route)).headers.get('x-robots-tag'),'noindex, nofollow');
 const login=await fetch(base+'/uguest/login',{method:'POST',redirect:'manual',headers:{Origin:origin},body:new URLSearchParams({username:'admin',password})});assert.equal(login.status,303);cookie=login.headers.get('set-cookie').split(';')[0];
 const original=catalog.documents.find(d=>d.kind==='news');
 const create=await fetch(base+'/api/admin/create',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({templateId:original.id,title:'SEO <脚本> 新内容',blank:true})});assert.equal(create.status,201);const created=await create.json();
 let d=await api('document?id='+created.id);const route=d.document.meta.desktop;
 assert.ok(!(await text('/sitemap.xml')).includes(base+route));
 d.document.meta.description='独立的已发布摘要，标题与摘要同步到手机端。';
 const draft=await api('draft',{id:created.id,document:d.document,revision:d.revision});
 assert.ok(!(await text('/sitemap.xml')).includes(base+route));
 await api('publish',{id:created.id,revision:draft.revision});
 const publishedMap=await text('/sitemap.xml'),entry=publishedMap.match(new RegExp('<url><loc>'+base+route.replaceAll('.','\\.')+'</loc>([\\s\\S]*?)</url>'))?.[1];
 assert.ok(entry?.includes('<lastmod>'));
 const publishedHtml=await text(route);assert.ok(publishedHtml.includes('content="独立的已发布摘要'));assert.ok(!publishedHtml.includes('<脚本>'));assert.deepEqual(canonical(publishedHtml),[`<link rel="canonical" href="${base+route}"`]);
 d=await api('document?id='+created.id);d.document.meta.description='尚未发布的新摘要';d.document.meta.hidden=true;
 const second=await api('draft',{id:created.id,document:d.document,revision:d.revision});
 assert.ok((await text(route)).includes('content="独立的已发布摘要'));
 assert.equal((await text('/sitemap.xml')).match(new RegExp('<url><loc>'+base+route.replaceAll('.','\\.')+'</loc>([\\s\\S]*?)</url>'))[1],entry);
 const preview=await fetch(base+'/api/admin/preview?id='+created.id,{headers:{Cookie:cookie}});assert.equal(preview.headers.get('x-robots-tag'),'noindex, nofollow');assert.equal(canonical(await preview.text()).length,0);
 await api('publish',{id:created.id,revision:second.revision});
 assert.ok(!(await text('/sitemap.xml')).includes(base+route));assert.equal((await fetch(base+route)).status,404);
 // HTTP IP contexts expose getRandomValues but can lack randomUUID. Exercise real form code with that API shape.
 let onReady,onSubmit,payload;
 const field=value=>({value,setAttribute(){},addEventListener(){}}),name=field('本机验收'),phone=field('13800000000'),message=field('选型咨询'),button={value:'提交',disabled:false};
 const form={querySelector:s=>s.includes('name="name"')?name:s.includes('mycall')?phone:s.includes('saytext')?message:button,append(){},reportValidity:()=>true,reset(){},addEventListener:(event,fn)=>{if(event==='submit')onSubmit=fn;}};
 const context={window:{KAISHAN_ROUTE:{}},location:{pathname:'/consultation/',search:''},innerWidth:1200,screen:{width:1200},URLSearchParams,sessionStorage:{getItem:()=>null},document:{addEventListener:(event,fn)=>onReady=fn,createElement:()=>({appendChild(){},setAttribute(){},style:{}}),querySelector:()=>null,querySelectorAll:s=>s==='.form_book'?[form]:[],getElementById:()=>null},crypto:{getRandomValues:bytes=>{for(let i=0;i<bytes.length;i++)bytes[i]=i;return bytes;}},fetch:async(url,opts)=>{payload=JSON.parse(opts.body);return{ok:true,json:async()=>({ok:true})};}};
 vm.runInNewContext(await readFile('assets/replica.js','utf8'),context);onReady();await onSubmit({preventDefault(){}});assert.match(payload.id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);assert.equal(button.disabled,false);
 console.log(JSON.stringify({pages:catalog.documents.length,deviceMetadata:'passed',canonicalAndSchema:'passed',sitemapPublishingAndDraftIsolation:'passed',privateNoindex:'passed',aliases:Object.keys(catalog.aliases).length,httpInquiryFallback:'passed'}));
}finally{if(child.exitCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await exited;}await rm(data,{recursive:true,force:true});}
