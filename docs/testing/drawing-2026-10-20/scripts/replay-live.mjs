import {setup,assert} from './codex-drawing-common.mjs';
import fs from 'node:fs/promises';import {fileURLToPath} from 'node:url';
const evidence=JSON.parse(await fs.readFile(new URL('../evidence/live-readonly.json',import.meta.url),'utf8'));
const tasks=evidence.records.find(r=>r.request?.pageSize===100).response.data.list;
const ctx=await setup({roles:['common','super_admin'],permissions:[]});const {page}=ctx;
const records=[];
const canonical=p=>{const u=new URL(p,'http://snapshot');u.searchParams.sort();return u.pathname+u.search;};
await page.route('**/admin-api/flycowerp/**',async route=>{
 const r=route.request(),u=new URL(r.url()),p=u.pathname;let response;
 if(p.endsWith('/newProductTask/page')){
 const b=r.postDataJSON();const list=tasks.filter(t=>(!b.flowNodeKey||t.currentNodeKey===b.flowNodeKey)&&(!b.currentAssigneeId||t.currentNodeAssigneeId===b.currentAssigneeId));response={code:0,data:{list,total:list.length}};
 }else response=evidence.records.find(x=>canonical(x.path)===canonical(p+u.search))?.response;
 if(!response)throw Error('Uncaptured live response '+p+u.search);
 records.push({path:p+u.search,code:response.code});await route.fulfill({json:response});
});
try{
 await ctx.navigate('/launch/process?taskId=1');await page.getByRole('tab',{name:'流转记录',exact:true}).click();await page.getByText('流转记录接口未返回有效数据或加载失败，请重试',{exact:true}).waitFor();
 await page.screenshot({path:fileURLToPath(new URL('../evidence/live-flow-error.png',import.meta.url)),fullPage:true});
 await ctx.navigate('/drawing/aiImageModelTask?taskId=1');await page.getByRole('button',{name:'下载素材',exact:true}).waitFor();await ctx.click('下载素材');await page.getByText('当前节点无可下载的素材',{exact:true}).last().waitFor();
 await page.screenshot({path:fileURLToPath(new URL('../evidence/live-model-no-material.png',import.meta.url)),fullPage:true});
 await page.getByRole('tab',{name:'生图批次',exact:true}).click();await page.waitForTimeout(600);
 assert.equal(await page.getByRole('button',{name:'提交图片',exact:true}).count(),0);
 await ctx.finish();await fs.writeFile(new URL('../evidence/live-replay.json',import.meta.url),JSON.stringify({mode:'captured-live-readonly-responses',records},null,2));
 console.log('PASS captured real responses render: flow record 500, missing materials, empty batch, no production runtime errors');
}catch(e){await ctx.browser.close();throw e;}
