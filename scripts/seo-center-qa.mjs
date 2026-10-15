import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:http';
import {once} from 'node:events';
import path from 'node:path';
import os from 'node:os';
import {SeoCenter,inspectPage,proxyRobots} from '../server/seo-center.mjs';
import {seoHead,metadata} from '../worker/seo.js';
const root=await mkdtemp(path.join(os.tmpdir(),'donghan-seo-center-qa-'));
const assets=path.join(root,'assets');await mkdir(path.join(assets,'cms'),{recursive:true});
const db=new DatabaseSync(path.join(root,'content.sqlite'));db.exec('CREATE TABLE cms_documents(published_json TEXT)');
const documents=[{desktop:'/a/',title:'相同标题',description:'快照摘要',category:'螺杆式空压机',kind:'product'},{desktop:'/b/',title:'相同标题',description:'快照摘要',category:'永磁变频空压机',kind:'product'},{desktop:'/owner/',title:'人工标题',description:'原摘要',kind:'page'}];
await writeFile(path.join(assets,'cms/catalog.json'),JSON.stringify({documents}));process.env.ASSET_ROOT=assets;
db.prepare('INSERT INTO cms_documents VALUES (?)').run(JSON.stringify({meta:{...documents[2],description:'人工已发布摘要，即使重复也不能被自动改写。'}}));db.close();
let center,fail=false,malicious=false;
const html=(meta,base)=>'<!doctype html><html><head>'+seoHead(new Request(origin),{PUBLIC_URL:origin,BASE_PATH:'/donghan',SEO_METADATA:(m,b,r)=>center.metadata(m,b,r)},meta,base)+'</head><body><h1>'+meta.title+'</h1><p>这是来自页面正文的真实公开介绍，用于验证自动摘要只从已有页面提取，不凭空编造参数、价格或承诺。</p><img src="/photo.png" alt="产品外观"></body></html>';
const server=createServer((req,res)=>{
 if(req.url==='/robots.txt'){if(req.headers.host!=='seo.example'){res.writeHead(404);res.end('wrong virtual host');return;}res.end('Sitemap: http://seo.example/donghan/sitemap.xml');return;}
 if(req.url==='/donghan/sitemap.xml'){if(fail){res.writeHead(503);res.end('failure');return;}res.end('<urlset>'+documents.map(m=>'<url><loc>'+origin+'/donghan'+m.desktop+'</loc></url>').join('')+(malicious?'<url><loc>http://169.254.169.254/latest/</loc></url>':'')+'</urlset>');return;}
 if(req.url==='/donghan/robots.txt'){res.end('User-agent: *\nSitemap: '+origin+'/donghan/sitemap.xml\n');return;}
 const baseline=documents.find(m=>'/donghan'+m.desktop===req.url);
 if(baseline){const meta=baseline.desktop==='/owner/'?{...baseline,description:'人工已发布摘要，即使重复也不能被自动改写。'}:baseline;res.end(html(meta,baseline));return;}
 res.writeHead(404);res.end('missing');
});
server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
center=new SeoCenter({dataRoot:root,publicUrl:origin,basePath:'/donghan',port:server.address().port});
try{
 assert.equal((await proxyRobots('http://seo.example',server.address().port)).body,'Sitemap: http://seo.example/donghan/sitemap.xml','Proxy request must preserve the target virtual host');
 // Force an actual duplicate description in fixture output and verify the optimizer fixes it.
 const initial=center.metadata.bind(center);let duplicate=true;
 center.metadata=(m,b,r)=>{const value=initial(m,b,r);if(duplicate&&['/a/','/b/'].includes(m.desktop)&&!center.db.prepare('SELECT path FROM seo_overrides WHERE path=?').get(m.desktop))return {...value,description:'重复摘要'};return value;};
 const first=await center.run('manual');assert.equal(first.pages,3);assert.ok(first.changes>=1);
 const override=JSON.parse(center.db.prepare('SELECT value_json FROM seo_overrides WHERE path=?').get('/b/').value_json);assert.ok(override.description.includes('真实公开介绍'));assert.ok(override.title.includes('永磁变频'));
 assert.equal(center.db.prepare('SELECT COUNT(*) n FROM seo_overrides WHERE path=?').get('/owner/').n,0);
 assert.equal(center.metadata({...documents[1],description:'所有者后来修改的摘要'},documents[1],{title:'T',description:'所有者后来修改的摘要'}).description,'所有者后来修改的摘要');
 duplicate=false;const second=await center.run('daily');assert.equal(second.changes,0,'An unchanged repeat should be idempotent');
 const now=new Date().toISOString();center.db.prepare('INSERT INTO seo_runs VALUES (?,?,NULL,?,?,NULL)').run('lock',now,'running','daily');assert.equal((await center.run()).busy,true);center.db.prepare('DELETE FROM seo_runs WHERE id=?').run('lock');
 fail=true;await assert.rejects(()=>center.run('daily'));assert.equal(center.summary().runs[0].status,'failed');fail=false;
 malicious=true;const blocked=await center.run();assert.equal(blocked.errors,1,'Off-site sitemap URL must be refused');malicious=false;
 const req=(ua,p='/a/?secret=hidden',referer)=>new Request(origin+p,{headers:{'User-Agent':ua,...(referer?{Referer:referer}:{})}});
 center.track(req('Mozilla/5.0',undefined,'https://www.google.com/search?q=private'),new Response('ok'));
 center.track(req('Googlebot'),new Response('ok'));
 center.track(req('DonghanSEO/1.0'),new Response('ok'));
 center.track(req('Mozilla/5.0','/api/admin/seo'),new Response('private'));
 center.track(req('Mozilla/5.0'),new Response('ok'),true);
 const traffic=center.db.prepare('SELECT * FROM seo_traffic').all();assert.equal(traffic.reduce((n,r)=>n+r.count,0),2);assert.ok(traffic.every(r=>!JSON.stringify(r).includes('private')&&!r.path.includes('?')));assert.ok(traffic.some(r=>r.source==='Google'));
 const issues=inspectPage('<html><head><title>x</title></head><body><img src="x"></body></html>',origin+'/x/').issues;assert.ok(issues.some(i=>i.code==='canonical'));assert.ok(issues.some(i=>i.code==='structured_data'));assert.ok(issues.some(i=>i.code==='image_alt'));
 center.close();center=new SeoCenter({dataRoot:root,publicUrl:origin,port:server.address().port});assert.ok(center.summary().actions.length);assert.equal(center.summary().sources[0].count,1);
 console.log(JSON.stringify({passed:true,checks:['proxy virtual-host preserved','duplicate metadata repaired and rechecked','owner content preserved','idempotent repeated runs','cross-process lock','durable failure log','off-site sitemap refused','traffic privacy and exclusion','durable aggregates and history']}));
}finally{center.close();server.close();await once(server,'close');delete process.env.ASSET_ROOT;await rm(root,{recursive:true,force:true});}
