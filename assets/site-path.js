(() => {
 'use strict';
 const base=window.DONGHAN_BASE_PATH||'';
 const admin=window.DONGHAN_ADMIN_PATH||'/admin';
 function path(value){
  if(typeof value!=='string'||!base)return value;
  if(admin!=='/admin'){
   if(value==='/admin'||/^\/admin[/?#]/.test(value))value=admin+value.slice('/admin'.length);
   else if(value===base+'/admin'||value.startsWith(base+'/admin/'))value=base+admin+value.slice((base+'/admin').length);
  }
  if(value.startsWith('/')&&!value.startsWith('//'))return value===base||value.startsWith(base+'/')||value.startsWith(base+'?')||value.startsWith(base+'#')?value:base+value;
  if(value.startsWith(location.origin+'/'))return location.origin+path(value.slice(location.origin.length));
  return value;
 }
 function unpath(value){return typeof value==='string'&&base&&value.startsWith(base+'/')?value.slice(base.length):value;}
 function html(value,reverse=false){
  if(!base)return value;
  const template=document.createElement('template');template.innerHTML=value;
  template.content.querySelectorAll('[src],[href],[action],[poster]').forEach(element=>{
   for(const attr of ['src','href','action','poster'])if(element.hasAttribute(attr))element.setAttribute(attr,(reverse?unpath:path)(element.getAttribute(attr)));
  });
  return template.innerHTML;
 }
 window.donghanPath=path;
 window.donghanHtml=html;
})();
