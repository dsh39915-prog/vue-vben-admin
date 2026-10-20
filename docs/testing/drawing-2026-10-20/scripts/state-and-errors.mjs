import {setup,assert} from './codex-drawing-common.mjs';
import fs from 'node:fs/promises';import {fileURLToPath} from 'node:url';
const ctx=await setup();const {page}=ctx;const calls=[];let fail=false;
const audits=['aiMatchingAudit','aiImageModelAudit','aiImageActionAudit','retouchingAudit','pageProductionAudit','launchAudit'];
const task={id:88,styleNo:'QA-STATE',procInstId:'qa-state-proc',currentNodeKey:'retouching',currentNodeTaskId:'qa-state-node',currentNodeAssigneeId:'7',currentNodeAssigneeName:'测试员工',currentNodeStatus:2,flowStatus:2};
await page.route('**/admin-api/flycowerp/**',async route=>{
 const r=route.request(),u=new URL(r.url()),p=u.pathname.split('/flycowerp/')[1];const body=r.headers()['content-type']?.includes('application/json')?r.postDataJSON():null;calls.push({p,body});let data;
 if(p==='newProductTask/page')data={list:[task],total:1};
 else if(p==='newProductTask/get/88')data=task;
 else if(p==='aiMatchingScheme/list')data=[];
 else if(p==='newProductStyle/list')data=[{id:'9007199254740993',styleNo:'QA-STATE',styleName:'红色'},{id:'9007199254740994',styleNo:'QA-STATE',styleName:'黄色'}];
 else if(p==='flow/assign')data=true;
 else if(p==='flow/freeze'){task.currentNodeStatus=task.flowStatus=4;data=true;}
 else if(p==='flow/unfreeze'){task.currentNodeStatus=task.flowStatus=2;data=true;}
 else if(p==='flow/audit'){if(fail){fail=false;data=false;}else data=true;}
 else throw Error('Unexpected state API '+p);
 await route.fulfill({json:{code:0,data}});
});
async function nav(){await ctx.navigate('/launch/workbench?taskId=88');await page.getByText('任务信息',{exact:true}).waitFor();await page.waitForTimeout(300);}
await page.route('**/admin-api/system/user/simple-list',r=>r.fulfill({json:{code:0,data:[{id:7,username:'qa7',nickname:'员工甲'},{id:8,username:'qa8',nickname:'员工乙'}]}}));
const results=[];
try{
 await nav();await ctx.click('冻结节点');await ctx.dialog().locator('textarea').fill('测试冻结');await ctx.click('确认执行',ctx.dialog());await page.getByRole('button',{name:'解冻节点',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'冻结节点',exact:true}).count(),0);
 await ctx.click('解冻节点');await ctx.click('确认执行',ctx.dialog());await page.getByRole('button',{name:'冻结节点',exact:true}).waitFor();results.push({case:'freeze-unfreeze',status:'passed'});
 for(const key of audits){task.currentNodeKey=key;task.currentNodeTaskId='qa-'+key;await nav();await ctx.click('审核任务');await ctx.dialog().getByText('驳回',{exact:true}).click();await ctx.dialog().locator('textarea').fill('图片细节需返工');if(key===audits[0]){fail=true;await ctx.click('确认执行',ctx.dialog());await page.getByText('审核任务未成功，请重试',{exact:true}).waitFor();assert.equal(await ctx.dialog().locator('textarea').inputValue(),'图片细节需返工');}
 await ctx.click('确认执行',ctx.dialog());await page.getByRole('dialog').waitFor({state:'hidden'});const body=calls.findLast(c=>c.p==='flow/audit').body;assert.equal(body.auditInfoVO.auditStatus,2);assert.equal(body.nodeKey,key);results.push({case:key+'-reject',status:'passed'});}
 for(const key of ['aiImageTaskDispatch','retouchTaskDispatch','pageTaskDispatch']){
 task.currentNodeKey=key;task.currentNodeTaskId='qa-'+key;await nav();await ctx.click('分配任务');await ctx.dialog().getByText('按款式分配',{exact:true}).click();await ctx.dialog().locator('textarea').fill('按颜色分配测试');await ctx.click('确认执行',ctx.dialog());await page.getByText('请为每个款式选择处理人',{exact:true}).waitFor();const selects=ctx.dialog().locator('.ant-select');await ctx.select(selects.nth(0),'员工甲 (#7)');await page.waitForTimeout(350);await ctx.select(selects.nth(1),'员工乙 (#8)');await ctx.click('确认执行',ctx.dialog());await page.getByRole('dialog').waitFor({state:'hidden'});const body=calls.findLast(c=>c.p==='flow/assign').body;assert.equal(body.assignMode,'style_split');assert.deepEqual(body.styleAssignList.map(x=>[x.styleId,x.assigneeId]),[['9007199254740993','7'],['9007199254740994','8']]);results.push({case:key+'-style-split',status:'passed'});
 }
 task.currentNodeKey='launchMaterialPrepare';await nav();const available={audit:await page.getByRole('button',{name:'审核任务',exact:true}).count(),assign:await page.getByRole('button',{name:'分配任务',exact:true}).count(),saveImages:await page.getByRole('button',{name:'保存款式图片',exact:true}).count(),saveScheme:await page.getByRole('button',{name:'保存方案',exact:true}).count()};assert.deepEqual(available,{audit:0,assign:0,saveImages:0,saveScheme:0});results.push({case:'launchMaterialPrepare',status:'scope-gap',available});
 await page.screenshot({path:fileURLToPath(new URL('../evidence/material-prepare-no-action.png',import.meta.url)),fullPage:true});
 await ctx.finish();console.log('PASS freeze/unfreeze, all 6 audit rejection requests, 3 style-split assignment nodes, Boolean failure retains opinion and manual retry; CONFIRMED material-prepare node has no processing action');
} catch(e){await ctx.browser.close();throw e;}finally{await fs.writeFile(new URL('../evidence/state-and-errors.json',import.meta.url),JSON.stringify({mode:'mock-browser',results,calls},null,2));}
