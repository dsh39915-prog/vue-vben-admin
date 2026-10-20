import {setup,assert} from '../../drawing-2026-10-20/scripts/codex-drawing-common.mjs';
import fs from 'node:fs/promises';import {fileURLToPath} from 'node:url';
const ctx=await setup();const {page}=ctx;const uploads=[];let hold;let release;let mode='ok';
await page.route('**/admin-api/flycowerp/aiPrompt/page',r=>r.fulfill({json:{code:0,data:{records:[],total:0,current:1,size:100}}}));
const image=name=>({imageId:'9007199254740993',originalUrl:'https://example.test/'+name,previewUrl:'https://example.test/preview-'+name,thumbnailUrl:'https://example.test/thumb-'+name});
await page.route('**/admin-api/flycowerp/temp-image/upload',async route=>{
 const r=route.request();assert.equal(r.method(),'POST');assert.equal(r.headers().authorization,'Bearer browser-test');assert.ok(r.headers()['content-type'].startsWith('multipart/form-data; boundary='));assert.match(r.postData(),/name="file"/);const filename=/filename="([^"]+)"/.exec(r.postData())?.[1];uploads.push(filename);if(hold)await hold;
 if(mode==='fail'){mode='ok';await route.fulfill({json:{code:10001,msg:'模拟图片上传失败',data:null}});return;}
 if(mode==='incomplete'){mode='ok';await route.fulfill({json:{code:0,data:{originalUrl:'https://example.test/broken'}}});return;}
 await route.fulfill({json:{code:0,data:image(filename)}});
});
const field=label=>ctx.dialog().locator('.ant-form-item').filter({has:page.locator('.ant-form-item-label').getByText(label,{exact:true})});
const srcs=scope=>scope.locator('img.ant-image-img').evaluateAll(imgs=>imgs.map(i=>i.getAttribute('src')));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=','base64');
const file=name=>({name,mimeType:'image/png',buffer:png});
async function wait(fn){for(let i=0;i<150&&!await fn();i++)await page.waitForTimeout(40);assert.ok(await fn());}
async function open(){await ctx.click('新建图片生成');await ctx.dialog().getByText('正在加载生图参数…',{exact:true}).waitFor({state:'hidden'});}
async function upload(label,files){await field(label).locator('input[type=file]').setInputFiles(files);await page.waitForTimeout(250);}
const results=[];
try{
 await ctx.navigate('/generation/image');await open();assert.equal(await ctx.dialog().getByPlaceholder('请输入原图地址').count(),0);
 hold=new Promise(r=>release=r);await upload('原图区域',file('source.png'));await wait(()=>uploads.length===1);assert.ok(await ctx.dialog().getByRole('button',{name:/暂\s*存/}).isDisabled());assert.ok(await ctx.dialog().getByRole('button',{name:'生成图片',exact:true}).isDisabled());assert.ok(await ctx.dialog().getByRole('button',{name:/取\s*消/}).isDisabled());assert.equal(await ctx.dialog().locator('.ant-modal-close').count(),0);
 await page.evaluate(async()=>{await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/task-center');});assert.equal(new URL(page.url()).pathname,'/generation/image');
 release();hold=undefined;await wait(async()=>(await srcs(field('原图区域'))).includes(image('source.png').thumbnailUrl));
 await upload('参考图区域',[file('ref1.png'),file('ref2.png'),file('ref3.png')]);await wait(async()=>(await srcs(field('参考图区域'))).length===3);assert.deepEqual(uploads,['source.png','ref1.png','ref2.png','ref3.png']);assert.deepEqual(await srcs(field('参考图区域')),['ref1.png','ref2.png','ref3.png'].map(n=>image(n).thumbnailUrl));
 await field('参考图区域').getByRole('button',{name:'前移参考图 3',exact:true}).click();await field('参考图区域').getByRole('button',{name:'移除参考图 1',exact:true}).click();assert.deepEqual(await srcs(field('参考图区域')),['ref3.png','ref2.png'].map(n=>image(n).thumbnailUrl));
 results.push('authenticated multipart upload; upload lock/navigation; serial multi-select and ordered URL triplets');
 mode='fail';await upload('原图区域',file('replace-fail.png'));await page.getByText('模拟图片上传失败',{exact:true}).last().waitFor();assert.deepEqual(await srcs(field('原图区域')),[image('source.png').thumbnailUrl]);
 mode='incomplete';await upload('原图区域',file('incomplete.png'));await page.getByText('上传未返回完整图片地址，请重新上传',{exact:true}).last().waitFor();assert.deepEqual(await srcs(field('原图区域')),[image('source.png').thumbnailUrl]);
 const before=uploads.length;await field('参考图区域').locator('input[type=file]').setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('test')});await page.getByText('请选择图片文件',{exact:true}).last().waitFor();assert.equal(uploads.length,before);
 await upload('原图区域',file('replacement.png'));await wait(async()=>(await srcs(field('原图区域'))).includes(image('replacement.png').thumbnailUrl));
 ctx.state.failNext='/admin-api/flycowerp/aiImg/save';await ctx.click('暂存',ctx.dialog());await page.getByText('模拟请求失败',{exact:true}).last().waitFor();assert.deepEqual(await srcs(field('参考图区域')),['ref3.png','ref2.png'].map(n=>image(n).thumbnailUrl));
 await ctx.click('暂存',ctx.dialog());await page.getByRole('dialog').waitFor({state:'hidden'});const saved=ctx.lastRequest('/aiImg/save').body;
 assert.equal(saved.originalImg,image('replacement.png').originalUrl);assert.equal(saved.previewOriginalImg,image('replacement.png').previewUrl);assert.equal(saved.smallOriginalImg,image('replacement.png').thumbnailUrl);
 for(const [key,urlKey]of [['referenceImg','originalUrl'],['previewReferenceImg','previewUrl'],['smallReferenceImg','thumbnailUrl']])assert.equal(saved[key],['ref3.png','ref2.png'].map(n=>image(n)[urlKey]).join(','));assert.equal(saved.status,0);assert.equal(saved.id,undefined);
 results.push('failed/malformed uploads retain previous image; invalid file blocked; manual retry; draft maps all six addresses');
 const created=ctx.state.images.pop();ctx.state.images.unshift(created);await ctx.navigate('/generation/image');await ctx.click('编辑',page.locator('tr[data-row-key="'+created.id+'"]'));await ctx.dialog().getByText('正在加载生图参数…',{exact:true}).waitFor({state:'hidden'});assert.deepEqual(await srcs(field('参考图区域')),['ref3.png','ref2.png'].map(n=>image(n).thumbnailUrl));
 await field('原图区域').getByRole('button',{name:'移除原图',exact:true}).click();await field('参考图区域').getByRole('button',{name:'移除参考图 2',exact:true}).click();await ctx.click('暂存',ctx.dialog());await page.getByRole('dialog').waitFor({state:'hidden'});const updated=ctx.lastRequest('/aiImg/update').body;assert.equal(updated.originalImg,'');assert.equal(updated.previewOriginalImg,'');assert.equal(updated.smallOriginalImg,'');assert.equal(updated.referenceImg,image('ref3.png').originalUrl);assert.equal(updated.smallReferenceImg,image('ref3.png').thumbnailUrl);
 // Historical records can lack previews and thumbnails.
 Object.assign(ctx.state.images.find(x=>x.id===1),{originalImg:image('legacy.png').originalUrl,previewOriginalImg:'',smallOriginalImg:'',referenceImg:'https://example.test/legacy-ref.png',previewReferenceImg:'',smallReferenceImg:''});
 await ctx.click('编辑',page.locator('tr[data-row-key="1"]'));await ctx.dialog().getByText('正在加载生图参数…',{exact:true}).waitFor({state:'hidden'});assert.deepEqual(await srcs(field('原图区域')),[image('legacy.png').originalUrl]);
 await field('原图区域').locator('.ant-image').click();await page.locator('.ant-image-preview-img').waitFor();assert.equal(await page.locator('.ant-image-preview-img').getAttribute('src'),image('legacy.png').originalUrl);await page.locator('.ant-image-preview-operations-operation:visible').first().click();await page.locator('.ant-image-preview-wrap').waitFor({state:'hidden'});
 await ctx.select(field('图片模型').locator('.ant-select'),'测试图片模型');await ctx.dialog().getByPlaceholder('输入提示词，或选择模板填入后修改').fill('上传图片生成测试');await ctx.click('生成图片',ctx.dialog());await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(ctx.lastRequest('/aiImg/update').body.status,1);
 results.push('edit round-trip, remove clears matching addresses, legacy image fallback, preview and generation submit');
 await open();await upload('原图区域',file('final.png'));await wait(async()=>(await srcs(field('原图区域'))).length===1);await upload('参考图区域',[file('final-ref1.png'),file('final-ref2.png')]);await wait(async()=>(await srcs(field('参考图区域'))).length===2);await field('参考图区域').scrollIntoViewIfNeeded();await page.screenshot({path:fileURLToPath(new URL('../evidence/editor-upload.png',import.meta.url)),fullPage:true});
 await ctx.finish();console.log(results.map(r=>'PASS '+r).join('\n'));await fs.writeFile(new URL('../evidence/browser.json',import.meta.url),JSON.stringify({mode:'mock-browser',results,uploadFileNames:uploads,saved,updated,runtimeErrors:ctx.state.errors},null,2));
}catch(e){console.error('errors',ctx.state.errors,'uploads',uploads);await ctx.browser.close();throw e;}
