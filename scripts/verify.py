#!/usr/bin/env python3
"""Check every generated page/stylesheet for broken local dependencies and links."""
import collections, json, pathlib, re, sys, urllib.parse
from html.parser import HTMLParser
ROOT=pathlib.Path(__file__).resolve().parents[1]
DIST=ROOT/'dist/client'
class References(HTMLParser):
 def __init__(self):super().__init__();self.refs=[];self.forms=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  for key in ('href','src'):
   if a.get(key):self.refs.append(a[key])
  if tag=='form':self.forms.append(a.get('action',''))
 def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs)
def target(ref,base):
 u=urllib.parse.urlsplit(urllib.parse.urljoin('http://replica.local'+base,ref))
 if u.hostname!='replica.local' or u.scheme not in ('http','https'):return None
 path=urllib.parse.unquote(u.path)
 p=DIST/path.lstrip('/')
 if not p.suffix:p=p/'index.html'
 return p
errors=[];pages=list(DIST.rglob('*.html'));forms=[]
for p in pages:
 s=p.read_text();base='/'+p.relative_to(DIST).as_posix();parser=References();parser.feed(s)
 parser.refs.extend(re.findall(r'window\.location\.replace\([\'\"]([^\'\"]+)',s))
 for ref in parser.refs:
  if ref.startswith(('#','javascript:','mailto:','tel:','weixin:','data:')):continue
  if urllib.parse.urlsplit(ref).hostname in ('kaishansales.com','www.kaishansales.com','m.kaishansales.com'):errors.append((base,'original domain dependency: '+ref))
  t=target(ref,base)
  if t and not t.exists():errors.append((base,ref))
 for action in parser.forms:
  if action!='/api/inquiries':errors.append((base,'unexpected form action '+action))
  forms.append(base)
for p in DIST.rglob('*.css'):
 s=re.sub(r'/\*.*?\*/','',p.read_text(),flags=re.S);base='/'+p.relative_to(DIST).as_posix()
 for ref in re.findall(r'url\(\s*[\'\"]?([^\)\'\"]+)',s):
  if ref.startswith('data:'):continue
  t=target(ref.strip(),base)
  if t and not t.exists():errors.append((base,ref))
if errors:
 print(json.dumps({'broken_references':errors},ensure_ascii=False,indent=2));sys.exit(1)
print(json.dumps({'checked_pages':len(pages),'checked_stylesheets':len(list(DIST.rglob('*.css'))),'forms':forms,'broken_references':0},ensure_ascii=False))
