import {mkdir,writeFile,access} from 'node:fs/promises';
import {randomBytes,scryptSync} from 'node:crypto';
import path from 'node:path';
const root=path.resolve(process.env.DATA_ROOT||path.join(import.meta.dirname,'../.server-data'));
await mkdir(root,{recursive:true,mode:0o700});
const filename=path.join(root,'admin.json');
try{await access(filename);console.log('Administrator already configured; existing credentials preserved.');process.exit(0);}catch{}
const password=process.env.INITIAL_ADMIN_PASSWORD||randomBytes(18).toString('base64url'),salt=randomBytes(24).toString('hex');
await writeFile(filename,JSON.stringify({username:'admin',salt,passwordHash:scryptSync(password,salt,64).toString('hex'),sessionKey:randomBytes(48).toString('hex')})+'\n',{mode:0o600,flag:'wx'});
await writeFile(path.join(root,'initial-login.txt'),'東悍网站管理后台\n账号：admin\n初始密码：'+password+'\n',{mode:0o600,flag:'wx'});
console.log('Administrator created. Initial credentials are stored in '+path.join(root,'initial-login.txt'));
