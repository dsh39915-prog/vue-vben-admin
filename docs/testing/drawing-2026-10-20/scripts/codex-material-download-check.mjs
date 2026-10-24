import { setup, assert } from './codex-drawing-common.mjs';
import fs from 'node:fs/promises';
const ctx=await setup();const {page}=ctx;
const {materialZip:zip}=await import('./material-fixture.mjs');
const actual={json:JSON.stringify({code:400,msg:'当前节点无可下载的素材',data:null})};
const task={id:1,styleNo:'TEST-STYLE',flowStatus:2,currentNodeStatus:2,currentNodeKey:'pageProduction',currentNodeName:'页面制作',currentNodeAssigneeId:'1',currentNodeTaskId:'node-1',procInstId:'proc-1'};
let mode='utf8', calls=[], downloads=[], expired=false, refreshCount=0, release;
page.on('download',d=>downloads.push(d));
await page.route('**/admin-api/system/auth/refresh-token*',async route=>{
 refreshCount++;
 await route.fulfill({json:{code:0,data:{accessToken:'download-refreshed',refreshToken:'next-refresh',userId:1}}});
});
await page.route('**/admin-api/flycowerp/**',async route=>{
 const req=route.request(),url=new URL(req.url()),p=url.pathname.split('/flycowerp/')[1];
 let data;
 if(p==='newProductTask/page')data={list:[task],total:1};
 else if(p==='newProductTask/get/1')data=task;
 else if(p==='newProductStyle/list')data=[{id:10,styleNo:task.styleNo,styleName:'红色'}];
 else if(p==='newProductStyle/downloadMaterials'){
  calls.push({method:req.method(),query:Object.fromEntries(url.searchParams),headers:req.headers()});
  if(mode==='delayed') await new Promise(r=>{release=r;});
  if(mode==='real-error'){await route.fulfill({contentType:'application/json',body:actual.json});return;}
  if(mode==='forbidden'){await route.fulfill({status:403,json:{code:403,msg:'无权限下载此节点素材'}});return;}
  if(mode==='expired'&&!expired){expired=true;await route.fulfill({json:{code:401,msg:'登录已失效'}});return;}
  if(mode==='old'){await route.fulfill({json:{code:0,data:true}});return;}
  if(mode==='null'){await route.fulfill({contentType:'application/json',body:'null'});return;}
  if(mode==='empty'){await route.fulfill({contentType:'application/zip',body:Buffer.alloc(0)});return;}
  if(mode==='html'){await route.fulfill({contentType:'text/html',body:'<html>gateway error</html>'});return;}
  if(mode==='untyped-json'){await route.fulfill({contentType:'application/octet-stream',body:'{"code":400,"msg":"素材正在准备"}'});return;}
  let disposition=mode==='regular'?'attachment; filename="materials.zip"':mode==='malformed'?"attachment; filename=regular.zip; filename*=UTF-8''%ZZ":mode==='missing'?undefined: "attachment; filename=materials.zip; filename*=UTF-8''"+encodeURIComponent('款式素材.zip');
  await route.fulfill({headers:{'content-type':'application/octet-stream','access-control-expose-headers':'Content-Disposition',...(disposition?{'content-disposition':disposition}:{})},body:zip});return;
 }else if(p==='aiMatchingScheme/list')data=[];
 else if(p==='flow/draft/get')data=null;
 else if(p==='flow/nodeDetailList'||p==='flow/transferRecordList')data=[];
 else {await route.fallback();return;}
 await route.fulfill({json:{code:0,data}});
});
try {
 await ctx.navigate('/drawing/pageProduction?taskId=1');
 const button=page.getByRole('button',{name:/下载素材/});await button.waitFor();
 const text=page.locator('.ant-tabs-tabpane-active textarea').first();await text.fill('下载失败应保留备注');
 async function success(next,name){mode=next;const promise=page.waitForEvent('download');await button.click();const file=await promise;assert.equal(file.suggestedFilename(),name);assert.deepEqual(await fs.readFile(await file.path()),zip);await page.waitForTimeout(150);assert.equal(await button.isDisabled(),false);}
 await success('utf8','款式素材.zip');
 assert.equal(calls[0].method,'GET');assert.deepEqual(calls[0].query,{procInstId:'proc-1',nodeTaskId:'node-1',nodeKey:'pageProduction'});assert.equal(calls[0].headers.authorization,'Bearer browser-test');
 assert.equal(await page.locator('.ant-tabs-tabpane-active input[type=checkbox]:checked').count(),0);
 await success('regular','materials.zip');await success('malformed','regular.zip');
 console.log('PASS binary bytes, authenticated GET/context, no selection required, backend UTF-8/ordinary/malformed filenames preserved');
 for(const [next,msg] of [['missing','无法读取后端素材文件名，请确认接口返回并暴露 Content-Disposition 响应头'],['real-error','当前节点无可下载的素材'],['forbidden','无权限下载此节点素材'],['untyped-json','素材正在准备'],['old','未收到有效素材文件，请稍后重试'],['null','未收到有效素材文件，请稍后重试'],['empty','未收到有效素材文件，请稍后重试'],['html','接口未返回素材文件，请稍后重试']]){
  const count=downloads.length;mode=next;await button.click();await page.getByText(msg,{exact:true}).last().waitFor();await page.waitForTimeout(180);assert.equal(downloads.length,count);assert.equal(await button.isDisabled(),false);assert.equal(await text.inputValue(),'下载失败应保留备注');
 }
 console.log('PASS actual no-material response, HTTP 403, untyped JSON, old boolean/null/empty/HTML never saved as files; errors allow retry and retain input');
 await success('expired','款式素材.zip');assert.equal(refreshCount,1);assert.equal(calls.at(-1).headers.authorization,'Bearer download-refreshed');
 console.log('PASS JSON business 401 refreshes token and retries binary download');
 mode='delayed';let before=calls.length;const downloadPromise=page.waitForEvent('download');await button.click();while(!release)await page.waitForTimeout(20);assert.equal(await button.isDisabled(),true);await button.dispatchEvent('click');assert.equal(calls.length,before+1);
 await page.evaluate(async()=>{await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/drawing/pageAudit');});assert.match(page.url(),/pageProduction/);release();await downloadPromise;await page.waitForTimeout(200);assert.equal(await button.isDisabled(),false);
 console.log('PASS duplicate click suppressed, task-route changes blocked during download, state restored');
 await ctx.finish();console.log('PASS no browser runtime errors; all writes mocked');
} catch(error){console.error(error);console.error(ctx.state.errors);await page.screenshot({path:process.env.TEMP+'/codex-download-failure.png',fullPage:true});await ctx.browser.close();process.exitCode=1;}
