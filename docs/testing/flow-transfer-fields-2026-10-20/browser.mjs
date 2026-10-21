import {setup,assert} from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';
import fs from 'node:fs/promises';
const ctx=await setup();const {page}=ctx;let result='提交',opinion='提交搭配方案';
const task={id:1,styleNo:'QA-FLOW',procInstId:'qa-flow',flowStatus:2,currentNodeKey:'aiMatchingOutput',currentNodeStatus:2,currentNodeTaskId:'qa-node',currentNodeAssigneeId:'7'};
await page.route('**/admin-api/flycowerp/**',async route=>{
 const r=route.request(),u=new URL(r.url()),p=u.pathname.split('/flycowerp/')[1];let data;
 if(p==='newProductTask/page')data={list:[task],total:1};
 else if(p==='newProductTask/get/1')data=task;
 else if(p==='flow/transferRecordList')data=[{id:2,operateTime:'2026-10-20 16:53:17',nodeKey:'aiMatchingOutput',nodeName:'AI搭配方案输出',operateTypeName:result,operatorName:'芋道源码',contentText:opinion,imageUrls:'[]'}];
 else if(['flow/nodeDetailList','aiMatchingScheme/list','newProductStyle/list'].includes(p))data=[];
 else throw Error('Unexpected transfer API '+p);
 await route.fulfill({json:{code:0,data}});
});
try{
 await ctx.navigate('/launch/process?taskId=1');await page.getByRole('tab',{name:'流转记录',exact:true}).click();await page.getByRole('cell',{name:'提交',exact:true}).waitFor();await page.getByRole('cell',{name:'提交搭配方案',exact:true}).waitFor();
 result='驳回';opinion='请补充动作图';await ctx.click('刷新记录');await page.getByRole('cell',{name:result,exact:true}).waitFor();await page.getByRole('cell',{name:opinion,exact:true}).waitFor();assert.equal(await page.getByRole('cell',{name:'提交搭配方案',exact:true}).count(),0);
 await ctx.navigate('/drawing/aiMatchingOutput?taskId=1&view=details');await page.getByRole('tab',{name:'流转记录',exact:true}).click();await page.getByRole('cell',{name:result,exact:true}).waitFor();await page.getByRole('cell',{name:opinion,exact:true}).waitFor();
 await ctx.finish();await fs.writeFile(new URL('./result.json',import.meta.url),JSON.stringify({mode:'mock-browser',responseFields:['operateTypeName','contentText'],verified:['process details','refresh records','scoped node details'],runtimeErrors:ctx.state.errors},null,2));console.log('PASS result and opinion render from actual API field names in both workflow views and after refresh; no runtime errors');
}catch(e){await ctx.browser.close();throw e;}
