#!/usr/bin/env python3
"""Fetch the public desktop/mobile trees, retaining resumable source snapshots."""
import concurrent.futures, html, json, pathlib, re, time, urllib.parse, urllib.request
from html.parser import HTMLParser
ROOT=pathlib.Path(__file__).resolve().parents[1]
HOSTS={'www.kaishansales.com':'desktop','kaishansales.com':'desktop','m.kaishansales.com':'mobile'}
ROOTS={'desktop':'http://www.kaishansales.com','mobile':'http://m.kaishansales.com'}
CATS=('about','product','news','case','service','consultation','contact')
class Links(HTMLParser):
 def __init__(self): super().__init__(convert_charrefs=True);self.links=[];self.assets=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='a' and a.get('href'):self.links.append(a['href'])
  if tag in ('img','script','source','iframe','video','audio') and a.get('src'): self.assets.append(a['src'])
  if tag=='link' and a.get('href') and a.get('rel','') not in ('canonical','alternate'):self.assets.append(a['href'])
  if a.get('style'):self.assets.extend(re.findall(r'url\([\'\"]?([^\)\'\"]+)',a['style']))
 def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs)
def normalize(ref,base,kind='page'):
 ref=html.unescape(ref).strip()
 if not ref or ref.startswith(('#','javascript:','javascritp:','tel:','mailto:','data:','weixin:')):return None
 if kind=='page' and ref.split('/')[0] in CATS: ref='/'+ref
 u=urllib.parse.urlsplit(urllib.parse.urljoin(base,ref));site=HOSTS.get(u.hostname)
 if not site:return None
 path=urllib.parse.unquote(u.path) or '/'
 if '..' in pathlib.PurePosixPath(path).parts:return None
 if kind=='page':
  if site=='desktop' and path!='/' and path.strip('/').split('/')[0] not in CATS:return None
  if site=='mobile' and path!='/' and not re.fullmatch(r'/(?:listinfo|showinfo)-[\d-]+\.html',path):return None
  if not pathlib.PurePosixPath(path).suffix and path!='/':path=path.rstrip('/')+'/'
  if pathlib.PurePosixPath(path).suffix not in ('','.html','.htm'):return None
 else:
  if pathlib.PurePosixPath(path).suffix.lower() not in ('.css','.js','.jpg','.jpeg','.png','.gif','.webp','.svg','.ico','.woff','.woff2','.ttf','.eot','.mp4','.pdf'):return None
 return site,path

def localpath(site,path,kind):
 if kind=='page':return ROOT/'source'/site/(path.lstrip('/')+('index.html' if path.endswith('/') else ''))
 return ROOT/'source'/site/path.lstrip('/')
def fetch(item):
 site,path,kind=item;p=localpath(site,path,kind)
 if p.exists():return item,p.read_bytes(),None
 url=ROOTS[site]+urllib.parse.quote(path,safe='/%:@')
 for attempt in range(3):
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; SiteReplica/1.0)'})
   with urllib.request.urlopen(req,timeout=25) as r:
    b=r.read();ctype=r.headers.get('Content-Type','')
    if kind=='asset' and 'text/html' in ctype:raise ValueError('Asset returned HTML')
   p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b);return item,b,None
  except Exception as e:
   error=str(e)
   if '404' in error:break
 return item,None,error

def main():
 (ROOT/'research').mkdir(exist_ok=True)
 pending={('desktop','/','page'),('mobile','/','page')};done=set();errors=[];pages=[];assets=[]
 for site,file in [('desktop','desktop'),('mobile','mobile')]:
  p=localpath(site,'/','page');seed=ROOT/'research'/f'{file}.html'
  if seed.exists():p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(seed.read_bytes())
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
  while pending:
   batch=sorted(pending);pending=set()
   for item,b,error in pool.map(fetch,batch):
    done.add(item);site,path,kind=item
    if error:errors.append({'site':site,'path':path,'kind':kind,'error':error});continue
    (pages if kind=='page' else assets).append({'site':site,'path':path,'bytes':len(b)})
    refs=[];base=ROOTS[site]+path
    if kind=='page':
     s=b.decode('utf-8',errors='replace');parser=Links();parser.feed(s)
     refs.extend((x,'page') for x in parser.links);refs.extend((x,'asset') for x in parser.assets)
     refs.extend((x,'page') for x in re.findall(r'window\.location(?:\.href)?\s*=\s*[\'\"]([^\'\"]+)',s))
     refs.extend((x,'asset') for x in re.findall(r'url\([\'\"]?([^\)\'\"]+)',s))
    elif path.endswith(('.css','.js')):
     s=b.decode('utf-8',errors='replace')
     refs.extend((x,'asset') for x in re.findall(r'url\([\'\"]?([^\)\'\"]+)',s))
     refs.extend((x,'asset') for x in re.findall(r'[\'\"]([^\'\"\s]+\.(?:png|jpg|gif|svg|woff2?))[\'\"]',s))
     refs.extend((x,'asset') for x in re.findall(r'@import\s+[\'\"]([^\'\"]+)',s))
    for ref,k in refs:
     norm=normalize(ref,base,k)
     if norm:
      nextitem=(*norm,k)
      if nextitem not in done:pending.add(nextitem)
   pending.difference_update(done)
   print(json.dumps({'fetched':len(done),'pages':len(pages),'assets':len(assets),'pending':len(pending),'errors':len(errors)}),flush=True)
   (ROOT/'research'/'inventory.json').write_text(json.dumps({'pages':pages,'assets':assets,'errors':errors},ensure_ascii=False,indent=2))
   if len(pages)>2000:raise RuntimeError('Unexpectedly large page tree')
 print('Finished',flush=True)
 (ROOT/'source'/'snapshot-manifest.json').write_text(json.dumps({'pages':pages,'assets':assets,'errors':errors},ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
