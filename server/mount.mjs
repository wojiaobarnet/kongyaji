import {HTMLRewriter} from '@worker-tools/html-rewriter/base64';

export function mountUrl(value,basePath,origin,adminPath='/admin'){
 if(!basePath||typeof value!=='string'||!value)return value;
 if(value.startsWith('/')&&!value.startsWith('//')){
  if(adminPath!=='/admin'){
   if(value==='/admin'||/^\/admin[/?#]/.test(value))value=adminPath+value.slice('/admin'.length);
   else if(value===basePath+'/admin'||value.startsWith(basePath+'/admin/'))value=basePath+adminPath+value.slice((basePath+'/admin').length);
  }
  if(value===basePath||value.startsWith(basePath+'/')||value.startsWith(basePath+'?')||value.startsWith(basePath+'#'))return value;
  return basePath+value;
 }
 if(origin&&value.startsWith(origin+'/'))return origin+mountUrl(value.slice(origin.length),basePath,undefined,adminPath);
 return value;
}
export const mountCss=(value,basePath,origin)=>value.replace(/url\(\s*(["']?)([^"')]*?)\1\s*\)/gi,(all,quote,url)=>'url('+quote+mountUrl(url,basePath,origin)+quote+')');

function mountInlineScript(script,basePath,origin){
 return script.replace(/window\.KAISHAN_ROUTE\s*=\s*(\{[^;]*\});/g,(all,value)=>{
  try{const routes=JSON.parse(value);for(const key of ['desktop','mobile'])if(routes[key])routes[key]=mountUrl(routes[key],basePath,origin);return 'window.KAISHAN_ROUTE='+JSON.stringify(routes)+';';}catch{return all;}
 }).replace(/((?:window\.)?location\.(?:replace|assign)\(\s*)(["'])([^"']*)\2/g,(all,start,quote,url)=>start+quote+mountUrl(url,basePath,origin)+quote);
}
export async function mountResponse(response,basePath,origin,adminPath='/admin'){
 if(!basePath)return response;
 const headers=new Headers(response.headers);
 if(headers.has('location'))headers.set('location',mountUrl(headers.get('location'),basePath,origin,adminPath));
 if(headers.has('set-cookie'))headers.set('set-cookie',headers.get('set-cookie').replace(/; Path=\/;/g,'; Path='+basePath+'/;'));
 const type=headers.get('content-type')||'';
 if(!response.body)return new Response(null,{status:response.status,headers});
 if(type.includes('text/html')){
  const rewriter=new HTMLRewriter().on('head',{element(e){e.prepend('<script>window.DONGHAN_BASE_PATH='+JSON.stringify(basePath)+';window.DONGHAN_ADMIN_PATH='+JSON.stringify(adminPath)+';</script><script src="'+basePath+'/replica/site-path.js?v=20261013-seo"></script>',{html:true});}});
  rewriter.on('*',{element(e){
   for(const attr of ['href','src','action','poster']){const value=e.getAttribute(attr);if(value!==null){let mounted=mountUrl(value,basePath,origin,adminPath);if(attr==='src'&&/\/(?:admin|replica)\/[^?#]+\.js$/.test(value))mounted+='?v=20261013-seo';e.setAttribute(attr,mounted);}}
   const srcset=e.getAttribute('srcset');if(srcset&&!srcset.includes('data:'))e.setAttribute('srcset',srcset.split(',').map(item=>item.trim().replace(/^\S+/,url=>mountUrl(url,basePath,origin))).join(', '));
   const style=e.getAttribute('style');if(style)e.setAttribute('style',mountCss(style,basePath,origin));
  }});
  for(const tag of ['script','style']){let buffer='';rewriter.on(tag,{text(t){buffer+=t.text;if(!t.lastInTextNode){t.remove();return;}t.replace(tag==='script'?mountInlineScript(buffer,basePath,origin):mountCss(buffer,basePath,origin),{html:true});buffer='';}});}
  headers.delete('content-length');headers.delete('etag');headers.set('Cache-Control','private, no-store');
  return rewriter.transform(new Response(response.body,{status:response.status,headers}));
 }
 if(type.includes('text/css')){
  headers.delete('content-length');headers.delete('etag');
  return new Response(mountCss(await response.text(),basePath,origin),{status:response.status,headers});
 }
 return new Response(response.body,{status:response.status,headers});
}
