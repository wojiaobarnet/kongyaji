"""Index and annotate the retained pages for content management without retemplating."""
import hashlib,html,json,pathlib,re,urllib.parse
from html.parser import HTMLParser
VOID={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
class Node:
 def __init__(self,tag,attrs,start,end,parent):
  self.tag=tag;self.attrs=dict(attrs);self.start=start;self.startend=end;self.end=end;self.parent=parent;self.children=[];self.extra={}
 def classes(self):return self.attrs.get('class','').split()
 def ancestors(self):
  p=self.parent
  while p:yield p;p=p.parent
class Tree(HTMLParser):
 def __init__(self,s):
  super().__init__(convert_charrefs=False);self.s=s;self.lines=[0]+[m.end() for m in re.finditer('\n',s)];self.nodes=[];self.stack=[];self.feed(s)
 def position_index(self):line,col=self.getpos();return self.lines[line-1]+col
 def handle_starttag(self,tag,attrs):
  start=self.position_index();n=Node(tag,attrs,start,start+len(self.get_starttag_text()),self.stack[-1] if self.stack else None);self.nodes.append(n)
  if n.parent:n.parent.children.append(n)
  if tag not in VOID:self.stack.append(n)
 def handle_startendtag(self,tag,attrs):
  self.handle_starttag(tag,attrs)
  if tag not in VOID:self.stack.pop()
 def handle_endtag(self,tag):
  for i in range(len(self.stack)-1,-1,-1):
   if self.stack[i].tag==tag:
    for n in self.stack[i:]:n.end=self.position_index()
    self.stack=self.stack[:i];break
 def inner(self,n):return self.s[n.startend:n.end]
 def text(self,n):return html.unescape(re.sub('<[^>]+>','',self.inner(n))).strip()
 def render(self):
  s=self.s
  for n in reversed(self.nodes):
   if n.extra:
    pos=n.startend-(2 if s[n.startend-2:n.startend]=='/>' else 1)
    s=s[:pos]+''.join(' '+k+'="'+html.escape(str(v),quote=True)+'"' for k,v in n.extra.items())+s[pos:]
  return s

def generate(output,routes):
 output=pathlib.Path(output);catalog=[];trees={};pathmap={}
 for p in sorted(output.rglob('*.html')):
  rel='/'+p.relative_to(output).as_posix()
  if rel.startswith('/mobile/') or rel=='/404.html':continue
  url=rel[:-10] if rel.endswith('index.html') else rel
  s=p.read_text()
  if 'window.location.replace(' in s:continue
  t=Tree(s);trees[url]=t
  title=next((t.text(n) for n in t.nodes if n.tag=='title'),'')
  description=next((n.attrs.get('content','') for n in t.nodes if n.tag=='meta' and n.attrs.get('name')=='description'),'')
  isarticle=any(n.attrs.get('id')=='article' for n in t.nodes)
  top=url.strip('/').split('/')[0]
  kind='home' if url=='/' else top if top in ('product','news','case') and isarticle else 'listing' if top in ('product','news','case','service') and not isarticle and not any('aboutlist' in n.classes() for n in t.nodes) else 'page'
  group=url.rsplit('/',1)[0]+'/' if isarticle else url
  if isarticle:group=re.sub(r'/\d{4}-\d{2}-\d{2}/$','/',group)
  docid=hashlib.sha256(url.encode()).hexdigest()[:20]
  mobile=routes.get(url)
  meta={'id':docid,'title':title,'description':description,'kind':kind,'group':group,'desktop':url,'mobile':mobile,'cover':'','created':False,'hidden':False}
  catalog.append(meta);pathmap[url]=docid
  if mobile:pathmap[mobile]=docid
 # Use listing images as the authoritative cover image.
 covers={}
 for url,t in trees.items():
  for n in t.nodes:
   if n.tag=='img':
    a=next((p for p in n.ancestors() if p.tag=='a'),None)
    if a and a.attrs.get('href') in pathmap:covers.setdefault(pathmap[a.attrs['href']],n.attrs.get('src',''))
 for meta in catalog:
  meta['cover']=covers.get(meta['id'],'')
  blocks={}
  for device,url in [('desktop',meta['desktop']),('mobile',meta['mobile'])]:
   if not url:continue
   p=output/(url.lstrip('/')+('index.html' if url.endswith('/') else ''))
   if not p.exists():continue
   t=trees.get(url) or Tree(p.read_text())
   bodies=[n for n in t.nodes if n.attrs.get('id')=='article' or 'aboutlist' in n.classes() or (device=='mobile' and 'contxt' in n.classes())]
   body=bodies[0] if bodies else None
   counter=0
   for n in t.nodes:
    ancestors=list(n.ancestors());insidebody=n is body or body in ancestors
    if n is body:
     blockid='body';typ='html';value=t.inner(n);label='正文（电脑和手机共用）'
    elif insidebody:continue
    elif not any(p.tag=='body' for p in ancestors):continue
    elif any(p.tag in ('script','style','form') for p in ancestors):continue
    elif n.tag in ('h1','h2','h3','p') and t.text(n) and not any(p.tag in ('h1','h2','h3','p') for p in ancestors):
     # Article heading comes from document metadata, not a separately editable block.
     if (n.tag=='h1' and meta['kind'] in ('product','news','case')) or (device=='mobile' and 'showInfo' in [c for p in ancestors for c in p.classes()] and n.tag=='h3'):
      n.extra['data-cms-role']='title';continue
     counter+=1;blockid=f'{device}-text-{counter}';typ='html';value=t.inner(n);label=t.text(n)[:45]
    elif n.tag=='img' and n.attrs.get('src'):
     counter+=1;blockid=f'{device}-image-{counter}';typ='image';value=n.attrs['src'];label=n.attrs.get('alt') or ('轮播图片' if any(p.attrs.get('id')=='banner' for p in ancestors) else '页面图片')
    elif n.tag=='a' and n.attrs.get('href','').startswith(('/','http://','https://')):
     counter+=1;blockid=f'{device}-link-{counter}';typ='link';value=n.attrs['href'];label=t.text(n)[:45] or '图片链接'
    else:continue
    n.extra['data-cms-block']=blockid
    if blockid not in blocks:blocks[blockid]={'type':typ,'label':label[:80],'value':value,'device':'shared' if blockid=='body' else device}
   for n in t.nodes:
    if n.tag!='a':continue
    ref=pathmap.get(n.attrs.get('href'))
    if not ref:continue
    n.extra['data-cms-ref']=ref
    for child in t.nodes:
     if n not in list(child.ancestors()):continue
     if child.tag=='img':child.extra['data-cms-ref-image']=ref
     if child.tag in ('h1','h2','h3') or (child.tag=='p' and not ({'more','desc','txt','time','cont','mark'} & set(child.classes()))):child.extra['data-cms-ref-title']=ref
     if child.tag=='p' and ({'desc','txt','cont'} & set(child.classes())):child.extra['data-cms-ref-description']=ref
    if not n.children and t.text(n):n.extra['data-cms-ref-title']=ref
    li=next((p for p in n.ancestors() if p.tag=='li'),None)
    if li:li.extra.setdefault('data-cms-card',ref)
   p.write_text(t.render())
  meta['hasBody']='body' in blocks
  directory=output/'cms'/'documents';directory.mkdir(parents=True,exist_ok=True)
  (directory/(meta['id']+'.json')).write_text(json.dumps({'meta':meta,'blocks':blocks},ensure_ascii=False))
 (output/'cms'/'catalog.json').write_text(json.dumps({'documents':catalog,'paths':pathmap},ensure_ascii=False))
 media=[]
 for p in output.rglob('*'):
  if p.suffix.lower() in ('.png','.jpg','.jpeg','.gif','.webp'):
   media.append({'url':'/'+p.relative_to(output).as_posix(),'name':p.name,'size':p.stat().st_size,'original':True})
 (output/'cms'/'media.json').write_text(json.dumps(media,ensure_ascii=False))
 print(f'CMS indexed {len(catalog)} documents and {len(media)} original images.')
