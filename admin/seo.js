(() => {
 'use strict';
 let refreshTimer,activeTab='issues';
 window.DonghanSeo={async render({api,escape:e,date,heading,toast,isActive}){
  clearTimeout(refreshTimer);
  const data=await api('seo');if(!isActive())return;
  const $=s=>document.querySelector(s),workspace=$('#workspace');
  const last=data.runs[0],summary=data.runs.find(r=>r.summary?.score!==undefined)?.summary;
  const browserRequests=data.daily.filter(d=>d.kind==='browser').reduce((n,d)=>n+d.count,0);
  const searchSources=['Google','百度','Bing','搜狗','360 搜索'];
  const searchRequests=data.sources.filter(d=>searchSources.includes(d.source)).reduce((n,d)=>n+d.count,0);
  const crawlerRequests=data.daily.filter(d=>d.kind==='crawler').reduce((n,d)=>n+d.count,0);
  const statuses={running:'执行中',success:'完成',warning:'完成，有待处理问题',failed:'失败'};
  const actionNames={start:'任务开始',metadata:'修复元数据',rollback:'恢复原值',discovery:'校验抓取文件',proxy:'检查代理规则',unchanged:'无需自动改写',complete:'任务完成',failed:'任务失败'};
  const table=(headers,rows,empty='暂无记录')=>'<div class="table-wrap"><table><thead><tr>'+headers.map(h=>'<th>'+e(h)+'</th>').join('')+'</tr></thead><tbody>'+(rows.join('')||'<tr><td colspan="'+headers.length+'" class="empty">'+e(empty)+'</td></tr>')+'</tbody></table></div>';
  const pageLink=url=>{try{const u=new URL(url);if(u.origin===location.origin&&u.pathname.startsWith((window.DONGHAN_BASE_PATH||'')+'/'))return '<a target="_blank" rel="noopener" href="'+e(url)+'">'+e(u.pathname)+'</a>';}catch{}return e(url);};
  workspace.innerHTML=heading('SEO 中心','检查网站能否被抓取、了解访问来源，并追踪每日优化任务。','<button class="button" id="seo-refresh">刷新数据</button><button class="button primary" id="seo-run" '+(last?.status==='running'?'disabled':'')+'>'+(last?.status==='running'?'检查执行中…':'立即检查与优化')+'</button>')+
   '<div class="stats">'+[['技术检查',summary?summary.score+' / 100':'待检查','站内检查指标，非搜索排名'],['浏览器页面请求',browserRequests,'近 30 天，包含页面重复访问'],['搜索来源请求',searchRequests,'按浏览器 Referer 识别'],['爬虫请求',crawlerRequests,'按声明的 User-Agent 识别']].map(([label,value,note])=>'<div class="stat"><div class="label">'+e(label)+'</div><strong>'+e(value)+'</strong><small>'+e(note)+'</small></div>').join('')+'</div>'+
   '<section class="panel"><div class="panel-body"><div class="seo-schedule"><div><strong>每日自动检查与安全优化</strong><p>'+e(data.schedule.enabled?'已启用：每天 '+data.schedule.time+'（'+data.schedule.timezone+'）':data.schedule.message||'服务器计划任务未启用')+'</p></div><div><span class="pill '+(data.schedule.enabled?'green':'orange')+'">'+(data.schedule.enabled?'自动运行':'未启用')+'</span></div></div>'+(data.schedule.nextRun?'<p class="note">下次计划：'+e(data.schedule.nextRun)+'</p>':'')+(data.schedule.lastServiceResult&&data.schedule.lastServiceResult!=='success'?'<div class="error-banner">定时服务上次执行异常：'+e(data.schedule.lastServiceResult)+'，退出码 '+e(data.schedule.lastServiceStatus)+'</div>':'')+'<p class="note">最近执行：'+e(last?date(last.started_at)+' · '+statuses[last.status]:'尚无执行记录')+(last?.summary?.error?' · '+e(last.summary.error):'')+'</p><p class="note">'+e(summary?'最近完成检查 '+summary.pages+' 页；错误 '+summary.errors+' 页，提醒 '+summary.warnings+' 页，自动修复 '+summary.changes+' 页。':'首次检查后展示页面质量和问题。')+'</p><div class="helper">自动修复仅用于可从已公开内容确定的历史模板标题、摘要；保留人工发布的内容。缺少主标题、图片说明或公司资料等问题会列出供人工处理。没有需要修复的问题时，记录检查结果，不反复改写内容。</div></div></section>'+
   '<section class="panel seo-panel"><div class="panel-heading"><h2>访问趋势 · 最近 30 天</h2><span class="note">采集开始于 '+e(date(data.trackingSince))+'</span></div><div class="panel-body" id="seo-chart"></div></section>'+
   '<div class="seo-tabs" role="group" aria-label="SEO 数据分类">'+[['issues','页面与问题'],['traffic','来源与页面'],['actions','优化动作'],['runs','运行日志']].map(([id,label],i)=>'<button class="button '+(!i?'primary':'')+'" data-seo-tab="'+id+'">'+label+'</button>').join('')+'</div><section class="panel"><div id="seo-detail"></div></section>'+
   '<p class="note seo-limits">'+e(data.limits.metrics)+'<br>搜索曝光、搜索结果点击、收录和关键词排名：未连接站长平台，暂无数据。'+e(data.limits.retention)+'</p>';
  const days=[];for(let i=29;i>=0;i--){const d=new Date(Date.now()-i*86400000);days.push(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(d));}
  const values=days.map(day=>data.daily.filter(d=>d.day===day&&d.kind==='browser').reduce((n,d)=>n+d.count,0)),max=Math.max(1,...values);
  $('#seo-chart').innerHTML='<div class="seo-chart" role="img" aria-label="最近三十天浏览器页面请求趋势">'+days.map((day,i)=>'<div class="seo-chart-column" title="'+e(day+'：'+values[i]+' 次')+'"><span style="height:'+Math.max(2,values[i]/max*110)+'px"></span><small>'+e(day.slice(5))+'</small></div>').join('')+'</div><p class="note">每日汇总请求量；鼠标移到柱形上查看日期与次数。自动检查和已登录管理员请求不计入。</p>';
  const renderTab=tab=>{
   activeTab=tab;
   document.querySelectorAll('[data-seo-tab]').forEach(b=>b.classList.toggle('primary',b.dataset.seoTab===tab));
   let html='';
   if(tab==='issues'){
    html='<div class="table-toolbar"><strong>最新完整检查的公开页面</strong><select class="filter" id="seo-severity"><option value="all">全部页面</option><option value="error">存在错误</option><option value="warning">存在提醒</option><option value="ok">检查通过</option></select></div><div id="seo-page-rows"></div><div class="pagination"><span id="seo-page-count"></span><div class="actions"><button class="button small" id="seo-prev">上一页</button><span id="seo-current"></span><button class="button small" id="seo-next">下一页</button></div></div>';
    $('#seo-detail').innerHTML=html;
    let pageNumber=1;
    const rows=()=>{const filter=$('#seo-severity').value;const pages=data.pages.filter(p=>filter==='all'||filter==='ok'&&!p.issues.length||p.issues.some(i=>i.level===filter)),total=Math.max(1,Math.ceil(pages.length/20));pageNumber=Math.min(total,Math.max(1,pageNumber));$('#seo-page-rows').innerHTML=table(['页面 / 标题','HTTP','检查结果'],pages.slice((pageNumber-1)*20,pageNumber*20).map(p=>'<tr><td>'+pageLink(p.url)+'<div class="note">'+e(p.title)+'</div></td><td>'+e(p.status||'失败')+'</td><td>'+(p.issues.length?p.issues.map(i=>'<div class="seo-issue"><span class="pill '+(i.level==='error'?'red':'orange')+'">'+(i.level==='error'?'错误':'提醒')+'</span> '+e(i.message)+'</div>').join(''):'<span class="pill green">通过</span>')+'</td></tr>'),'尚无检查结果，请运行首次检查');$('#seo-page-count').textContent='共 '+pages.length+' 页';$('#seo-current').textContent=pageNumber+' / '+total;$('#seo-prev').disabled=pageNumber===1;$('#seo-next').disabled=pageNumber===total;};$('#seo-severity').onchange=()=>{pageNumber=1;rows();};$('#seo-prev').onclick=()=>{pageNumber--;rows();};$('#seo-next').onclick=()=>{pageNumber++;rows();};rows();return;
   }
   if(tab==='traffic')html='<div class="panel-heading"><h2>浏览器访问来源 · HTTP 200</h2></div>'+table(['来源','请求数'],data.sources.map(s=>'<tr><td>'+e(s.source)+'</td><td>'+s.count+'</td></tr>'))+'<div class="panel-heading"><h2>热门页面 · HTTP 200</h2></div>'+table(['路径','请求数'],data.topPages.map(p=>'<tr><td>'+e(p.path)+'</td><td>'+p.count+'</td></tr>'))+'<div class="panel-heading"><h2>爬虫声明与响应</h2></div>'+table(['爬虫声明','HTTP','请求数'],data.crawlers.map(p=>'<tr><td>'+e(p.source)+'</td><td>'+p.status+'</td><td>'+p.count+'</td></tr>'));
   if(tab==='actions')html=table(['时间','动作','页面 / 说明'],data.actions.map(a=>'<tr><td class="note">'+e(date(a.time))+'</td><td>'+e(actionNames[a.type]||a.type)+'</td><td>'+(a.path?'<strong>'+e(a.path)+'</strong><br>':'')+e(a.detail)+'</td></tr>'));
   if(tab==='runs')html=table(['开始 / 完成','触发方式','状态','结果'],data.runs.map(r=>'<tr><td class="note">'+e(date(r.started_at))+'<br>'+(r.finished_at?e(date(r.finished_at)):'执行中')+'</td><td>'+e(r.trigger==='daily'?'每日定时':'管理员手动')+'</td><td><span class="pill '+(r.status==='failed'?'red':r.status==='success'?'green':'orange')+'">'+e(statuses[r.status])+'</span></td><td>'+e(r.summary?.error|| (r.summary?'检查 '+r.summary.pages+' 页，修复 '+r.summary.changes+' 页，问题 '+r.summary.issues+' 项':'正在抓取公开页面…'))+'</td></tr>'));
   $('#seo-detail').innerHTML=html;
  };
  document.querySelectorAll('[data-seo-tab]').forEach(b=>b.onclick=()=>renderTab(b.dataset.seoTab));renderTab(activeTab);
  const reload=()=>window.DonghanSeo.render({api,escape:e,date,heading,toast,isActive}).catch(error=>toast(error.message));
  $('#seo-refresh').onclick=reload;
  $('#seo-run').onclick=async()=>{const b=$('#seo-run');b.disabled=true;try{const result=await api('seo/run',{});toast(result.message);await reload();}catch(error){b.disabled=false;toast(error.message);}};
  if(last?.status==='running')refreshTimer=setTimeout(()=>{if(isActive())reload();},5000);
 }};
})();
