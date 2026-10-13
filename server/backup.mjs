import {DatabaseSync,backup} from 'node:sqlite';
import path from 'node:path';
const database=new DatabaseSync(path.join(process.env.DATA_ROOT,'content.sqlite'));
await backup(database,process.argv[2]);database.close();
