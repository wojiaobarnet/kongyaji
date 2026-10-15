import http from 'node:http';
import {readFile,writeFile,mkdir,stat,rename,unlink} from 'node:fs/promises';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHmac,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {HTMLRewriter} from '@worker-tools/html-rewriter/base64';
import worker from '../worker/index.js';
import {mountResponse} from './mount.mjs';
import {SeoCenter} from './seo-center.mjs';

globalThis.HTMLRewriter=HTMLRewriter;
const ROOT=path.resolve(import.meta.dirname,'..');
const ASSET_ROOT=path.resolve(process.env.ASSET_ROOT||path.join(ROOT,'dist/client'));
const DATA_ROOT=path.resolve(process.env.DATA_ROOT||path.join(ROOT,'.server-data'));
const PORT=Number(process.env.PORT||8010);
const PUBLIC_URL=process.env.PUBLIC_URL;
const BASE_PATH=(process.env.BASE_PATH||'').replace(/\/$/,'');
const ADMIN_PATH=process.env.ADMIN_PATH||'/admin';
if(!/^\/[a-zA-Z0-9_-]+$/.test(ADMIN_PATH))throw new Error('Invalid ADMIN_PATH');
if(BASE_PATH&&!/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(BASE_PATH))throw new Error('Invalid BASE_PATH');
await mkdir(path.join(DATA_ROOT,'uploads'),{recursive:true,mode:0o700});
const configPath=path.join(DATA_ROOT,'admin.json');
let config;
try{config=JSON.parse(await readFile(configPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;throw new Error('Run node server/setup.mjs before starting the server.');}
const db=new DatabaseSync(path.join(DATA_ROOT,'content.sqlite'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS server_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
for(const filename of readdirSync(path.join(ROOT,'drizzle')).filter(n=>/^\d.*\.sql$/.test(n)).sort()){
 if(db.prepare('SELECT name FROM server_migrations WHERE name=?').get(filename))continue;
 db.exec('BEGIN IMMEDIATE');try{db.exec(readFileSync(path.join(ROOT,'drizzle',filename),'utf8'));db.prepare('INSERT INTO server_migrations VALUES (?,?)').run(filename,new Date().toISOString());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}
function prepared(sql,params=[]){
 const execute=mode=>{const statement=db.prepare(sql);if(mode==='first')return statement.get(...params)||null;if(mode==='all')return {results:statement.all(...params),success:true};const result=statement.run(...params);return {success:true,meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};};
 return {bind:(...values)=>prepared(sql,values),first:async()=>execute('first'),all:async()=>execute('all'),run:async()=>execute('run'),execute};
}
const types={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.pdf':'application/pdf'};
const env={PUBLIC_URL,BASE_PATH,ADMIN_PATH,CMS_ADMIN_EMAIL:'admin@donghan.local',CMS_AUTH_MODE:'password',DB:{prepare:prepared,batch:async statements=>{db.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>s.execute('run'));db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}},
 ASSETS:{async fetch(request){let pathname;try{pathname=decodeURIComponent(new URL(request.url).pathname);}catch{return new Response('Bad Request',{status:400});}if(pathname.endsWith('/'))pathname+='index.html';const filename=path.resolve(ASSET_ROOT,'.'+pathname);if(!filename.startsWith(ASSET_ROOT+path.sep)||pathname.includes('\0'))return new Response('Not Found',{status:404});try{const data=await readFile(filename);return new Response(request.method==='HEAD'?null:data,{headers:{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'public,max-age=3600','X-Content-Type-Options':'nosniff'}});}catch{return new Response('Not Found',{status:404});}}},
 BUCKET:{async put(key,bytes){if(!/^[\w.-]+$/.test(key))throw new Error('Invalid object key');const file=path.join(DATA_ROOT,'uploads',key),tmp=file+'.tmp-'+randomBytes(6).toString('hex');await writeFile(tmp,bytes,{mode:0o600});await rename(tmp,file);},async get(key){if(!/^[\w.-]+$/.test(key))return null;try{const data=await readFile(path.join(DATA_ROOT,'uploads',key));return {body:data,writeHttpMetadata:h=>h.set('Content-Type',types[path.extname(key)]||'application/octet-stream')};}catch{return null;}},async delete(key){if(/^[\w.-]+$/.test(key))await unlink(path.join(DATA_ROOT,'uploads',key)).catch(()=>{});}}
};
const cookieName='donghan_session';
const seo=new SeoCenter({dataRoot:DATA_ROOT,publicUrl:PUBLIC_URL,basePath:BASE_PATH,port:PORT});
env.SEO_METADATA=(meta,baseline,result)=>seo.metadata(meta,baseline,result);
const sign=value=>createHmac('sha256',config.sessionKey).update(value).digest('base64url');
function authenticated(request){const cookie=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);if(!cookie)return false;const [value,signature]=cookie.split('.');if(!value||!signature)return false;const expected=sign(value);if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return false;try{const session=JSON.parse(Buffer.from(value,'base64url'));return session.user===config.username&&session.exp>Date.now();}catch{return false;}}
const loginPage=(error='')=>`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>東悍 · 管理员登录</title><style>*{box-sizing:border-box}body{margin:0;background:#f3f6fb;color:#20354e;font:14px system-ui,"Microsoft Yahei",sans-serif;min-height:100vh;display:grid;place-items:center}main{width:calc(100% - 40px);max-width:400px;border:1px solid #e3eaf3;background:white;border-radius:16px;padding:36px;box-shadow:0 16px 60px #17324f0d}img{width:100%;margin-bottom:25px}h1{font-size:22px;margin:0 0 10px}p{color:#8593a5;line-height:1.8}label{display:block;margin:24px 0 8px;font-size:13px}input,button{font:inherit;width:100%;border-radius:8px;padding:13px;border:1px solid #dce4ed}button{margin-top:26px;background:#1670d7;border:0;color:white;cursor:pointer}.error{color:#b74242}</style></head><body><main><img src="/replica/donghan-logo.svg" alt="東悍空压机"><h1>内容管理工作台</h1><p>使用管理员账号登录，管理网站内容与客户留言。</p>${error?'<p class="error">'+error+'</p>':''}<form action="/admin/login" method="post"><label for="username">账号</label><input id="username" name="username" autocomplete="username" required maxlength="100"><label for="password">密码</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="200"><button>登录后台</button></form></main></body></html>`;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const attempts=new Map();
async function handle(request,client){
 const url=new URL(request.url);let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{return new Response('Bad Request',{status:400});}
 const valid=authenticated(request),origin=request.headers.get('Origin');
 if(pathname==='/healthz')return json({ok:true,service:'donghan',database:db.prepare('SELECT 1 AS ok').get().ok});
 if(pathname==='/signin-with-chatgpt')return new Response(null,{status:302,headers:{Location:'/admin/login'}});
 if(pathname==='/admin/login'){
  if(request.method==='GET')return valid?new Response(null,{status:302,headers:{Location:'/admin/'}}):new Response(loginPage(),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  if(request.method!=='POST')return new Response('Method Not Allowed',{status:405});
  if(origin&&origin!==url.origin)return json({error:'请求来源无效。'},403);
  const current=attempts.get(client);let attempt=current&&current.until>Date.now()?current:{count:0,until:Date.now()+900000};if(attempt.count>=5)return new Response(loginPage('尝试次数过多，请 15 分钟后重试。'),{status:429,headers:{'Content-Type':'text/html; charset=utf-8','Retry-After':'900'}});
  if(attempts.size>10000)for(const [key,value]of attempts)if(value.until<Date.now())attempts.delete(key);
  const form=await request.formData(),username=form.get('username'),password=form.get('password');const passwordBuffer=typeof password==='string'&&password.length<=200?scryptSync(password,config.salt,64):Buffer.alloc(64);
  if(username!==config.username||!timingSafeEqual(passwordBuffer,Buffer.from(config.passwordHash,'hex'))){attempt.count++;attempts.set(client,attempt);return new Response(loginPage('账号或密码不正确。'),{status:401,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});}
  attempts.delete(client);const value=Buffer.from(JSON.stringify({user:config.username,exp:Date.now()+28800000,nonce:randomBytes(12).toString('hex')})).toString('base64url');return new Response(null,{status:303,headers:{Location:'/admin/','Cache-Control':'no-store','Set-Cookie':cookieName+'='+value+'.'+sign(value)+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800'+(url.protocol==='https:'?'; Secure':'')}});
 }
 if(pathname==='/api/admin/logout'&&request.method==='POST'){if(origin&&origin!==url.origin)return json({error:'请求来源无效'},403);return new Response(null,{status:303,headers:{Location:'/admin/login','Set-Cookie':cookieName+'=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'}});}
 const admin=pathname==='/admin'||pathname.startsWith('/admin/')||pathname.startsWith('/api/admin/');
 if(admin&&!valid)return pathname.startsWith('/api/')?json({error:'登录已过期，请重新登录后台。'},401):new Response(null,{status:302,headers:{Location:'/admin/login'}});
 if(pathname==='/api/admin/seo'&&request.method==='GET')return json(seo.summary());
 if(pathname==='/api/admin/seo/run'){
  if(request.method!=='POST')return json({error:'请使用 POST 请求。'},405);
  if(origin!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'请求来源无效。'},403);
  if(seo.db.prepare("SELECT id FROM seo_runs WHERE status='running' AND started_at>?").get(new Date(Date.now()-25*60000).toISOString()))return json({error:'已有检查正在执行，请稍后刷新。'},409);
  void seo.run('manual').catch(e=>console.error('SEO manual failed:',e.message));return json({ok:true,message:'检查已开始，请稍后刷新查看结果。'},202);
 }
 if(pathname==='/api/admin/password'&&request.method==='POST'){
  if(origin&&origin!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'请求来源无效。'},403);
  let input;try{input=await request.json();}catch{return json({error:'提交格式不正确。'},400);}
  if(typeof input.current!=='string'||input.current.length>200||typeof input.password!=='string'||input.password.length<12||input.password.length>200)return json({error:'新密码需要 12 至 200 个字符。'},400);
  if(!timingSafeEqual(scryptSync(input.current,config.salt,64),Buffer.from(config.passwordHash,'hex')))return json({error:'当前密码不正确。'},400);
  const salt=randomBytes(24).toString('hex'),updated={...config,salt,passwordHash:scryptSync(input.password,salt,64).toString('hex'),sessionKey:randomBytes(48).toString('hex')};
  await writeFile(configPath+'.tmp',JSON.stringify(updated)+'\n',{mode:0o600});await rename(configPath+'.tmp',configPath);config=updated;await unlink(path.join(DATA_ROOT,'initial-login.txt')).catch(()=>{});return json({ok:true});
 }
 const headers=new Headers(request.headers);headers.delete('oai-authenticated-user-email');if(valid)headers.set('oai-authenticated-user-email',env.CMS_ADMIN_EMAIL);
 return worker.fetch(new Request(request,{headers}),env);
}
const server=http.createServer(async(req,res)=>{
 try{
  const origin=PUBLIC_URL||'http://127.0.0.1:'+PORT;
  const url=new URL(req.url,origin);if(url.origin!==new URL(origin).origin){res.writeHead(400);res.end();return;}
  if(BASE_PATH){
   if(url.pathname===BASE_PATH){res.writeHead(308,{Location:BASE_PATH+'/'+url.search});res.end();return;}
   if(!url.pathname.startsWith(BASE_PATH+'/')){res.writeHead(404,{'X-Robots-Tag':'noindex, nofollow'});res.end('Not Found');return;}
   url.pathname=url.pathname.slice(BASE_PATH.length);
  }
  if(ADMIN_PATH!=='/admin'){
   if(url.pathname==='/admin'||url.pathname.startsWith('/admin/')){res.writeHead(404,{'X-Robots-Tag':'noindex, nofollow'});res.end('Not Found');return;}
   if(url.pathname===ADMIN_PATH||url.pathname.startsWith(ADMIN_PATH+'/'))url.pathname='/admin'+url.pathname.slice(ADMIN_PATH.length);
  }
  const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>9000000){res.writeHead(413);res.end('Payload Too Large');return;}chunks.push(chunk);}
  const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);
  const request=new Request(url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
  let result=await handle(request,req.headers['x-real-ip']||req.socket.remoteAddress);
  seo.track(request,result,authenticated(request));
  if(result.status>=400||/^\/(?:admin|api|cms)(?:\/|$)/.test(url.pathname)||url.pathname==='/healthz'){const h=new Headers(result.headers);h.set('X-Robots-Tag','noindex, nofollow');h.set('Cache-Control','no-store');result=new Response(result.body,{status:result.status,headers:h});}
  const response=await mountResponse(result,BASE_PATH,new URL(origin).origin,ADMIN_PATH);res.writeHead(response.status,Object.fromEntries(response.headers));if(req.method==='HEAD'){res.end();return;}if(!response.body){res.end();return;}for await(const chunk of response.body)if(!res.write(chunk))await new Promise(resolve=>res.once('drain',resolve));res.end();
 }catch(error){console.error('Request failed:',error.message);if(!res.headersSent)res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});res.end('服务暂不可用，请稍后重试。');}
});
server.requestTimeout=120000;server.headersTimeout=15000;
server.listen(PORT,'127.0.0.1',()=>console.log('東悍 server listening on 127.0.0.1:'+PORT));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>{seo.close();db.close();process.exit(0);}));
