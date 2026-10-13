// Public metadata only: never read drafts, credentials, inquiries or private settings.
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
export const guideMeta = {desktop:'/guide/', title:'空压机选型指南与常见问题', description:'从用气压力、流量、空气质量和安装条件整理选型需求，按网站分类查找空压机、后处理与配件，并提交咨询。', kind:'page', category:'选型指南', modified:'2026-10-13'};
export function publicUrl(request, env, path = '/') {
 const origin = new URL(env.PUBLIC_URL || request.url).origin;
 return origin + (env.BASE_PATH || '') + path;
}
export function metadata(meta, baseline = meta) {
 const category = plain(meta.category).split('_')[0].replace(/^浙江/, '').replace(/有限公司$/, '');
 const page=meta.desktop.match(/\/index_(\d+)\.html$/)?.[1];
 const originalTitle = plain(meta.title).split(/[|_]/)[0]+(page?`（第${page}页）`:'');
 const title = meta.kind === 'home' && meta.title === baseline.title ? '東悍空压机｜产品目录、选型与服务' : originalTitle + (originalTitle.includes('東悍') ? '' : '｜東悍');
 let description;
 // An owner-published, changed summary takes priority over snapshot marketing copy.
 if (meta.description && meta.description !== baseline.description) description = plain(meta.description);
 else if (meta.desktop === guideMeta.desktop) description = guideMeta.description;
 else if (meta.kind === 'home') description = '浏览東悍网站的螺杆式、永磁变频、无油、离心式、活塞式及激光切割空压机目录，查看产品说明、选型指南、技术文章与咨询入口。';
 else if (meta.kind === 'listing') description = `浏览${category || originalTitle}目录${page?`第${page}页`:''}，查看相关${meta.desktop.startsWith('/product/') ? '产品介绍、图片与型号信息' : '内容介绍和详情'}，按实际需求进一步了解。`;
 else if (meta.kind === 'product') description = `${originalTitle}：查看${category || '产品'}介绍、图片及页面公布的参数。选型时请核对用气压力、流量、空气质量与具体型号资料。`;
 else if (meta.kind === 'news' || meta.kind === 'case') description = `${originalTitle}。查看${meta.kind === 'case' ? '案例' : '文章'}正文与相关${category || '栏目'}内容。`;
 else description = `${originalTitle}：查看页面说明，了解相关服务与咨询方式。`;
 return {title:title.slice(0,120), description:description.slice(0,180)};
}
export function seoHead(request, env, meta, baseline = meta, mobile = false) {
 const {title,description} = metadata(meta,baseline), canonical = publicUrl(request,env,meta.desktop), home=publicUrl(request,env);
 const graph = [
  {'@type':'WebSite','@id':home+'#website',url:home,name:'東悍空压机',inLanguage:'zh-CN'},
  {'@type':'WebPage','@id':canonical+'#webpage',url:canonical,name:title,description,inLanguage:'zh-CN',isPartOf:{'@id':home+'#website'},...(meta.modified?{dateModified:meta.modified}:{})}
 ];
 if(meta.desktop!=='/') {
  const items=[{'@type':'ListItem',position:1,name:'東悍首页',item:home}];
  if(meta.group && meta.group!==meta.desktop && meta.group!=='/')items.push({'@type':'ListItem',position:2,name:meta.category||'内容栏目',item:publicUrl(request,env,meta.group)});
  items.push({'@type':'ListItem',position:items.length+1,name:plain(meta.title).split(/[|_]/)[0],item:canonical});
  graph.push({'@type':'BreadcrumbList','@id':canonical+'#breadcrumb',itemListElement:items});
  graph[1].breadcrumb={'@id':canonical+'#breadcrumb'};
 }
 const image=meta.cover?new URL(meta.cover.startsWith('/')?publicUrl(request,env,meta.cover):meta.cover,home).href:null;
 return `<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${escape(canonical)}">`+
 (!mobile&&meta.mobile?`<link rel="alternate" media="only screen and (max-width: 767px)" href="${escape(publicUrl(request,env,meta.mobile))}">`:'')+
 `<meta property="og:type" content="website"><meta property="og:site_name" content="東悍空压机"><meta property="og:locale" content="zh_CN"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}">`+
 (image?`<meta property="og:image" content="${escape(image)}">`:'')+
 `<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c')}</script>`;
}
export function sitemap(request,env,documents) {
 const urls=documents.map(meta=>`<url><loc>${escape(publicUrl(request,env,meta.desktop))}</loc>${meta.modified?`<lastmod>${escape(meta.modified)}</lastmod>`:''}</url>`).join('\n');
 return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
}
export function robots(request,env) {
 const prefix=env.BASE_PATH||'',admin=env.ADMIN_PATH||'/admin';
 // No host-wide block: this origin also hosts unrelated sites.
 return new Response(`User-agent: *\nDisallow: ${prefix}${admin}\nDisallow: ${prefix}/admin\nDisallow: ${prefix}/api/\nDisallow: ${prefix}/cms/\nDisallow: ${prefix}/healthz\n\nSitemap: ${publicUrl(request,env,'/sitemap.xml')}\n`,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-cache'}});
}
export function llms(request,env,documents) {
 const links=documents.filter(d=>d.kind==='listing'&&!/index_\d+\.html$/.test(d.desktop)).map(d=>`- [${plain(d.category)}](${publicUrl(request,env,d.desktop)}): 网站公开栏目。`).join('\n');
 return new Response(`# 東悍空压机网站\n\n> 产品目录、选型资料与咨询入口。\n\n## 导航\n\n- [首页](${publicUrl(request,env)})\n- [选型指南与常见问题](${publicUrl(request,env,'/guide/')})\n- [网站地图](${publicUrl(request,env,'/sitemap.xml')})\n${links}\n\n## 内容边界\n\n型号与参数以链接页面及经确认的具体型号资料为准；网站未公开确定售价、库存或评价。历史镜像中的公司资料、资质及案例需要网站所有者核实。此文件只是可选导航索引，不代表搜索引擎或 AI 平台已收录、推荐或认证本网站。\n`,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-cache','X-Robots-Tag':'noindex'}});
}
export const guideLink = `<section class="dh-guide-entry" aria-labelledby="dh-guide-title"><h2 id="dh-guide-title">空压机选型，从用气需求开始</h2><p>整理工作压力、用气流量、空气质量与安装条件，再核对具体型号。</p><a href="/guide/">阅读选型指南与常见问题 →</a></section>`;
export const guideStyles = `.dh-guide-entry{box-sizing:border-box;max-width:1200px;margin:30px auto;padding:28px;background:#f1f6fa;border-left:4px solid #087bbf;color:#17334a;font:16px/1.8 system-ui,sans-serif}.dh-guide-entry h2{font-size:24px;margin:0 0 8px}.dh-guide-entry p{margin:0 0 10px}.dh-guide-entry a{color:#0872ae;text-decoration:underline}@media(max-width:767px){.dh-guide-entry{margin:24px 16px;padding:22px}.dh-guide-entry h2{font-size:21px}}`;
export function guidePage(request,env) {
 const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${seoHead(request,env,guideMeta)}<link rel="icon" href="/replica/donghan-logo.svg"><style>*{box-sizing:border-box}body{margin:0;color:#20354a;background:#f8fafc;font:16px/1.9 system-ui,"Microsoft Yahei",sans-serif}header{background:white;border-bottom:1px solid #e3eaf0}nav{max-width:1050px;margin:auto;padding:20px 24px;display:flex;gap:24px;align-items:center;flex-wrap:wrap}nav img{width:140px;max-height:55px}a{color:#0872ae}main{max-width:950px;margin:40px auto;padding:0 24px}h1{font-size:clamp(28px,5vw,42px);line-height:1.4;margin:16px 0}h2{font-size:25px;color:#183e5e;margin:34px 0 12px}h3{font-size:18px;margin:0 0 8px}p{margin:0 0 16px}.eyebrow{font-size:13px;color:#63778b}.lead{font-size:19px;color:#50677b}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.card,article{background:white;border:1px solid #e1e9f0;border-radius:12px;padding:24px}.card p{margin:0}.steps li{margin:10px 0}table{width:100%;border-collapse:collapse;font-size:15px}th,td{padding:14px;text-align:left;border-bottom:1px solid #e5ecf2}th{background:#edf4f9}td:first-child{width:35%}.table-wrap{overflow:auto;border:1px solid #e1e9f0;border-radius:10px}details{border-bottom:1px solid #e5ecf2;padding:18px 0}summary{font-weight:600;cursor:pointer}details p{margin:12px 0 0}.cta{background:#163c5b;color:white;padding:28px;border-radius:12px;margin:30px 0}.cta a{display:inline-block;background:white;color:#163c5b;padding:8px 18px;border-radius:6px}.sources{font-size:14px;color:#586e81}footer{font-size:14px;text-align:center;padding:25px;color:#63778b}@media(max-width:640px){.grid{grid-template-columns:1fr}nav{gap:16px}.card,article{padding:20px}main{margin:25px auto;padding:0 18px}th,td{padding:10px}h2{font-size:22px}}</style></head><body><header><nav aria-label="主导航"><a href="/"><img src="/replica/donghan-logo.svg" alt="東悍网站首页"></a><a href="/product/">产品目录</a><a href="/service/technical/">技术资料</a><a href="/consultation/">购买咨询</a></nav></header><main><p class="eyebrow"><a href="/">首页</a> / 选型指南 · 更新于 2026-10-13</p><h1>空压机选型指南与常见问题</h1><p class="lead">先明确需要怎样的压缩空气，再比较具体型号。这里汇总网站已有目录和询价前需要整理的信息，帮助你更快找到相关资料。</p><h2>询价前，先准备四项信息</h2><div class="grid"><section class="card"><h3>工作压力</h3><p>记录用气设备需要的工作压力及单位，并说明压力波动要求。设备所需压力与系统供气压力需要结合管路等条件一起核对。</p></section><section class="card"><h3>用气流量</h3><p>记录各设备需求、同时运行数量、峰值与平均用气量，并保留计量条件和单位。只知道电机功率，无法完整表达用气需求。</p></section><section class="card"><h3>空气质量</h3><p>说明对油、水、颗粒和露点的要求，以及具体工艺用途；同时核对干燥、过滤和其它后处理设备的配置。</p></section><section class="card"><h3>运行与安装条件</h3><p>说明每日运行时长、负荷变化、供电、环境温度、空间及通风条件。有现用设备时，提供铭牌和运行记录便于比较。</p></section></div><p class="sources">上述需求整理参考美国能源部《Improving Compressed Air System Performance》，并需结合实际现场与设备资料确认。</p><h2>按目录寻找相关产品</h2><p>以下链接对应网站现有分类。目录名称用于导航，具体型号是否适合现场需求，需要进一步核对参数。</p><div class="table-wrap"><table><thead><tr><th scope="col">目录</th><th scope="col">从这里查看</th></tr></thead><tbody><tr><td>螺杆式空压机</td><td><a href="/product/lgs/">产品介绍、图片与型号</a></td></tr><tr><td>永磁变频螺杆机</td><td><a href="/product/ycbp/">对应分类目录</a></td></tr><tr><td>无油螺杆空压机</td><td><a href="/product/wy/">对应分类目录</a></td></tr><tr><td>离心式、活塞式</td><td><a href="/product/lxs/">离心式目录</a> · <a href="/product/hss/">活塞式目录</a></td></tr><tr><td>激光切割空压机</td><td><a href="/product/ccg/">对应分类目录</a></td></tr><tr><td>后处理与配件</td><td><a href="/product/hcl/">空压机后处理</a> · <a href="/product/pj/">配件目录</a></td></tr></tbody></table></div><h2>常见问题</h2><article><details open><summary>怎样比较两个空压机型号？</summary><p>先核对相同工作压力和计量条件下的流量，再比较空气质量、运行负荷、安装要求及维护条件。缺少参数时，应索取具体型号资料；不能仅凭名称或电机功率判断适用性。</p></details><details open><summary>价格在哪里查看？</summary><p>网站目前没有统一公开价目表。可在购买咨询页面留下需求和联系方式，报价时需要明确型号、数量、后处理配置及服务范围。</p></details><details open><summary>选型咨询应该填写什么？</summary><p>填写姓名、手机号码和需求说明。建议在说明中写明用途、压力、流量和运行时间；如参数尚未确定，可先描述现场使用情况。</p></details><details open><summary>网站参数可以直接当作采购合同吗？</summary><p>页面用于资料浏览和咨询。采购前请核对具体型号的正式技术文件、供货范围和报价条款，尤其是历史文章与案例中的信息。</p></details></article><section class="cta"><h2 style="color:inherit;margin-top:0">把需求整理好，再开始咨询</h2><p>在咨询说明中写清用途、压力、流量和运行时间，便于进一步核对型号。</p><a href="/consultation/">提交选型咨询</a></section><section class="sources"><h2>参考资料与内容说明</h2><p>产品分类来源：本网站对应的公开目录。工况整理参考：<a href="https://www.energy.gov/sites/prod/files/2014/05/f16/compressed_air_sourcebook.pdf" rel="noopener" target="_blank">美国能源部《Improving Compressed Air System Performance》</a>。该资料提供通用系统评估思路，不代表对本网站产品的认证或推荐。</p><p>本页由网站维护方整理，更新日期为实际内容更新日期。型号、资质、案例和公司资料以网站所有者核实的信息及正式文件为准。</p></section></main><footer>東悍网站 · <a href="/">返回首页</a> · <a href="/contact/">联系我们</a></footer></body></html>`;
 return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'}});
}
