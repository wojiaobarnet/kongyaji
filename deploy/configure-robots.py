#!/usr/bin/env python3
"""Expose this subsite's robots rules at host root, preserving existing sites.
Run separately after update.sh; an existing host robots file requires manual merging.
"""
import argparse,datetime,pathlib,re,subprocess,urllib.request,urllib.error
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--config',required=True,help='Active nginx server configuration')
parser.add_argument('--host',default='159.75.67.132')
parser.add_argument('--upstream',default='http://127.0.0.1:8010/donghan/robots.txt')
args=parser.parse_args()
if not re.fullmatch(r'[a-zA-Z0-9.:-]+',args.host):raise SystemExit('Invalid host')
if not re.fullmatch(r'http://127\.0\.0\.1:[0-9]+(?:/[a-zA-Z0-9_-]+)*/robots\.txt',args.upstream):raise SystemExit('Invalid local upstream')
config=pathlib.Path(args.config);old=config.read_text()
marker='# donghan discovery: host-root robots'
if marker in old:
 subprocess.run(['nginx','-t'],check=True)
 print('Existing donghan robots route retained.');raise SystemExit(0)
if re.search(r'location\s+[^\n{]*robots',old):raise SystemExit('Existing robots route: merge rules manually; no configuration changed.')
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
try:
 response=opener.open(urllib.request.Request('http://127.0.0.1/robots.txt',headers={'Host':args.host}),timeout=10)
 raise SystemExit('Host robots already exists: merge rules manually; no configuration changed.')
except urllib.error.HTTPError as e:
 if e.code!=404:raise SystemExit('Host robots returned an unexpected status; no configuration changed.')
anchor='    location = /donghan {'
if old.count(anchor)!=1:raise SystemExit('Expected donghan location was not found exactly once.')
block=f'''    {marker}
    location = /robots.txt {{
        proxy_pass {args.upstream};
        proxy_set_header Host $host;
        proxy_hide_header X-Powered-By;
    }}

'''
backup=pathlib.Path('/var/www/donghan/backups')/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S')+'-robots')
backup.mkdir(parents=True,exist_ok=False);backup.chmod(0o700)
(backup/'nginx-config.txt').write_text(str(config)+'\n')
(backup/'nginx-before.conf').write_text(old)
try:
 config.write_text(old.replace(anchor,block+anchor))
 subprocess.run(['nginx','-t'],check=True)
 subprocess.run(['systemctl','reload','nginx'],check=True)
except BaseException:
 config.write_text(old)
 subprocess.run(['nginx','-t'],check=True)
 subprocess.run(['systemctl','reload','nginx'],check=True)
 raise
print('Host robots route installed; other server locations retained. Backup:',backup)
