import sanitizeHtml from 'sanitize-html';
import {seoHead, guideLink, guideStyles} from './seo.js';
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=()=>new Date().toISOString();
const parse=s=>s?JSON.parse(s.replaceAll('开'+'山','東悍').replaceAll('/public/images/logo.png','/replica/donghan-logo.svg')):null;
let catalogPromise;
async function assetJson(env,path){const r=await env.ASSETS.fetch(new Request('https://assets.internal'+path));if(!r.ok)throw new Error('内容模板不可用');return r.json();}
export const catalog=env=>catalogPromise ||= assetJson(env,'/cms/catalog.json');
const defaultSettings={meta:{id:'settings',title:'网站设置',kind:'settings'},values:{company:'上海开股机械有限公司',phone:'13564562849',hotline:'021-57616590',email:'chengwei@kaishansales.com',address:'上海市松江区茸梅路1108号茸锦商务6楼',wechat:'13564562849',logo:'/replica/donghan-logo.svg',qr:'/public/images/erweima.png'}};
export function adminIdentity(request,env){
 const url=new URL(request.url);
 if(env.CMS_LOCAL_DEV==='1' && url.protocol==='http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname))return {name:'本地管理员',email:'local-admin@example.test'};
 const email=request.headers.get('oai-authenticated-user-email');
 if(!email || !env.CMS_ADMIN_EMAIL || email.toLowerCase()!==env.CMS_ADMIN_EMAIL.toLowerCase())return null;
 return {name:'网站管理员',email};
}
export function loginResponse(){return new Response('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>管理后台登录</title><body style="font:16px system-ui;color:#18324e;background:#f3f6fa;padding:80px 24px;text-align:center"><h1>東悍网站管理后台</h1><p>请使用网站所有者的账号登录。</p><a target="_top" href="/signin-with-chatgpt?return_to=%2Fadmin%2F" style="display:inline-block;background:#1669d4;color:white;padding:14px 30px;border-radius:8px;text-decoration:none">使用 ChatGPT 账号登录</a></body></html>',{status:401,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});}
async function row(env,id){return env.DB.prepare('SELECT * FROM cms_documents WHERE id=?').bind(id).first();}
async function baseDoc(env,id,r){
 if(id==='settings')return structuredClone(defaultSettings);
 const c=await catalog(env);
 if(c.documents.some(d=>d.id===id)){
  const base=await assetJson(env,'/cms/documents/'+id+'.json');
  for(const block of Object.values(base.blocks))if(block.type==='html')block.value=cleanHtml(block.value);
  return base;
 }
 const draft=parse(r?.draft_json)||parse(r?.published_json);
 if(draft?.meta.created && draft.meta.templateId){const b=await assetJson(env,'/cms/documents/'+draft.meta.templateId+'.json');return {...b,meta:{...b.meta,...draft.meta}};}
 throw Object.assign(new Error('未找到内容。'),{status:404});
}
async function document(env,id){const r=await row(env,id);const base=await baseDoc(env,id,r);const saved=parse(r?.draft_json);const current=saved?{...base,...saved,meta:{...base.meta,...saved.meta},blocks:base.blocks?Object.fromEntries(Object.entries(base.blocks).map(([key,b])=>[key,{...b,value:saved.blocks?.[key]?.value??b.value}])):undefined}:base;return {document:current,base,revision:r?.revision||0,publishedRevision:r?.published_revision||0,published:parse(r?.published_json)||(!base.meta.created?base:null),updatedAt:r?.updated_at||null};}
function safeUrl(value,image=false){
 if(typeof value!=='string' || value.length>2048 || /[\x00-\x20\\]/.test(value))throw new Error('链接或图片地址格式不正确。');
 if(value.startsWith('/') && !value.startsWith('//'))return value;
 let url;try{url=new URL(value);}catch{throw new Error('请输入本站路径或完整网址。');}
 if(!['https:','http:'].includes(url.protocol))throw new Error('只支持本站路径和 HTTP/HTTPS 网址。');
 return value;
}
function cleanHtml(value){
 if(typeof value!=='string'||value.length>700000)throw new Error('正文过长，请拆分内容。');
 return sanitizeHtml(value,{allowedTags:[...sanitizeHtml.defaults.allowedTags,'img','span','font','div','h1','h2','h3','h4','iframe'],allowedAttributes:{'*':['id','class','style','align','data-clipboard-text'],a:['href','title','target','rel'],img:['src','alt','width','height','style'],font:['color','size','face'],table:['border','cellpadding','cellspacing','align','style'],td:['colspan','rowspan','width','height','style'],th:['colspan','rowspan','style'],iframe:['src','title','width','height','loading','style']},allowedSchemes:['https','http','mailto','tel','weixin'],allowedSchemesByTag:{img:['https','http'],iframe:['https']},allowProtocolRelative:false,allowedIframeHostnames:['www.openstreetmap.org'],allowedStyles:{'*':{'color':[/^#[0-9a-f]+$/i,/^[a-z]+$/i,/^rgba?\([\d\s,%.]+\)$/],'background-color':[/^#[0-9a-f]+$/i,/^[a-z]+$/i],'text-align':[/^(left|right|center|justify)$/],'font-size':[/^[\d.]+(?:px|rem|em|%)$/],'font-family':[/^[\w\s,\-"'\u4e00-\u9fff]+$/],'font-weight':[/^(bold|normal|[1-9]00)$/],width:[/^[\d.]+(?:px|rem|em|%)$/],height:[/^[\d.]+(?:px|rem|em|%)$/],'max-width':[/^[\d.]+(?:px|rem|em|%)$/],'line-height':[/^[\d.]+(?:px|rem|em|%)?$/],border:[/^[\d.]+px (?:solid|dashed) #[0-9a-f]+$/i],clear:[/^(both|left|right)$/]}}});
}
function validate(input,base){
 if(!input || typeof input!=='object')throw new Error('内容格式不正确。');
 if(base.meta.kind==='settings'){
  const values={};for(const key of Object.keys(defaultSettings.values)){
   const value=input.values?.[key];if(typeof value!=='string'||value.length>500||!value.trim())throw new Error('请完整填写网站设置。');values[key]=['logo','qr'].includes(key)?safeUrl(value,true):value.trim();
  }
  return {...defaultSettings,values};
 }
 const meta={...base.meta};
 for(const key of ['title','description','cover']){const value=input.meta?.[key]??meta[key];if(typeof value!=='string'||value.length>(key==='cover'?2048:key==='title'?200:500))throw new Error('标题、摘要或图片格式不正确。');meta[key]=value.trim();}
 if(!meta.title)throw new Error('请输入标题。');
 if(meta.cover)meta.cover=safeUrl(meta.cover,true);
 meta.hidden=Boolean(input.meta?.hidden);
 const blocks={};for(const [id,block] of Object.entries(base.blocks)){
  const value=input.blocks?.[id]?.value ?? block.value;
  blocks[id]={...block,value:block.type==='html'?cleanHtml(value):safeUrl(value,block.type==='image')};
 }
 return {meta,blocks};
}
async function readInput(request){const text=await request.text();if(text.length>1000000)throw Object.assign(new Error('提交内容过大。'),{status:413});try{return JSON.parse(text);}catch{throw new Error('提交格式不正确。');}}
async function saveDraft(env,id,data,expected){
 const d=await document(env,id);const value=validate(data,d.base);
 if(!Number.isInteger(expected)||expected!==d.revision)throw Object.assign(new Error('内容已被更新，请重新打开后编辑。'),{status:409});
 const time=now();
 const result=await env.DB.batch([
  env.DB.prepare('INSERT OR IGNORE INTO cms_documents (id,created_at,updated_at) VALUES (?,?,?)').bind(id,time,time),
  env.DB.prepare('UPDATE cms_documents SET draft_json=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(value),time,id,expected)
 ]);
 if(result[1].meta.changes!==1)throw Object.assign(new Error('内容已被更新，请重新打开后编辑。'),{status:409});
 return {ok:true,revision:expected+1};
}
async function publish(env,id,expected){
 const d=await document(env,id);
 if(d.revision!==expected)throw Object.assign(new Error('草稿版本已变化，请重新打开。'),{status:409});
 if(!d.revision)throw new Error('请先保存草稿，再发布。');
 const time=now();const results=await env.DB.batch([
  env.DB.prepare('INSERT OR IGNORE INTO cms_revisions (id,document_id,revision,document_json,created_at) SELECT ?,id,revision,draft_json,? FROM cms_documents WHERE id=? AND revision=?').bind(crypto.randomUUID(),time,id,expected),
  env.DB.prepare('UPDATE cms_documents SET published_json=draft_json,published_revision=revision,updated_at=? WHERE id=? AND revision=?').bind(time,id,expected)
 ]);
 if(results[1].meta.changes!==1)throw Object.assign(new Error('草稿版本已变化，请重新打开。'),{status:409});
 return {ok:true,revision:expected};
}
export async function adminApi(request,env){
 const identity=adminIdentity(request,env);if(!identity)return reply({error:'请使用网站所有者账号登录。'},401);
 const u=new URL(request.url);const action=u.pathname.slice('/api/admin/'.length);
 if(request.method!=='GET' && (request.headers.get('Origin') && request.headers.get('Origin')!==u.origin || request.headers.get('Sec-Fetch-Site')==='cross-site'))return reply({error:'请求来源无效。'},403);
 try{
  if(action==='session'&&request.method==='GET')return reply({user:identity,authMode:env.CMS_AUTH_MODE||'chatgpt'});
  if(action==='documents'&&request.method==='GET'){
   const c=await catalog(env);const {results}=await env.DB.prepare("SELECT id,json_extract(draft_json,'$.meta') AS meta,revision,published_revision,updated_at FROM cms_documents WHERE id<>'settings' LIMIT 2000").all();
   const docs=new Map(c.documents.map(m=>[m.id,{...m,revision:0,publishedRevision:0,updatedAt:null}]));
   for(const r of results){const meta=parse(r.meta);if(meta)docs.set(r.id,{...docs.get(r.id),...meta,revision:r.revision,publishedRevision:r.published_revision,updatedAt:r.updated_at});}
   const unread=await env.DB.prepare("SELECT COUNT(*) AS count FROM inquiries WHERE status='new'").first();
   return reply({documents:[...docs.values()],unread:unread.count});
  }
  if(action==='document'&&request.method==='GET')return reply(await document(env,u.searchParams.get('id')));
  if(action==='draft'&&request.method==='POST'){const data=await readInput(request);return reply(await saveDraft(env,data.id,data.document,data.revision));}
  if(action==='publish'&&request.method==='POST'){const data=await readInput(request);return reply(await publish(env,data.id,data.revision));}
  if(action==='create'&&request.method==='POST'){
   const input=await readInput(request);const c=await catalog(env);const template=c.documents.find(d=>d.id===input.templateId && ['product','news','case'].includes(d.kind));if(!template)throw new Error('请选择产品、新闻或案例模板。');
   const base=await baseDoc(env,template.id);const id=crypto.randomUUID();const meta={...base.meta,id,created:true,templateId:template.id,title:typeof input.title==='string'?input.title.trim().slice(0,200):'新内容',description:'',desktop:template.group+'cms/'+id+'.html',mobile:'/mobile/cms/'+id+'.html',hidden:false};
   if(!meta.title)throw new Error('请输入标题。');const doc={...base,meta};if(input.blank){doc.meta.cover='';if(doc.blocks.body)doc.blocks.body.value='<p>在这里填写内容介绍。</p>';}const time=now();
   await env.DB.prepare('INSERT INTO cms_documents (id,draft_json,revision,created_at,updated_at) VALUES (?,?,1,?,?)').bind(id,JSON.stringify(doc),time,time).run();return reply({ok:true,id},201);
  }
  if(action==='history'&&request.method==='GET'){const {results}=await env.DB.prepare('SELECT id,revision,created_at FROM cms_revisions WHERE document_id=? ORDER BY revision DESC LIMIT 30').bind(u.searchParams.get('id')).all();return reply({revisions:results});}
  if(action==='restore'&&request.method==='POST'){
   const input=await readInput(request);const previous=await env.DB.prepare('SELECT document_json FROM cms_revisions WHERE id=? AND document_id=?').bind(input.historyId,input.id).first();if(!previous)throw new Error('未找到历史版本。');return reply(await saveDraft(env,input.id,parse(previous.document_json),input.revision));
  }
  if(action==='media'&&request.method==='GET'){
   const originals=await assetJson(env,'/cms/media.json');const {results}=await env.DB.prepare('SELECT id,name,key,mime,size,created_at,width,height,purpose FROM cms_media ORDER BY created_at DESC LIMIT 500').all();return reply({media:[...results.map(r=>({...r,url:'/uploads/'+r.key,original:false})),...originals]});
  }
  if(action==='media-update'&&request.method==='POST'){
   const input=await readInput(request);if(typeof input.name!=='string'||!input.name.trim()||input.name.length>200||!['banner','product','news','case','content','logo','other'].includes(input.purpose))throw new Error('请填写图片名称和用途。');const r=await env.DB.prepare('UPDATE cms_media SET name=?,purpose=? WHERE id=?').bind(input.name.trim(),input.purpose,input.id).run();if(!r.meta.changes)throw new Error('图片不存在。');return reply({ok:true});
  }
  if(action==='upload'&&request.method==='POST'){
   if(!env.BUCKET)throw new Error('图片存储暂不可用。');if(Number(request.headers.get('Content-Length'))>8500000)throw new Error('图片不能超过8MB。');
   const form=await request.formData();const file=form.get('file');if(!(file instanceof File)||file.size>8388608||file.size<12)throw new Error('请上传8MB以内的 PNG、JPG、GIF 或 WebP 图片。');
   const bytes=new Uint8Array(await file.arrayBuffer());let mime,ext;
   if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71){mime='image/png';ext='png';}
   else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){mime='image/jpeg';ext='jpg';}
   else if(new TextDecoder().decode(bytes.slice(0,6)).match(/^GIF8[79]a$/)){mime='image/gif';ext='gif';}
   else if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'){mime='image/webp';ext='webp';}
   else throw new Error('图片格式不支持。');
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
   const existing=await env.DB.prepare('SELECT id,key,name FROM cms_media WHERE hash=?').bind(hash).first();if(existing)return reply({ok:true,url:'/uploads/'+existing.key,id:existing.id,name:existing.name,reused:true});
   let width=0,height=0;const view=new DataView(bytes.buffer);
   if(ext==='png'&&bytes.length>=24){width=view.getUint32(16);height=view.getUint32(20);}
   else if(ext==='gif'){width=view.getUint16(6,true);height=view.getUint16(8,true);}
   else if(ext==='jpg'){let i=2;while(i<bytes.length-9){if(bytes[i]!==255){i++;continue;}const marker=bytes[i+1];i+=2;if(marker===216||marker===217)continue;const size=view.getUint16(i);if([192,193,194,195].includes(marker)){height=view.getUint16(i+3);width=view.getUint16(i+5);break;}if(size<2)break;i+=size;}}
   else if(ext==='webp'&&bytes.length>=30&&new TextDecoder().decode(bytes.slice(12,16))==='VP8X'){width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);}
   const purpose=['banner','product','news','case','content','logo','other'].includes(form.get('purpose'))?form.get('purpose'):'other';
   const id=crypto.randomUUID(),key=id+'.'+ext,time=now();await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});
   try{await env.DB.prepare('INSERT INTO cms_media (id,name,key,mime,size,created_at,width,height,purpose,hash) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,file.name.slice(0,200),key,mime,file.size,time,width,height,purpose,hash).run();}catch(e){await env.BUCKET.delete(key);const reused=await env.DB.prepare('SELECT id,key,name FROM cms_media WHERE hash=?').bind(hash).first();if(reused)return reply({ok:true,url:'/uploads/'+reused.key,id:reused.id,name:reused.name,reused:true});throw e;}
   return reply({ok:true,url:'/uploads/'+key,id,name:file.name,width,height,purpose},201);
  }
  if(action==='inquiries'&&request.method==='GET'){
   const {results}=await env.DB.prepare('SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 1000').all();return reply({inquiries:results});
  }
  if(action==='inquiry'&&request.method==='POST'){
   const input=await readInput(request);if(!['new','handled'].includes(input.status)||typeof input.note!=='string'||input.note.length>1000)throw new Error('留言处理格式不正确。');const result=await env.DB.prepare('UPDATE inquiries SET status=?,note=?,updated_at=? WHERE id=?').bind(input.status,input.note,now(),input.id).run();if(!result.meta.changes)throw new Error('留言不存在。');return reply({ok:true});
  }
  if(action==='export'&&request.method==='GET'){
   const {results}=await env.DB.prepare('SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 5000').all();const csv=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
   const lines=[['姓名','手机','咨询内容','来源','状态','备注','提交时间'],...results.map(r=>[r.name,r.phone,r.message,r.source,r.status,r.note,r.created_at])];return new Response('\ufeff'+lines.map(r=>r.map(csv).join(',')).join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="inquiries.csv"','Cache-Control':'no-store'}});
  }
  if(action==='preview'&&request.method==='GET'){
   const d=await document(env,u.searchParams.get('id'));const device=u.searchParams.get('device')==='mobile'?'mobile':'desktop';return renderPage(request,env,d.document.meta[device]||d.document.meta.desktop,{document:d.document,base:d.base,device});
  }
  if(action==='preview'&&request.method==='POST'){
   const input=await readInput(request);const d=await document(env,input.id);const device=input.device==='mobile'?'mobile':'desktop';const value=validate(input.document,d.base);return renderPage(request,env,value.meta[device]||value.meta.desktop,{document:value,base:d.base,device});
  }
  return reply({error:'未找到该管理接口。'},404);
 }catch(error){return reply({error:error.status?error.message: String(error.message||'操作失败，请稍后重试。').includes('D1')?'服务暂不可用，请稍后重试。':error.message||'操作失败，请稍后重试。'},error.status||400);}
}
export async function uploadedMedia(request,env){
 const key=new URL(request.url).pathname.slice('/uploads/'.length);if(!/^[0-9a-f-]{36}\.(png|jpg|gif|webp)$/.test(key)||!env.BUCKET)return new Response('Not Found',{status:404});
 const object=await env.BUCKET.get(key);if(!object)return new Response('Not Found',{status:404});const headers=new Headers();object.writeHttpMetadata(headers);headers.set('Cache-Control','public,max-age=31536000,immutable');headers.set('X-Content-Type-Options','nosniff');return new Response(request.method==='HEAD'?null:object.body,{headers});
}
async function published(env){
 const {results}=await env.DB.prepare("SELECT id,json_extract(published_json,'$.meta') AS meta FROM cms_documents WHERE published_json<>'' LIMIT 2000").all();return new Map(results.map(r=>[r.id,parse(r.meta)]));
}
export async function publicDocuments(env){
 const c=await catalog(env);
 const {results}=await env.DB.prepare("SELECT d.id,json_extract(d.published_json,'$.meta') AS meta,(SELECT r.created_at FROM cms_revisions r WHERE r.document_id=d.id AND r.revision=d.published_revision LIMIT 1) AS modified FROM cms_documents d WHERE d.published_json<>'' LIMIT 2000").all();
 const documents=new Map(c.documents.map(meta=>[meta.id,meta]));
 for(const r of results){const meta=parse(r.meta);if(meta)documents.set(r.id,{...meta,...(r.modified?{modified:r.modified}:{})});}
 return [...documents.values()].filter(meta=>!meta.hidden&&meta.desktop&&meta.id!=='settings');
}
const previewScript=device=>'<script>window.CMS_PREVIEW_DEVICE='+JSON.stringify(device)+';</script><style>[data-cms-block]:hover{outline:2px solid #ffac30;outline-offset:2px;cursor:pointer!important}body:after{display:none!important}</style><script>document.addEventListener("click",function(e){let el=e.target.closest("[data-cms-block]");e.preventDefault();e.stopPropagation();if(el)parent.postMessage({type:"cms-select",block:el.getAttribute("data-cms-block")},new URL(document.baseURI).origin);},true);</script>';
function cards(meta,device){
 const url=escape(device==='mobile'?meta.mobile:meta.desktop),title=escape(meta.title),cover=escape(meta.cover||'/replica/donghan-logo.svg'),description=escape(meta.description||'');
 if(device==='mobile')return '<li class="loop item"><a href="'+url+'"><figure><img src="'+cover+'" alt="'+title+'"></figure><h3 class="tit">'+title+'</h3>'+(meta.kind==='news'?'<p class="txt">'+description+'</p>':'')+'</a></li>';
 if(meta.kind==='news'||meta.kind==='case')return '<li class="item"><a class="clearfix" href="'+url+'" title="'+title+'"><div class="txt fr"><h3>'+title+'</h3><p class="desc">'+description+'</p></div><div class="img"><img src="'+cover+'" alt="'+title+'"></div></a></li>';
 return '<li class="item"><a href="'+url+'"><img src="'+cover+'" alt="'+title+'"><p>'+title+'</p></a></li>';
}
export async function renderPage(request,env,path,preview=null){
 const c=await catalog(env);let state;try{state=await published(env);}catch{return new Response('网站内容服务暂不可用',{status:503});}
 let id=c.paths[path]||[...state].find(([id,m])=>m?.desktop===path||m?.mobile===path)?.[0];
 let doc=preview?.document||null,base=preview?.base||null;
 if(!doc && id && state.has(id)){const r=await row(env,id);doc=parse(r.published_json);base=await baseDoc(env,id,r);}
 if(doc?.meta.hidden&&!preview)return new Response('此内容已下架。',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8'}});
 const device=preview?.device||(path.startsWith('/mobile/')?'mobile':'desktop');
 const template=doc?.meta.created?base.meta[device] && (await baseDoc(env,doc.meta.templateId)).meta[device]:path;
 let assetPath=template||path;if(assetPath.endsWith('/'))assetPath+='index.html';
 const url=new URL(assetPath,request.url);const original=await env.ASSETS.fetch(new Request(url,{method:'GET'}));if(!original.ok)return original;
 const rewriter=new HTMLRewriter();
 if(doc){
  rewriter.on('title',{element:e=>e.setInnerContent(doc.meta.title)}).on('meta[name="description"]',{element:e=>e.setAttribute('content',doc.meta.description||'')}).on('[data-cms-role="title"]',{element:e=>e.setInnerContent(doc.meta.title)});
  rewriter.on('[data-cms-block]',{element(e){const key=e.getAttribute('data-cms-block'),block=doc.blocks?.[key];if(!block||block.value===base?.blocks?.[key]?.value)return;if(block.type==='html')e.setInnerContent(block.value,{html:true});else e.setAttribute(block.type==='image'?'src':'href',block.value);}});
  if(doc.meta.created)rewriter.on('script',{text(t){if(t.text.includes('window.KAISHAN_ROUTE='))t.replace('window.KAISHAN_ROUTE='+JSON.stringify({desktop:doc.meta.desktop,mobile:doc.meta.mobile})+';',{html:true});}});
 }
 rewriter.on('[data-cms-ref]',{element(e){const m=state.get(e.getAttribute('data-cms-ref'));if(!m)return;if(m.hidden)e.remove();else if(e.getAttribute('title'))e.setAttribute('title',m.title);}});
 rewriter.on('[data-cms-card]',{element(e){if(state.get(e.getAttribute('data-cms-card'))?.hidden)e.remove();}});
 rewriter.on('[data-cms-ref-title]',{element(e){const key=e.getAttribute('data-cms-ref-title'),m=state.get(key),originalMeta=c.documents.find(d=>d.id===key);if(m&&!m.hidden&&m.title!==originalMeta?.title)e.setInnerContent(m.title);}});
 rewriter.on('[data-cms-ref-description]',{element(e){const key=e.getAttribute('data-cms-ref-description'),m=state.get(key),originalMeta=c.documents.find(d=>d.id===key);if(m&&!m.hidden&&m.description!==originalMeta?.description)e.setInnerContent(m.description||'');}});
 rewriter.on('[data-cms-ref-image]',{element(e){const m=state.get(e.getAttribute('data-cms-ref-image'));if(m?.cover&&!m.hidden)e.setAttribute('src',m.cover).setAttribute('alt',m.title);}});
 const current=c.documents.find(m=>m.id===id);const additions=[...state.values()].filter(m=>m?.created&&!m.hidden && (current?.kind==='listing' && m.group===current.group || path==='/'&&['product','news','case'].includes(m.kind) || path==='/mobile/'&&['product','news','case'].includes(m.kind)));
 const lists=device==='mobile'?{product:'.caselist > ul',news:'.newsList > ul',case:'.newsList > ul'}:{product:'.honorlist > ul.list',news:'.thumblist > ul.list',case:'.thumblist > ul.list'};
 for(const kind of ['product','news','case']){
  const items=additions.filter(m=>m.kind===kind).map(m=>cards(m,device)).join('');if(!items)continue;
  let selector=lists[kind];if(path==='/'||path==='/mobile/')selector=device==='mobile'?({product:'#irepro .gridlist ul',news:'.inews ul.list',case:'#caseShow .bd ul'}[kind]):({product:'.in-prd-con ul.list-1',news:'.textlist > ul.list',case:'.proCase .bd ul.list'}[kind]);
  rewriter.on(selector,{element:e=>e.prepend(items,{html:true})});
 }
 if(preview)rewriter.on('head',{element:e=>e.prepend('<base href="'+escape(new URL(path,request.url).href)+'">'+previewScript(device),{html:true})});
 const originalMeta=c.documents.find(m=>m.id===id),seoMeta=doc?.meta||originalMeta;
 if(!preview&&seoMeta){
  rewriter.on('title,meta[name="description"],meta[name="keywords"],meta[name="robots"],link[rel="canonical"],link[rel="alternate"][media],meta[property^="og:"],meta[name^="twitter:"],script[type="application/ld+json"]',{element:e=>e.remove()});
  rewriter.on('head',{element:e=>e.append(seoHead(request,env,seoMeta,originalMeta||c.documents.find(m=>m.id===seoMeta.templateId)||base?.meta||seoMeta,device==='mobile'),{html:true})});
  if(seoMeta.kind==='home'){
   rewriter.on('head',{element:e=>e.append('<style>'+guideStyles+'</style>',{html:true})});
   let inserted=false;
   rewriter.on('.footer, #footer_main',{element(e){if(!inserted){inserted=true;e.before(guideLink,{html:true});}}});
  }
 }
 let response=rewriter.transform(original);
 if(state.has('settings')){
  const r=await row(env,'settings');const values=parse(r.published_json)?.values;
  if(values){const substitutions=[['上海开股机械有限公司',values.company],['13564562849',values.phone],['13585880278',values.phone],['021-57616590',values.hotline],['chengwei@kaishansales.com',values.email],['上海市松江区茸梅路1108号茸锦商务6楼',values.address],['上海市松江区茸梅路1108号茸锦商务7楼',values.address]];let skip=0,buffer='';
   const settingsRewriter=new HTMLRewriter().on('script,style',{element(e){skip++;e.onEndTag(()=>skip--);}}).on('body',{text(t){if(skip)return;buffer+=t.text;if(!t.lastInTextNode){t.remove();return;}let value=buffer;buffer='';for(const [from,to] of substitutions)value=value.split(from).join(to);t.replace(value);}})
    .on('img[src]',{element(e){const src=e.getAttribute('src');if(src.endsWith('/images/logo.png')||src.endsWith('/replica/donghan-logo.svg'))e.setAttribute('src',values.logo);if(src.endsWith('/images/erweima.png'))e.setAttribute('src',values.qr);}})
    .on('a[href^="tel:"]',{element:e=>e.setAttribute('href','tel:'+values.phone)})
    .on('[data-clipboard-text]',{element:e=>e.setAttribute('data-clipboard-text',values.wechat).setInnerContent(values.wechat)});
   response=settingsRewriter.transform(response);
  }
 }
 const headers=new Headers(response.headers);headers.delete('etag');headers.set('Cache-Control','private, no-store');headers.set('X-Content-Type-Options','nosniff');
 if(preview)headers.set('X-Robots-Tag','noindex, nofollow');
 return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
}
