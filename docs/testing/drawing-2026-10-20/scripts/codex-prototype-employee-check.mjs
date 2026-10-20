import {setup,assert} from './codex-drawing-common.mjs';
const prefix='flycowerp:drawing:';const ctx=await setup({permissions:[prefix+'aiMatchingOutput',prefix+'aiMatchingAudit'],userId:7,roles:['employee']});const {page}=ctx;const calls=[];let ignoreFilters=false;let permissionCodes=[prefix+'aiMatchingOutput',prefix+'aiMatchingAudit'];
const titles=['AI搭配方案输出','AI搭配方案审核','AI图片生成任务分配','AI图片生成（模特图）','AI图片审核（模特图）','AI图片生成（动作图）','AI图片审核（动作图）','修图任务分配','修图制作','修图审核','页面制作任务分配','页面制作','页面审核','上新任务分配','上新审核'];
const task=(id,key,owner)=>({id,styleNo:'STAFF-'+id,flowStatus:1,currentNodeStatus:1,currentNodeKey:key,currentNodeName:titles[key==='aiMatchingOutput'?0:1],currentNodeAssigneeId:owner,currentNodeAssigneeName:owner==='7'?'当前员工':'其他员工',procInstId:'proc-'+id,currentNodeTaskId:'node-'+id});
const tasks=[task(1,'aiMatchingOutput','7'),task(2,'aiMatchingOutput','8'),task(3,'aiMatchingAudit','7')];
await page.route('**/admin-api/system/auth/get-permission-info',r=>r.fulfill({json:{code:0,data:{user:{id:7,nickname:'当前员工',username:'employee'},roles:['employee'],permissions:permissionCodes,menus:[]}}}));
await page.route('**/admin-api/flycowerp/**',async route=>{
 const r=route.request(),url=new URL(r.url()),p=url.pathname.replace('/admin-api/flycowerp/',''),json=r.postDataJSON();calls.push({p,method:r.method(),json});let data;
 if(p==='newProductTask/page'){
  assert.equal(r.method(),'POST');assert.ok(json.flowNodeKey);assert.equal(json.currentAssigneeId,'7');
  const filtered=ignoreFilters?tasks:tasks.filter(t=>t.currentNodeKey===json.flowNodeKey&&t.currentNodeAssigneeId===json.currentAssigneeId&&(!json.styleNo||t.styleNo.includes(json.styleNo)));
  data={list:filtered.slice((json.pageNo-1)*json.pageSize,json.pageNo*json.pageSize),total:filtered.length};
 }else if(p.startsWith('newProductTask/get/')){const id=Number(p.split('/').at(-1));assert.ok([1,3,4].includes(id),'unauthorized details fetched');data=Object.fromEntries(Object.entries(tasks.find(t=>t.id===id)).filter(([k])=>!k.startsWith('currentNode')));}
 else if(p==='aiMatchingScheme/list'){assert.ok(['1','3'].includes(url.searchParams.get('taskId')));data=[];}
 else if(p==='newProductStyle/list')data=url.searchParams.get('taskId')==='4'?[{id:'long-style-4',styleNo:'STAFF-4',styleName:'红色'}]:[];
 else if(p==='flow/nodeDetailList')data=[];
 else if(p==='flow/transferRecordList')data=[];
 else if(p==='flow/audit'){assert.equal(json.nodeTaskId,'node-3');data=true;tasks.find(t=>t.id===3).currentNodeAssigneeId='8';}
 else throw Error('Unexpected employee API '+p);
 await route.fulfill({json:{code:0,data}});
});
const paths=()=>page.evaluate(async()=>{const useAccessStore=()=>document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('core-access');return useAccessStore().accessMenus.find(m=>m.path==='/drawing')?.children?.map(m=>m.path)??[];});
const count=p=>calls.filter(c=>c.p===p).length;
try{
 await ctx.navigate('/drawing/aiMatchingOutput');await page.getByRole('cell',{name:'STAFF-1',exact:true}).waitFor();assert.equal(await page.getByRole('cell',{name:'STAFF-2',exact:true}).count(),0);
 assert.deepEqual(await paths(),['/drawing/aiMatchingOutput','/drawing/aiMatchingAudit']);assert.equal(await page.getByText('修图任务分配',{exact:true}).count(),0);assert.equal(await page.getByText('上新管理',{exact:true}).count(),0);
 await page.getByPlaceholder('请输入款号').fill('missing');await ctx.click('查询');await page.waitForTimeout(350);assert.equal(await page.getByRole('cell',{name:'STAFF-1',exact:true}).count(),0);await ctx.click('重置');await page.getByRole('cell',{name:'STAFF-1',exact:true}).waitFor();
 await ctx.click('提交');await page.getByRole('button',{name:'保存方案',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'冻结节点',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'查看流程',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'审核任务',exact:true}).count(),0);
 await ctx.click('选择任务');await ctx.dialog().getByRole('cell',{name:'STAFF-1',exact:true}).waitFor();assert.equal(await ctx.dialog().getByRole('cell',{name:'STAFF-2',exact:true}).count(),0);await ctx.dialog().getByRole('button',{name:'Close',exact:true}).click();
 console.log('PASS two authorized sidebar entries, own-node/assignee queries, search, scoped picker and employee operations');
 const before=count('newProductTask/get/2');await ctx.navigate('/drawing/aiMatchingOutput?taskId=2&currentAssigneeId=8');await page.getByText('任务已流转、未分配给你或不属于当前环节，请返回任务列表刷新',{exact:true}).waitFor();assert.equal(count('newProductTask/get/2'),before);
 await ctx.navigate('/drawing/aiMatchingOutput?taskId=2&view=details');await page.getByText('任务已流转、未分配给你或不属于当前环节，请返回任务列表刷新',{exact:true}).waitFor();assert.equal(count('newProductTask/get/2'),before);assert.equal(count('flow/nodeDetailList'),0);
 await ctx.navigate('/drawing/aiMatchingOutput?taskId=1&view=details');await page.getByRole('tab',{name:'节点明细',exact:true}).waitFor();assert.equal(count('flow/nodeDetailList'),1);assert.equal(await page.getByRole('button',{name:'保存方案',exact:true}).count(),0);
 await ctx.navigate('/drawing/aiMatchingOutput?taskId=3');await page.getByText('任务已流转、未分配给你或不属于当前环节，请返回任务列表刷新',{exact:true}).waitFor();assert.equal(count('newProductTask/get/3'),0);
 for(const url of ['/launch/workbench?taskId=2','/launch/tasks','/launch/process?taskId=2','/drawing/retouching']){const n=calls.length;await ctx.navigate(url);assert.equal(new URL(page.url()).pathname,'/forbidden');assert.equal(calls.length,n);}
 console.log('PASS direct URL permission checks, forged task ID and cross-node denial without detail/attachment requests');
 await ctx.navigate('/drawing/aiMatchingAudit?taskId=3');await page.getByRole('button',{name:'审核任务',exact:true}).waitFor();await ctx.click('审核任务');await ctx.dialog().locator('textarea').fill('员工审核意见');await ctx.click('确认执行',ctx.dialog());await page.getByText('任务已流转、未分配给你或不属于当前环节，请返回任务列表刷新',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'审核任务',exact:true}).count(),0);assert.equal(count('flow/audit'),1);
 ignoreFilters=true;await ctx.navigate('/drawing/aiMatchingOutput');await page.getByText('任务筛选结果异常，请刷新后重试',{exact:true}).waitFor();assert.equal(await page.getByRole('cell',{name:'STAFF-2',exact:true}).count(),0);ignoreFilters=false;
 console.log('PASS reassigned task loses actions after refresh; backend filter mismatch fails closed');
 permissionCodes=[];await ctx.navigate('/drawing/aiMatchingOutput');assert.equal(new URL(page.url()).pathname,'/forbidden');assert.deepEqual(await paths(),[]);
 console.log('PASS revoked permissions refreshed after reload');
 permissionCodes=[prefix+'retouching'];tasks.push(task(4,'retouching','7'));await ctx.navigate('/drawing/retouching?taskId=4');await page.getByRole('button',{name:'保存款式图片',exact:true}).waitFor();assert.equal(await page.getByRole('tab',{name:'商品款式',exact:true}).getAttribute('aria-selected'),'true');assert.ok(await page.getByText('精修模特图（本次提交）',{exact:true}).isVisible());assert.equal(await page.getByRole('button',{name:'审核任务',exact:true}).count(),0);
 await ctx.finish();console.log('PASS retouching employee opens the correct image form by default; no unauthorized routes or real writes');
}catch(e){console.error('calls',calls.slice(-12));console.error('errors',ctx.state.errors);console.error('warn',ctx.state.warnings);await page.screenshot({path:process.env.TEMP+'/codex-drawing-employee-failure.png',fullPage:true});await ctx.browser.close();throw e;}
