import {SeoCenter} from './seo-center.mjs';
const center=new SeoCenter({dataRoot:process.env.DATA_ROOT||'/var/lib/donghan',publicUrl:process.env.PUBLIC_URL,basePath:process.env.BASE_PATH||'',port:Number(process.env.PORT||8010)});
try{const result=await center.run('daily');console.log(JSON.stringify(result));if(result.errors)process.exitCode=1;}catch(e){console.error('SEO daily failed:',e.message);process.exitCode=1;}finally{center.close();}
