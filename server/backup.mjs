import {DatabaseSync,backup} from 'node:sqlite';
import path from 'node:path';
import {existsSync} from 'node:fs';
const database=new DatabaseSync(path.join(process.env.DATA_ROOT,'content.sqlite'));
await backup(database,process.argv[2]);database.close();
const seo=path.join(process.env.DATA_ROOT,'seo.sqlite');
if(existsSync(seo)){const database=new DatabaseSync(seo);await backup(database,path.join(path.dirname(process.argv[2]),'seo.sqlite'));database.close();}
