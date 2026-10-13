#!/usr/bin/env python3
"""Fallback for an environment where the packaged Sites source helper is absent.
Receives a short-lived credential through hidden stdin; never writes its token.
"""
import json,os,pathlib,subprocess,sys,termios
root=pathlib.Path(__file__).resolve().parents[1]
if sys.stdin.isatty():
 settings=termios.tcgetattr(sys.stdin);settings[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin,termios.TCSANOW,settings)
print('Ready for source credential JSON on stdin (input is hidden).',flush=True)
credential=json.loads(sys.stdin.readline())
if credential['auth_mode']!='http_extra_header':raise RuntimeError('Unsupported source credential mode')
env=os.environ.copy();env.update(GIT_TERMINAL_PROMPT='0',GIT_CONFIG_COUNT='2',GIT_CONFIG_KEY_0='http.extraHeader',GIT_CONFIG_VALUE_0='Authorization: Bearer '+credential['token'],GIT_CONFIG_KEY_1='credential.helper',GIT_CONFIG_VALUE_1='')
def git(args,auth=False):
 r=subprocess.run(['git',*args],cwd=root,env=env if auth else None,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 if r.returncode:
  error=r.stderr.replace(credential['token'],'[redacted]');raise RuntimeError(error)
 return r.stdout.strip()
remote=credential['remote_url'];branch=credential['branch']
refs=git(['ls-remote',remote,'refs/heads/'+branch],auth=True)
if refs:raise RuntimeError('Source repository already has a branch; reconcile before pushing.')
# The original GitHub origin and current checkout branch are preserved.
if 'sites' in git(['remote']).splitlines():git(['remote','set-url','sites',remote])
else:git(['remote','add','sites',remote])
git(['add','.'])
git(['-c','user.name=Codex','-c','user.email=codex@openai.com','commit','-m','Recreate Kaishan desktop and mobile website with independent inquiry storage'])
sha=git(['rev-parse','HEAD'])
git(['push','sites','HEAD:refs/heads/'+branch],auth=True)
verified=git(['ls-remote',remote,'refs/heads/'+branch],auth=True).split()[0]
if verified!=sha:raise RuntimeError('Pushed commit verification failed')
print(json.dumps({'commit_sha':sha,'verified_remote_branch':branch}),flush=True)
