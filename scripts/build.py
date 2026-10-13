#!/usr/bin/env python3
"""Build portable pages without altering the original layout and page content."""
import base64, html, json, pathlib, re, shutil, urllib.parse
from mirror import ROOT, ROOTS, HOSTS, CATS, normalize
OUTPUT=ROOT/'public'
ASSET_EXT={'.css','.js','.jpg','.jpeg','.png','.gif','.webp','.svg','.ico','.woff','.woff2','.ttf','.eot','.mp4','.pdf'}
def page_url(site,path):return ('/mobile' if site=='mobile' else '')+path

def rewrite(ref,site,path,attribute='href'):
 ref=html.unescape(ref)
 if not ref:return page_url(site,'/') if attribute=='href' else ref
 if ref.startswith(('javascript:','javascritp:')):
  return 'tel:02157616590' if ref.startswith('javascritp:') else ref
 if ref.startswith(('#','mailto:','tel:','data:','weixin:')):return ref
 if ref=='//':return page_url(site,'/')
 if ref.startswith('https://link.wtturl.cn/'):
  target=urllib.parse.parse_qs(urllib.parse.urlsplit(ref).query).get('target',[''])[0]
  if urllib.parse.urlsplit(target).hostname in HOSTS:ref=target
 if 'p.qiao.baidu.com/' in ref:return page_url(site,'/listinfo-6-0.html' if site=='mobile' else '/consultation/')
 if ref.split('/')[0] in CATS:ref='/'+ref
 u=urllib.parse.urlsplit(urllib.parse.urljoin(ROOTS[site]+path,ref));target=HOSTS.get(u.hostname)
 if not target:return ref
 p=urllib.parse.unquote(u.path) or '/'
 if not p.strip('/').strip():p='/'
 is_asset=pathlib.PurePosixPath(p).suffix.lower() in ASSET_EXT
 if not is_asset and not pathlib.PurePosixPath(p).suffix:p=p.rstrip('/')+'/' if p!='/' else p
 # Desktop /d images are shared by both versions, while /public differs.
 prefix='/mobile' if target=='mobile' else ''
 query='?view='+urllib.parse.parse_qs(u.query)['view'][0] if urllib.parse.parse_qs(u.query).get('view',[''])[0] in ('desktop','mobile') else ''
 return prefix+p+query+('#'+u.fragment if u.fragment else '')

def css_rewrite(s,site,path,missing):
 def sub(m):
  ref=m.group(2).strip();norm=normalize(ref,ROOTS[site]+path,'asset')
  if ref=='none':return 'none'
  if norm in missing:return 'url("/replica/transparent.png")'
  return 'url("'+rewrite(ref,site,path,'src')+'")' if norm else m.group(0)
 return re.sub(r'url\(\s*([\'\"]?)(.*?)\1\s*\)',sub,s)

