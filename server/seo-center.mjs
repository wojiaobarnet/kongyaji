import {DatabaseSync} from 'node:sqlite';
import {readFileSync,chmodSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {get as httpGet} from 'node:http';

export function proxyRobots(origin,port){
 return new Promise((resolve,reject)=>{
  const request=httpGet({hostname:'127.0.0.1',port,path:'/robots.txt',headers:{Host:new URL(origin).host,'User-Agent':'DonghanSEO/1.0'},timeout:12000},async response=>{
   try{let body='';for await(const chunk of response){body+=chunk.toString();if(body.length>65536)throw new Error('根 robots 响应过大');}resolve({status:response.statusCode,body});}catch(e){response.destroy();reject(e);}
  });
  request.on('timeout',()=>request.destroy(new Error('根 robots 检查超时')));request.on('error',reject);
 });
}

const clean=s=>String(s||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
const attr=(tag,name)=>tag.match(new RegExp('\\b'+name+'\\s*=\\s*(["\'])([\\s\\S]*?)\\1','i'))?.[2]||'';
const tags=(html,name)=>html.match(new RegExp('<'+name+'\\b[^>]*>','gi'))||[];
const dayOf=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export function inspectPage(html,url,status=200){
 const titles=[...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map(m=>clean(m[1]));
 const descriptions=tags(html,'meta').filter(t=>attr(t,'name').toLowerCase()==='description').map(t=>clean(attr(t,'content')));
 const canonicals=tags(html,'link').filter(t=>attr(t,'rel')==='canonical').map(t=>attr(t,'href').replace(/&amp;/g,'&'));
 const images=tags(html,'img'),jsonld=[...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
 const issues=[];
 if(status!==200)issues.push({code:'http_status',level:'error',message:'页面返回 HTTP '+status});
 if(titles.length!==1||!titles[0])issues.push({code:'title',level:'error',message:'标题缺失或重复'});
 if(descriptions.length!==1||!descriptions[0])issues.push({code:'description',level:'warning',message:'摘要缺失或重复'});
 if(canonicals.length!==1||canonicals[0]!==url)issues.push({code:'canonical',level:'error',message:'规范网址缺失、重复或不匹配'});
 if(/noindex/i.test(tags(html,'meta').filter(t=>attr(t,'name')==='robots').map(t=>attr(t,'content')).join(' ')))issues.push({code:'noindex',level:'error',message:'公开页面被标为 noindex'});
 if(!jsonld.length||jsonld.some(m=>{try{JSON.parse(m[1]);return false;}catch{return true;}}))issues.push({code:'structured_data',level:'error',message:'结构化数据缺失或无效'});
 const h1=(html.match(/<h1\b/gi)||[]).length;if(h1!==1)issues.push({code:'h1',level:'warning',message:h1?'主标题 H1 多于一个':'缺少页面主标题 H1'});
 const missingAlt=images.filter(t=>! /\balt\s*=/i.test(t)).length;
 if(missingAlt)issues.push({code:'image_alt',level:'warning',message:missingAlt+' 张图片没有 alt 属性，需核对内容含义'});
 if(titles[0]?.length>65)issues.push({code:'title_length',level:'warning',message:'标题较长，建议人工精简'});
 return {url,status,title:titles[0]||'',description:descriptions[0]||'',h1,images:images.length,missingAlt,issues};
}

export class SeoCenter {
 constructor({dataRoot,publicUrl,basePath='',port=8010}){
  this.root=dataRoot;this.origin=new URL(publicUrl||'http://127.0.0.1:'+port).origin;this.base=basePath;this.port=port;
  const filename=path.join(dataRoot,'seo.sqlite');this.db=new DatabaseSync(filename);chmodSync(filename,0o600);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS seo_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS seo_runs(id TEXT PRIMARY KEY,started_at TEXT NOT NULL,finished_at TEXT,status TEXT NOT NULL,trigger TEXT NOT NULL,summary_json TEXT);
   CREATE TABLE IF NOT EXISTS seo_pages(run_id TEXT NOT NULL,url TEXT NOT NULL,data_json TEXT NOT NULL,PRIMARY KEY(run_id,url));
   CREATE TABLE IF NOT EXISTS seo_actions(id INTEGER PRIMARY KEY,run_id TEXT NOT NULL,time TEXT NOT NULL,type TEXT NOT NULL,path TEXT NOT NULL,detail TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS seo_overrides(path TEXT PRIMARY KEY,value_json TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS seo_traffic(day TEXT NOT NULL,path TEXT NOT NULL,kind TEXT NOT NULL,source TEXT NOT NULL,status INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(day,path,kind,source,status));`);
  this.db.prepare('INSERT OR IGNORE INTO seo_meta VALUES (?,?)').run('tracking_since',new Date().toISOString());
  this.counter=this.db.prepare('INSERT INTO seo_traffic VALUES (?,?,?,?,?,1) ON CONFLICT(day,path,kind,source,status) DO UPDATE SET count=count+1');
 }
 close(){this.db.close();}
 metadata(meta,baseline,result){
  const row=this.db.prepare('SELECT value_json FROM seo_overrides WHERE path=?').get(meta.desktop);if(!row)return result;
  const v=JSON.parse(row.value_json);
  if(meta.title!==v.sourceTitle||(meta.description||'')!==v.sourceDescription)return result;
  return {...result,...(v.title&&meta.title===baseline.title?{title:v.title}:{}),...(v.description&&(!meta.description||meta.description===baseline.description)?{description:v.description}:{})};
 }
 track(request,result,authenticated=false){
  if(request.method!=='GET'||authenticated)return;
  const url=new URL(request.url),p=url.pathname;
  if(/^\/(?:admin|api|cms|healthz|signin-with-chatgpt)(?:\/|$)/.test(p)||p.length>300||/\.[a-z\d]{2,8}$/i.test(p)&&!p.endsWith('.html'))return;
  const ua=request.headers.get('user-agent')||'';
  if(/DonghanSEO|curl|python|playwright|headless|node|undici|lighthouse/i.test(ua)||!ua)return;
  const bot=ua.match(/Googlebot|bingbot|Baiduspider|Bytespider|YandexBot|DuckDuckBot|GPTBot|OAI-SearchBot|ChatGPT-User|PerplexityBot|ClaudeBot|Applebot/i)?.[0];
  const kind=bot?'crawler':/bot|spider|crawler|slurp/i.test(ua)?'other_bot':'browser';let source=bot||'直接或其它来源';
  if(kind==='browser'){
   try{const host=new URL(request.headers.get('referer')).hostname.toLowerCase();const groups=[['Google',/(^|\.)google\.[a-z.]+$/],['百度',/(^|\.)baidu\.com$/],['Bing',/(^|\.)bing\.com$/],['搜狗',/(^|\.)sogou\.com$/],['360 搜索',/(^|\.)so\.com$/],['ChatGPT',/(^|\.)(chatgpt\.com|chat\.openai\.com)$/],['Perplexity',/(^|\.)perplexity\.ai$/]];source=groups.find(([,re])=>re.test(host))?.[0]||(host===new URL(this.origin).hostname?'站内导航':'外部来源');}catch{}
  }
  // No IP, raw UA, cookies, query strings or complete referrers are persisted.
  try{this.counter.run(dayOf(),result.status>=400?'(错误页面汇总)':p,kind,source,result.status);}catch(e){console.error('SEO aggregate write failed:',e.message);}
 }
 summary(){
  const rows=this.db.prepare('SELECT id,started_at,finished_at,status,trigger,summary_json FROM seo_runs ORDER BY started_at DESC LIMIT 30').all().map(r=>({...r,summary:r.summary_json?JSON.parse(r.summary_json):null,summary_json:undefined}));
  const latest=this.db.prepare("SELECT id FROM seo_runs WHERE status IN ('success','warning') ORDER BY started_at DESC LIMIT 1").get();
  const pages=latest?this.db.prepare('SELECT data_json FROM seo_pages WHERE run_id=? ORDER BY url').all(latest.id).map(r=>JSON.parse(r.data_json)):[];
  const since=dayOf(new Date(Date.now()-29*86400000));
  const daily=this.db.prepare('SELECT day,kind,SUM(count) count FROM seo_traffic WHERE day>=? GROUP BY day,kind ORDER BY day').all(since);
  const sources=this.db.prepare("SELECT source,SUM(count) count FROM seo_traffic WHERE day>=? AND kind='browser' AND status=200 GROUP BY source ORDER BY count DESC").all(since);
  const crawlers=this.db.prepare("SELECT source,status,SUM(count) count FROM seo_traffic WHERE day>=? AND kind='crawler' GROUP BY source,status ORDER BY count DESC").all(since);
  const topPages=this.db.prepare("SELECT path,SUM(count) count FROM seo_traffic WHERE day>=? AND kind='browser' AND status=200 GROUP BY path ORDER BY count DESC LIMIT 15").all(since);
  const actions=this.db.prepare('SELECT * FROM seo_actions ORDER BY id DESC LIMIT 100').all();
  let schedule={enabled:false,message:'尚未安装服务器定时任务'};try{schedule=JSON.parse(readFileSync(path.join(this.root,'seo-schedule.json'),'utf8'));}catch{}
  if(schedule.enabled){
   try{
    const readUnit=(unit,properties)=>Object.fromEntries(execFileSync('systemctl',['show',unit,'--property='+properties],{encoding:'utf8',timeout:2000,stdio:['ignore','pipe','ignore']}).trim().split('\n').map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
    const timer=readUnit('donghan-seo.timer','ActiveState,UnitFileState,NextElapseUSecRealtime,LastTriggerUSec');
    const service=readUnit('donghan-seo.service','Result,ActiveState,ExecMainStatus');
    schedule={...schedule,enabled:timer.ActiveState==='active'&&timer.UnitFileState==='enabled',activeState:timer.ActiveState,nextRun:timer.NextElapseUSecRealtime,lastTrigger:timer.LastTriggerUSec,lastServiceResult:service.Result,lastServiceStatus:service.ExecMainStatus};
   }catch{schedule={...schedule,enabled:false,message:'无法读取定时任务实时状态，请维护人员检查 systemd'};}
  }
  return {runs:rows,pages,actions,daily,sources,crawlers,topPages,schedule,trackingSince:this.db.prepare("SELECT value FROM seo_meta WHERE key='tracking_since'").get().value,limits:{searchConsoleConnected:false,metrics:'按北京时间汇总的页面 GET 请求数；不是独立访客、搜索曝光、排名或按钮点击。爬虫名称由 User-Agent 声明，未验证身份。自动检查及已登录管理员请求不计入；浏览器请求仍可能包含未识别自动化。',retention:'访问聚合保留 180 天；执行及检查详情保留最近 90 次。'}};
 }
 async run(trigger='manual'){
  const id=randomUUID(),started=new Date().toISOString();
  this.db.exec('BEGIN IMMEDIATE');
  try{
   this.db.prepare("UPDATE seo_runs SET status='failed',finished_at=?,summary_json=? WHERE status='running' AND started_at<?").run(started,JSON.stringify({error:'上次任务中断或超时'}),new Date(Date.now()-25*60000).toISOString());
   if(this.db.prepare("SELECT id FROM seo_runs WHERE status='running'").get()){this.db.exec('ROLLBACK');return {busy:true};}
   this.db.prepare('INSERT INTO seo_runs VALUES (?,?,NULL,?,?,NULL)').run(id,started,'running',trigger);this.db.exec('COMMIT');
  }catch(e){if(this.db.isTransaction)this.db.exec('ROLLBACK');throw e;}
  const action=(type,p,detail)=>this.db.prepare('INSERT INTO seo_actions(run_id,time,type,path,detail) VALUES (?,?,?,?,?)').run(id,new Date().toISOString(),type,p,detail);
  const request=async(p)=>{
   const target=new URL(p,this.origin);
   if(target.origin!==this.origin||!target.pathname.startsWith(this.base+'/')||target.search||target.hash||target.username||target.password)throw new Error('拒绝抓取非本项目网址');
   const r=await fetch('http://127.0.0.1:'+this.port+target.pathname,{headers:{'User-Agent':'DonghanSEO/1.0','X-Donghan-SEO':'audit'},redirect:'manual',signal:AbortSignal.timeout(12000)});
   const body=await r.text();if(body.length>3000000)throw new Error('检查响应过大');return {r,body};
  };
  const pages=[];let changes=0;const deadline=Date.now()+18*60000;
  try{
   action('start','',trigger==='daily'?'每日自动任务开始':'管理员手动任务开始');
   const map=await request(this.base+'/sitemap.xml');if(map.r.status!==200)throw new Error('网站地图读取失败：'+map.r.status);
   const urls=[...map.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replace(/&amp;/g,'&'));
   if(!urls.length||urls.length>2000||new Set(urls).size!==urls.length)throw new Error('网站地图为空、过大或有重复网址');
   const robots=await request(this.base+'/robots.txt');if(robots.r.status!==200||!robots.body.includes('Sitemap: '+this.origin+this.base+'/sitemap.xml')||/Disallow:\s*\/\s*\n/.test(robots.body))throw new Error('抓取规则检查未通过');
   if(process.env.SEO_PROXY_PORT){
    const proxyPort=Number(process.env.SEO_PROXY_PORT);if(!Number.isInteger(proxyPort)||proxyPort<1||proxyPort>65535)throw new Error('代理端口配置无效');
    // Node fetch may replace Host; explicit http preserves virtual-host routing.
    const rootRobots=await proxyRobots(this.origin,proxyPort);
    if(rootRobots.status!==200||!rootRobots.body.includes('Sitemap: '+this.origin+this.base+'/sitemap.xml'))throw new Error('Nginx 根 robots 代理检查失败');
    action('proxy','/robots.txt','Nginx 根 robots 可访问，地图地址正确');
   }
   const catalogPath=path.join(process.env.ASSET_ROOT||path.resolve(import.meta.dirname,'../dist/client'),'cms/catalog.json');
   const catalog=JSON.parse(readFileSync(catalogPath,'utf8'));
   const content=new DatabaseSync(path.join(this.root,'content.sqlite'),{readOnly:true});let published=[];
   try{published=content.prepare('SELECT published_json FROM cms_documents WHERE published_json IS NOT NULL').all().map(r=>JSON.parse(r.published_json)?.meta).filter(Boolean);}finally{content.close();}
   const metas=new Map(catalog.documents.map(m=>[m.desktop,m]));for(const m of published)metas.set(m.desktop,m);
   const seenTitles=new Map(),seenDescriptions=new Map();
   for(const url of urls){
    if(Date.now()>deadline)throw new Error('任务超过 18 分钟，停止检查；请排查响应过慢的页面');
    let page;
    try{
     const {r,body}=await request(url);page=inspectPage(body,url,r.status);
     const local=new URL(url).pathname.slice(this.base.length),meta=metas.get(local),baseMeta=catalog.documents.find(m=>m.desktop===local),duplicates=[];
     for(const [key,seen] of [['title',seenTitles],['description',seenDescriptions]]){
      if(page[key]&&seen.has(page[key])){page.issues.push({code:'duplicate_'+key,level:'warning',message:key==='title'?'与其它页面标题重复':'与其它页面摘要重复'});duplicates.push(key);}else if(page[key])seen.set(page[key],url);
     }
     // Only snapshot/empty metadata is eligible. Owner-published text always wins.
     if(meta&&baseMeta&&r.status===200){
      const override={sourceTitle:meta.title,sourceDescription:meta.description||''};
      if((duplicates.includes('title')||!page.title)&&meta.title===baseMeta.title){const label=clean(meta.category).split('_')[0];if(label&&!page.title.includes(label))override.title=(clean(meta.title).split(/[|_]/)[0]+'｜'+label+'｜東悍').slice(0,120);}
      if((duplicates.includes('description')||!page.description)&&(!meta.description||meta.description===baseMeta.description)){
       const paragraph=[...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>clean(m[1])).find(s=>s.length>=35&&!/copyright|版权所有|备案|网站地图/i.test(s));
       if(paragraph)override.description=(clean(meta.title).split(/[|_]/)[0]+'：'+paragraph).slice(0,180);
      }
      if(override.title||override.description){
       const prior=this.db.prepare('SELECT value_json FROM seo_overrides WHERE path=?').get(local);
       if(!prior||prior.value_json!==JSON.stringify(override)){
       this.db.prepare('INSERT OR REPLACE INTO seo_overrides VALUES (?,?)').run(local,JSON.stringify(override));
       const verify=await request(url);const next=inspectPage(verify.body,url,verify.r.status);
       if(next.status===200&&!next.issues.some(i=>i.level==='error')&&(!override.title||next.title===override.title)&&(!override.description||next.description===override.description)){
        const detail=[override.title?'标题：'+page.title+' → '+next.title:'',override.description?'摘要：'+page.description+' → '+next.description:''].filter(Boolean).join('；');
        page=next;changes++;action('metadata',local,detail+'。来源：现有公开内容；未改正文、草稿或人工发布的元数据');
       }else{
        if(prior)this.db.prepare('INSERT OR REPLACE INTO seo_overrides VALUES (?,?)').run(local,prior.value_json);else this.db.prepare('DELETE FROM seo_overrides WHERE path=?').run(local);
        action('rollback',local,'元数据修复未通过复查，已恢复原值');page.issues.push({code:'repair_failed',level:'error',message:'自动修复未通过复查，已恢复'});
       }
       }
      }
     }
    }catch(e){page={url,status:0,title:'',description:'',issues:[{code:'fetch_failed',level:'error',message:e.message}]};}
    pages.push(page);this.db.prepare('INSERT INTO seo_pages VALUES (?,?,?)').run(id,url,JSON.stringify(page));
   }
   // Save validated discovery snapshots privately; public discovery remains live/dynamic.
   this.db.prepare('INSERT OR REPLACE INTO seo_meta VALUES (?,?)').run('sitemap_snapshot',map.body);
   this.db.prepare('INSERT OR REPLACE INTO seo_meta VALUES (?,?)').run('robots_snapshot',robots.body);
   action('discovery','/sitemap.xml','已校验 '+urls.length+' 个规范网址并刷新私有地图与 robots 快照；公开地图仍按发布内容实时生成');
   if(!changes)action('unchanged','','元数据规则已生效，本次没有可安全自动修复的标题或摘要；不重复改写内容或伪造更新时间');
   const errors=pages.filter(p=>p.issues.some(i=>i.level==='error')).length,warnings=pages.filter(p=>p.issues.some(i=>i.level==='warning')).length;
   const summary={pages:pages.length,healthy:pages.length-pages.filter(p=>p.issues.length).length,errors,warnings,changes,score:Math.round(100*pages.reduce((n,p)=>n+(p.issues.some(i=>i.level==='error')?0:p.issues.length ? 0.75 : 1),0)/pages.length),scoreMeaning:'站内技术检查指标，不是搜索排名',issues:pages.reduce((n,p)=>n+p.issues.length,0)};
   action('complete','',`检查完成：${pages.length} 页，错误 ${errors} 页，提醒 ${warnings} 页，修复 ${changes} 页`);
   this.db.prepare('UPDATE seo_runs SET finished_at=?,status=?,summary_json=? WHERE id=?').run(new Date().toISOString(),errors||warnings?'warning':'success',JSON.stringify(summary),id);
   this.prune();return {id,...summary};
  }catch(e){
   const message=String(e.message).slice(0,400);action('failed','',message);
   this.db.prepare('UPDATE seo_runs SET finished_at=?,status=?,summary_json=? WHERE id=?').run(new Date().toISOString(),'failed',JSON.stringify({error:message,pages:pages.length,changes}),id);this.prune();throw e;
  }
 }
 prune(){
  this.db.prepare('DELETE FROM seo_traffic WHERE day<?').run(dayOf(new Date(Date.now()-179*86400000)));
  const old=this.db.prepare('SELECT id FROM seo_runs ORDER BY started_at DESC LIMIT -1 OFFSET 90').all();
  for(const {id}of old){this.db.prepare('DELETE FROM seo_pages WHERE run_id=?').run(id);this.db.prepare('DELETE FROM seo_actions WHERE run_id=?').run(id);this.db.prepare('DELETE FROM seo_runs WHERE id=?').run(id);}
 }
}
