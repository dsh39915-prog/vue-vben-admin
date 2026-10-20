import {setup,assert} from './codex-drawing-common.mjs';
import fs from 'node:fs/promises';
const ctx=await setup();const {page}=ctx;const calls=[];let serial=0;
const out=new URL('../evidence/',import.meta.url);const results=[];
const keys=['aiMatchingOutput','aiMatchingAudit','aiImageTaskDispatch','aiImageModelTask','aiImageModelAudit','aiImageActionTask','aiImageActionAudit','retouchTaskDispatch','retouching','retouchingAudit','pageTaskDispatch','pageProduction','pageProductionAudit','launchTaskDispatch','launchAudit'];
const audits=keys.filter(x=>x.endsWith('Audit'));const assigns=keys.filter(x=>x.endsWith('Dispatch'));
const task=key=>({id:100+keys.indexOf(key),styleNo:'QA-DRAWING',flowStatus:2,currentNodeStatus:2,currentNodeKey:key,currentNodeName:key,procInstId:'qa-proc',currentNodeTaskId:'qa-'+key,currentNodeAssigneeId:'7',currentNodeAssigneeName:'测试员工'});
const tasks=keys.map(task);const image=id=>({imageId:String(id),originalUrl:'https://example.test/'+id+'.png',previewUrl:'https://example.test/p'+id+'.png',thumbnailUrl:'https://example.test/t'+id+'.png'});
const scheme={id:'9007199254740993',styleNo:'QA-DRAWING',styleName:'红色',hasOtherStyle:false,aiMatchingImageUrl:image(1),mainReferenceFrontUrl:image(2),mainReferenceSideUrl:image(3),mainReferenceBackUrl:image(4),clothingProductUrls:[{...image(5),styleNo:'QA-DRAWING',isMain:1}],modelImageUrls:image(6),sceneImageUrls:image(7)};
const styles=[{id:'9007199254740995',styleNo:'QA-DRAWING',styleName:'红色',clothingProductUrl:image(8)}];
await page.route('**/admin-api/system/user/simple-list',r=>r.fulfill({json:{code:0,data:[{id:7,username:'qa',nickname:'测试员工'}]}}));
await page.route('**/admin-api/flycowerp/**',async route=>{
 const r=route.request(),u=new URL(r.url()),p=u.pathname.split('/flycowerp/')[1];const body=r.headers()['content-type']?.includes('application/json')?r.postDataJSON():null;calls.push({p,body});let data;
 if(p==='newProductTask/page'){const list=tasks.filter(t=>!body.flowNodeKey||t.currentNodeKey===body.flowNodeKey);data={list,total:list.length};}
 else if(p.startsWith('newProductTask/get/'))data=tasks.find(t=>String(t.id)===p.split('/').at(-1));
 else if(p==='aiMatchingScheme/list')data=[scheme];
 else if(p==='newProductStyle/list')data=styles;
 else if(p==='temp-image/upload')data=image('upload'+ ++serial);
 else if(p==='aiMatchingScheme/save')data=[scheme.id];
 else if(['flow/audit','flow/assign','flow/freeze','flow/unfreeze','newProductStyle/saveImageData'].includes(p))data=true;
 else if(p==='flow/nodeDetailList'||p==='flow/transferRecordList')data=[];
 else if(p.startsWith('aiImageResult/dropdown/'))data=[];
 else throw Error('Unexpected node API '+p);
 await route.fulfill({json:{code:0,data}});
});
const field=(label,scope=page)=>scope.locator('.ant-form-item').filter({has:page.locator('.ant-form-item-label').filter({hasText:label})}).first();
const count=p=>calls.filter(c=>c.p===p).length;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=','base64');
const upload=async input=>{await input.setInputFiles({name:'qa.png',mimeType:'image/png',buffer:png});await page.waitForTimeout(350);};
async function wait(fn){for(let i=0;i<120&&!fn();i++)await page.waitForTimeout(50);assert.ok(fn());}
try{
 for(const key of keys){
  const t=task(key);await ctx.navigate('/drawing/'+key+'?taskId='+t.id);await page.getByText('任务信息',{exact:true}).waitFor();await page.waitForTimeout(450);
  const record={key,path:new URL(page.url()).pathname,checks:[]};
  assert.equal(new URL(page.url()).pathname,'/drawing/'+key);
  if(audits.includes(key)||assigns.includes(key)){
   const isAudit=audits.includes(key),endpoint=isAudit?'flow/audit':'flow/assign';
   await ctx.click(isAudit?'审核任务':'分配任务');const dialog=ctx.dialog();
   if(!isAudit)await ctx.select(dialog.locator('.ant-select').first(),'测试员工 (#7)');
   await dialog.locator('textarea').fill('全流程节点测试意见');const before=count(endpoint);await ctx.click('确认执行',dialog);await wait(()=>count(endpoint)===before+1);await page.getByRole('dialog').waitFor({state:'hidden'});
   const payload=calls.findLast(c=>c.p===endpoint).body;assert.equal(payload.nodeKey,key);assert.equal(payload.nodeTaskId,t.currentNodeTaskId);assert.equal(payload.procInstId,t.procInstId);record.checks.push(isAudit?'审核通过请求及节点上下文':'统一分配请求及节点上下文');
  }else if(key==='aiMatchingOutput'){
   for(const [label,status] of [['保存方案',0],['提交方案',1]]){
    const before=count('aiMatchingScheme/save');await ctx.click(label);if(status===1)await ctx.confirm();await wait(()=>count('aiMatchingScheme/save')===before+1);await page.waitForTimeout(450);assert.equal(calls.findLast(c=>c.p==='aiMatchingScheme/save').body.status,status);
   }record.checks.push('方案保存0和提交1');
  }else{
   const card=page.locator('.ant-tabs-tabpane-active .ant-card').first();await card.locator('.ant-checkbox-wrapper').first().click();
   const inputs=card.locator('input[type=file]');const n=await inputs.count();for(let i=0;i<n;i++)await upload(inputs.nth(i));
   const before=count('newProductStyle/saveImageData');await ctx.click('保存款式图片');await ctx.confirm();await wait(()=>count('newProductStyle/saveImageData')===before+1);
   const payload=calls.findLast(c=>c.p==='newProductStyle/saveImageData').body;assert.equal(payload.nodeKey,key);assert.equal(payload.items[0].styleId,styles[0].id);record.checks.push('节点对应图片上传及保存');
  }
  record.status='passed';results.push(record);console.log('PASS '+key+' '+record.checks.join(','));
 }
 // Exploratory check: local unsaved input is discarded by the refresh button.
 await ctx.navigate('/drawing/retouching?taskId=108');await page.getByText('任务信息',{exact:true}).waitFor();await page.waitForTimeout(400);
 await field('图片备注').locator('textarea').fill('未保存的测试备注');const card=page.locator('.ant-tabs-tabpane-active .ant-card').first();await upload(card.locator('input[type=file]').first());
 await page.screenshot({path:new URL('unsaved-before.png',out).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
 await ctx.click('刷新任务');await page.waitForTimeout(700);
 const lost=(await field('图片备注').locator('textarea').inputValue())==='';
 const noPrompt=await page.getByRole('dialog').count()===0;
 assert.ok(lost&&noPrompt);results.push({case:'unsaved-refresh',status:'confirmed-issue',remarkLost:lost,confirmationAbsent:noPrompt});
 await page.screenshot({path:new URL('unsaved-after.png',out).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
 console.log('CONFIRMED unsaved remark and uploads discarded on refresh without confirmation');
 await ctx.finish();
}catch(e){results.push({status:'failed',error:e.message});await ctx.browser.close();throw e;}finally{await fs.writeFile(new URL('all-nodes.json',out),JSON.stringify({mode:'mock-browser',results,calls},null,2));}