def main():
 if OUTPUT.exists():shutil.rmtree(OUTPUT)
 OUTPUT.mkdir()
 inventory=json.loads((ROOT/'source/snapshot-manifest.json').read_text())
 routes={};inverse={};redirects={}
 for item in inventory['pages']:
  if item['site']!='desktop':continue
  p=item['path'];file=ROOT/'source'/'desktop'/(p.lstrip('/')+('index.html' if p.endswith('/') else ''))
  s=file.read_text(encoding='utf-8',errors='replace')
  m=re.search(r'window\.location\.href\s*=\s*[\'\"]http://m\.kaishansales\.com([^\'\"]*)',s)
  if m:
   mobile='/mobile'+(m.group(1) or '/');routes[p]=mobile;inverse.setdefault(mobile,p)
 missing={(i['site'],i['path']) for i in inventory['errors']}
 for item in inventory['pages']+inventory['assets']:
  site,path=item['site'],item['path'];src=ROOT/'source'/site/(path.lstrip('/')+('index.html' if path.endswith('/') else ''))
  out=OUTPUT/('mobile' if site=='mobile' else '')/src.relative_to(ROOT/'source'/site)
  out.parent.mkdir(parents=True,exist_ok=True)
  if src.suffix not in ('.html','.css','.js'):shutil.copyfile(src,out);continue
  s=src.read_text(encoding='utf-8-sig',errors='replace')
  if src.suffix=='.html':
   s=re.sub(r'<!DOCTYPE[^>]*>', '<!doctype html>',s,count=1,flags=re.I)
   if site=='desktop' and path in ('/news/pc/','/news/m/'):
    s='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>新闻动态</title></head><body><script>window.location.href="/news/enterprise/";</script><a href="/news/enterprise/">查看新闻动态</a></body></html>'
   if site=='mobile' and '<b>此信息不存在</b>' in s:
    # The original mobile endpoint for this award is broken; retain its desktop source.
    desktop=inverse.get(page_url(site,path),'/news/')
    s='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>开山荣誉</title></head><body><script>window.location.href='+json.dumps(ROOTS['desktop']+desktop+'?view=desktop')+';</script></body></html>'
   s=re.sub(r'<!--.*?-->','',s,flags=re.S)
   # Remove PHP counters, membership scripts, old UA redirects, and unavailable map SDK.
   def script_sub(m):
    tag,body=m.group(1),m.group(2)
    if re.search(r'\bsrc\s*=',tag,re.I):
     if '/e/' in tag or '/enews/' in tag or '/public/js/map.js' in tag:return ''
     return m.group(0)
    if 'pref=padindex' in body or "$('#tj')" in body or 'loginjs.php' in body or 'BMap.' in body or 'var secs=' in body:return ''
    return m.group(0)
   s=re.sub(r'(<script\b[^>]*>)(.*?)</script>',script_sub,s,flags=re.S|re.I)
   s=re.sub(r'<meta\b[^>]*http-equiv=[\'\"]mobile-agent[\'\"][^>]*>','',s,flags=re.I)
   # Repoint both quoted and unquoted URL attributes, including original malformed markup.
   s=re.sub(r'(?<!\.)\b(href|src|action)\s*=\s*([\'\"])(.*?)\2',lambda m:m.group(1)+'='+m.group(2)+html.escape('/api/inquiries' if m.group(1).lower()=='action' else rewrite(m.group(3),site,path,m.group(1).lower()),quote=True)+m.group(2),s,flags=re.I|re.S)
   s=re.sub(r'window\.location(?:\.href)?\s*=\s*([\'\"])([^\'\"]+)\1',lambda m:'window.location.replace('+json.dumps(rewrite(m.group(2),site,path))+')',s)
   s=css_rewrite(s,site,path,missing)
   url=page_url(site,path)
   mapping={'desktop':path if site=='desktop' else inverse.get(url,'/'),'mobile':routes.get(path,'/mobile/') if site=='desktop' else url}
   includes='<link rel="icon" type="image/png" href="/public/images/logo.png"><script>window.KAISHAN_ROUTE='+json.dumps(mapping,ensure_ascii=False)+';</script><script src="/replica/replica.js"></script><link href="/replica/replica.css" rel="stylesheet">'
   # Viewport must precede the redirect script so phones evaluate CSS width correctly.
   if 'name="viewport"' not in s:s=s.replace('</head>','<meta name="viewport" content="width=device-width, initial-scale=1"></head>',1)
   viewport=re.search(r'<meta\b[^>]*name="viewport"[^>]*>',s)
   if viewport:
    s=s.replace(viewport.group(0),'',1);includes=viewport.group(0)+includes
   if '<head>' in s:s=s.replace('<head>','<head>\n'+includes,1)
   else:
    # Script-only section aliases remain operational and receive a proper document shell.
    s='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>开山空压机</title>'+includes+'</head><body>'+s+'</body></html>'
   s=re.sub(r'<html\b(?![^>]*\blang=)', '<html lang="zh-CN"',s,count=1)
   if site=='desktop' and 'name="viewport"' not in s:s=s.replace('</head>','<meta name="viewport" content="width=device-width, initial-scale=1"></head>',1)
   s=s.replace('maximum-scale=1.0, user-scalable=no, ','')
   if '<div id="allmap"></div>' in s:
    # A provider-independent live map replaces the original SDK tied to the old origin.
    s=s.replace('<div id="allmap"></div>','<div id="allmap"><iframe title="上海开股机械有限公司位置地图" style="width:100%;height:100%;border:0" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=121.238%2C31.044%2C121.248%2C31.052&amp;layer=mapnik&amp;marker=31.04766%2C121.24225"></iframe></div>')
  elif src.suffix=='.css':s=css_rewrite(s,site,path,missing)
  elif path=='/public/js/index.js' and site=='desktop':
   s=re.sub(r'var _hmt.*?\}\)\(\);','',s,count=1,flags=re.S)
   s=re.sub(r'function share\(\)\s*\{.*?(?=function AddFavorite)', 'function share() {}\n\n',s,flags=re.S)
  elif path=='/public/js/common.js' and site=='mobile':s='/* Original analytics removed; interactions stay in app.js. */\n'
  elif path=='/public/js/app.js' and site=='mobile':s=s.replace('new Clipboard(btn)', 'new Clipboard(btn || "#btn")')
  elif path=='/public/js/map.js':s='/* Map is embedded in the contact page. */\n'
  out.write_text(s,encoding='utf-8')
 (OUTPUT/'replica').mkdir()
 for p in (ROOT/'assets').iterdir():shutil.copyfile(p,OUTPUT/'replica'/p.name)
 (OUTPUT/'replica/transparent.png').write_bytes(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAarVyFEAAAAASUVORK5CYII='))
 from cms_build import generate
 generate(OUTPUT,routes)
 if (ROOT/'admin').exists():shutil.copytree(ROOT/'admin',OUTPUT/'admin',dirs_exist_ok=True)
 shutil.copyfile(OUTPUT/'index.html',ROOT/'index.html')
 (OUTPUT/'index.html').unlink() # Vite emits the root index, all remaining pages are public assets.
 (OUTPUT/'404.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>页面不存在</title><body style="font:16px Microsoft Yahei,sans-serif;text-align:center;padding:80px 20px;color:#555"><h1>页面不存在</h1><p>请返回首页浏览产品、新闻及服务。</p><a href="/" style="color:#087bbf">返回首页</a></body></html>')
 (ROOT/'replica-inventory.json').write_text(json.dumps({'sources':ROOTS,'pages':inventory['pages'],'assets':inventory['assets'],'original_missing_assets':inventory['errors'],'route_map':routes},ensure_ascii=False,indent=2)+'\n')
 print(f"Prepared {len(inventory['pages'])} pages and {len(inventory['assets'])} assets; {len(missing)} original missing decorations removed.")
if __name__=='__main__':main()
