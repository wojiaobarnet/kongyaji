window.DonghanMedia = function ({api, toast, dialog, escape, getPurpose}) {
 const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
 const purposes={banner:'首页轮播',product:'产品图片',news:'新闻封面',case:'案例图片',content:'正文插图',logo:'标志 / 二维码',other:'其他素材'};
 let cache=null,selected=null,busy=false;
 const options=current=>Object.entries(purposes).map(([id,label])=>'<option value="'+id+'" '+(id===current?'selected':'')+'>'+label+'</option>').join('');
 async function media(){return cache ||= (await api('media')).media;}
 const size=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.ceil(n/1024)+' KB';
 function grid(list){return list.map(m=>'<button class="media-card '+(selected===m.url?'selected':'')+'" data-media="'+escape(m.url)+'"><img src="'+escape(m.url)+'" loading="lazy" alt="'+escape(m.name)+'"><div class="media-info"><strong title="'+escape(m.name)+'">'+escape(m.name)+'</strong><small>'+(m.width&&m.height?m.width+' × '+m.height+' px · ':'')+size(m.size)+'</small><small>'+(m.original?'现有素材':purposes[m.purpose]||'已上传')+'</small></div></button>').join('');}
 function upload(file,purpose,onProgress){
  return new Promise((resolve,reject)=>{
   if(!/\.(png|jpe?g|gif|webp)$/i.test(file.name)||file.size>8388608||file.size<12){reject(new Error('请选择 8MB 以内的 PNG、JPG、GIF、WebP 图片'));return;}
   const xhr=new XMLHttpRequest(),form=new FormData();form.append('file',file);form.append('purpose',purpose);xhr.open('POST','/api/admin/upload');xhr.timeout=120000;
   xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100));};
   xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{reject(new Error('服务返回异常，请重试'));return;}if(xhr.status>=200&&xhr.status<300){cache=null;resolve(data);}else reject(new Error(data.error||'上传失败'));};xhr.onerror=()=>reject(new Error('网络中断，请重试'));xhr.ontimeout=()=>reject(new Error('上传超时，请重试'));xhr.send(form);
  });
 }
 function uploadArea(purpose){return '<div class="upload-zone" id="upload-zone" tabindex="0" role="button" aria-label="选择或拖入图片"><span class="upload-icon">↑</span><strong>拖入图片，或点击选择文件</strong><small>支持批量上传 · PNG / JPG / GIF / WebP · 单张不超过 8MB</small><input id="media-upload-input" type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden></div><div class="upload-settings"><label>上传用途 <select id="upload-purpose">'+options(purpose)+'</select></label><span class="note">同一张图片重复上传会自动复用，上传后需在页面中应用并发布。</span></div><div id="upload-queue" class="upload-queue" aria-live="polite"></div>';}
 function bindUploads(refresh){
  const zone=$('#upload-zone'),input=$('#media-upload-input'),queue=$('#upload-queue');
  const run=async files=>{
   if(busy){toast('请等待当前上传完成');return;}const list=[...files];if(!list.length)return;if(list.length>30){toast('每次最多选择 30 张图片');return;}
   busy=true;zone.classList.add('busy');const purpose=$('#upload-purpose').value,successful=[];
   queue.innerHTML=list.map((file,i)=>'<div class="upload-row" data-upload-row="'+i+'"><strong>'+escape(file.name)+'</strong><progress max="100" value="0"></progress><span>等待上传</span></div>').join('');
   let index=0;
   const worker=async()=>{while(index<list.length){const i=index++,file=list[i],row=$('[data-upload-row="'+i+'"]',queue);try{row.querySelector('span').textContent='上传中…';const result=await upload(file,purpose,n=>{row.querySelector('progress').value=n;row.querySelector('span').textContent=n===100?'保存中…':n+'%';});row.querySelector('progress').value=100;row.querySelector('span').textContent=result.reused?'已复用':'已完成';row.classList.add('success');successful.push(result.url);}catch(e){row.classList.add('failed');row.querySelector('span').textContent=e.message;const retry=document.createElement('button');retry.className='text-button';retry.textContent='重试';retry.onclick=()=>run([file]);row.append(retry);}}};
   try{await Promise.all([worker(),worker(),worker()]);if(successful.length){selected=successful[0];await refresh(successful);toast('已完成 '+successful.length+' / '+list.length+' 张图片');}}finally{busy=false;zone.classList.remove('busy');input.value='';}
  };
  zone.onclick=e=>{if(e.target!==input)input.click();};zone.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click();}};input.onchange=()=>run(input.files);
  zone.ondragover=e=>{e.preventDefault();zone.classList.add('dragover');};zone.ondragleave=()=>zone.classList.remove('dragover');zone.ondrop=e=>{e.preventDefault();zone.classList.remove('dragover');run(e.dataTransfer.files);};
 }
 async function picker(callback,{purpose=getPurpose()}={}){
  selected=null;let list=await media();
  dialog('<h2 class="dialog-heading">选择图片</h2><p class="note">先选中素材，再点击“应用图片”。新上传的图片会自动选中。</p>'+uploadArea(purpose)+'<div class="table-toolbar"><input class="search" id="picker-search" placeholder="搜索图片名称或原始文件名…"><select class="filter" id="picker-source"><option value="all">全部素材</option><option value="uploaded">我上传的图片</option><option value="original">现有素材</option></select></div><div class="media-grid dialog-media-grid" id="picker-grid"></div><div class="picker-footer"><span id="picker-selection" class="note">尚未选择图片</span><button class="button primary" id="picker-apply" disabled>应用图片</button></div>');
  const render=()=>{const q=$('#picker-search').value.toLowerCase(),source=$('#picker-source').value;$('#picker-grid').innerHTML=grid(list.filter(m=>(source==='all'||(source==='original')===m.original)&&(!q||[m.name,m.filename].join(' ').toLowerCase().includes(q))))||'<div class="empty">没有匹配的图片</div>';$$('[data-media]',$('#picker-grid')).forEach(b=>b.onclick=()=>{selected=b.dataset.media;render();});$('#picker-apply').disabled=!selected;$('#picker-selection').textContent=selected?'已选择：'+(list.find(m=>m.url===selected)?.name||'新上传图片'):'尚未选择图片';};
  $('#picker-search').oninput=render;$('#picker-source').onchange=render;$('#picker-apply').onclick=()=>{if(!selected)return;$('#dialog').close();callback(selected);};bindUploads(async()=>{list=await media();if($('#picker-grid')){$('#picker-search').value='';$('#picker-source').value='uploaded';render();}});render();
 }
 async function view(){
  selected=null;let list=await media();$('#workspace').innerHTML='<div class="page-heading"><div><h1>图片素材</h1><p>统一管理上传的图片，用于轮播、产品、新闻、案例和页面正文。</p></div><span class="pill">'+list.length+' 张素材</span></div><section class="panel upload-panel">'+uploadArea('other')+'</section><div class="media-toolbar"><input class="search" id="media-search" placeholder="搜索名称或文件名…"><select class="filter" id="media-type"><option value="all">全部素材</option><option value="uploaded">我上传的图片</option><option value="original">现有素材</option></select><select class="filter" id="media-purpose"><option value="all">全部用途</option>'+options('')+'</select><span id="media-count" class="note"></span></div><div class="media-grid" id="media-grid"></div>';
  const render=()=>{const q=$('#media-search').value.toLowerCase(),source=$('#media-type').value,purpose=$('#media-purpose').value,filtered=list.filter(m=>(source==='all'||(source==='original')===m.original)&&(purpose==='all'||m.purpose===purpose)&&(!q||[m.name,m.filename].join(' ').toLowerCase().includes(q)));$('#media-count').textContent='共 '+filtered.length+' 张';$('#media-grid').innerHTML=grid(filtered)||'<div class="empty">暂无匹配图片</div>';$$('[data-media]',$('#media-grid')).forEach(b=>b.onclick=()=>detail(list.find(m=>m.url===b.dataset.media),async()=>{list=await media();render();}));};
  $('#media-search').oninput=render;$('#media-type').onchange=render;$('#media-purpose').onchange=render;bindUploads(async()=>{list=await media();if($('#media-grid'))render();});render();
 }
 function detail(m,refresh){
  dialog('<h2 class="dialog-heading">图片详情</h2><img class="media-detail-image" src="'+escape(m.url)+'" alt="'+escape(m.name)+'"><div class="media-detail-grid"><div class="field"><label>图片名称</label><input id="media-name" maxlength="200" value="'+escape(m.name)+'" '+(m.original?'readonly':'')+'></div><div class="field"><label>用途</label><select id="media-edit-purpose" '+(m.original?'disabled':'')+'>'+options(m.purpose||'other')+'</select></div></div><p class="note">'+(m.width?m.width+' × '+m.height+' px · ':'')+size(m.size)+(m.created_at?' · 上传于 '+new Date(m.created_at).toLocaleString('zh-CN'):'')+'</p><details><summary>图片地址</summary><input class="search" style="width:100%;margin:12px 0" id="media-url" readonly value="'+escape(m.url)+'"></details><div class="actions"><button class="button" id="copy-media">复制地址</button>'+(!m.original?'<button class="button primary" id="media-edit-save">保存名称与用途</button>':'')+'</div>');
  $('#copy-media').onclick=async()=>{try{await navigator.clipboard.writeText(m.url);}catch{const input=$('#media-url');input.parentElement.open=true;input.select();document.execCommand('copy');}toast('图片地址已复制');};if($('#media-edit-save'))$('#media-edit-save').onclick=async()=>{try{await api('media-update',{id:m.id,name:$('#media-name').value,purpose:$('#media-edit-purpose').value});cache=null;$('#dialog').close();await refresh();toast('素材信息已保存');}catch(e){toast(e.message);}};
 }
 return {picker,view};
};
