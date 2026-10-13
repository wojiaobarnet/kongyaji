import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base='http://127.0.0.1:4173';
try{
 await page.goto(base+'/admin/');await page.getByText('网站内容，一处管理',{exact:true}).waitFor();
 await page.locator('#navigation [data-view="home"]').click();await page.locator('.banner-card').first().waitFor();assert.equal(await page.locator('.banner-card').count(),4);assert.ok(await page.getByRole('button',{name:/产品展示/}).isVisible());assert.ok(await page.locator('[data-section="cases"]').isVisible());
 const frame=page.frameLocator('#preview-frame');await frame.locator('#banner img').first().waitFor();await page.waitForFunction(()=>{const frame=document.querySelector('#preview-frame');return frame.contentDocument?.styleSheets.length>=2&&frame.contentDocument.querySelector('.logo img')?.naturalWidth>0;});
 const title='实时预览测试标题';await page.locator('#doc-title').fill(title);await page.waitForFunction(t=>document.querySelector('#preview-frame').contentDocument?.title===t,title);
 const before=await page.locator('.banner-card img').first().getAttribute('src');await page.locator('[data-banner-move="0"][data-direction="1"]').click();assert.notEqual(await page.locator('.banner-card img').first().getAttribute('src'),before);
 await page.locator('[data-banner-image]').first().click();await page.locator('#media-upload-input').setInputFiles([{name:'批量图片一.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAarVyFEAAAAASUVORK5CYII=','base64')},{name:'批量图片二.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAarVyFEAAAAASUVORK5CYII=','base64')}]);
 await page.waitForFunction(()=>document.querySelectorAll('.upload-row.success').length===2);await page.waitForFunction(()=>!document.querySelector('#picker-apply').disabled);await page.locator('#picker-apply').click();assert.ok((await page.locator('.banner-card img').first().getAttribute('src')).startsWith('/uploads/'));
 await page.locator('[data-device="mobile"]').click();assert.equal(await page.locator('.banner-card').count(),3);
 await mkdir('research/screenshots',{recursive:true});await page.screenshot({path:'research/screenshots/admin-home-optimized.png',fullPage:true});
 await page.locator('#navigation [data-view="news"]').click();await page.locator('#confirm-accept').click();await page.locator('#content-category').selectOption('/news/enterprise/');assert.ok((await page.locator('#content-rows').textContent()).includes('東悍新闻'));
 await page.locator('#create-content').click();assert.equal(await page.locator('#new-mode').inputValue(),'blank');assert.equal(await page.locator('#new-category').inputValue(),'/news/enterprise/');await page.locator('#dialog-close').click();await page.locator('#content-rows [data-edit]').first().click();await page.locator('#rich-editor').waitFor();assert.equal(await page.locator('#block-select').inputValue(),'body');
 await page.locator('#navigation [data-view="media"]').click();await page.locator('#media-type').selectOption('uploaded');await page.locator('#media-grid .media-card').first().click();await page.locator('#media-name').fill('方便识别的图片名称');await page.locator('#media-edit-purpose').selectOption('banner');await page.locator('#media-edit-save').click();await page.getByText('素材信息已保存',{exact:true}).waitFor();await page.locator('#media-search').fill('方便识别');assert.equal(await page.locator('#media-grid .media-card').count(),1);await page.screenshot({path:'research/screenshots/admin-media-optimized.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({sections:'passed',bannerOrder:'passed',livePreviewAssets:'passed',batchUploadAndApply:'passed',desktopAndMobile:'passed',categories:'passed',blankTemplate:'passed',mediaMetadata:'passed',errors}));
}finally{await browser.close();}
