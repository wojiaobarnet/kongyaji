import os,sys,json,argparse
parser=argparse.ArgumentParser(description='Register a new static reverse-proxy site using the installed BT Panel API.')
parser.add_argument('--host',required=True)
args_cli=parser.parse_args()
os.chdir('/www/server/panel');sys.path.insert(0,'/www/server/panel');sys.path.insert(0,'/www/server/panel/class')
import public,panelSite,BTPanel
host=args_cli.host
with BTPanel.app.test_request_context('/site?action=AddSite',base_url='http://127.0.0.1'):
 existing=public.M('sites').where('name=?',(host,)).find()
 if existing:raise SystemExit('Site already registered; inspect it before replacing anything.')
 args=public.dict_obj()
 for key,value in {'webname':json.dumps({'domain':host,'domainlist':[],'count':0}),'path':'/www/wwwroot/donghan','type_id':0,'type':'PHP','project_type':'PHP','version':'00','port':'80','ps':'Donghan Node reverse proxy','ftp':'false','sql':'false','codeing':'utf8','deploy_type':'default'}.items():setattr(args,key,value)
 result=panelSite.panelSite().AddSite(args)
 if not isinstance(result,dict) or not result.get('siteStatus'):raise SystemExit(str(result))
 print(json.dumps(result))
