import {setup,assert} from './codex-drawing-common.mjs';
const permissions=['system:permission:assign-role-menu','system:permission:assign-user-role'];
const ctx=await setup({permissions,roles:['common','super_admin']});
const {page}=ctx;
await page.route('**/admin-api/system/role/*simple*',r=>r.fulfill({json:{code:0,data:[]}}));
await page.route('**/admin-api/system/user/*simple*',r=>r.fulfill({json:{code:0,data:[]}}));
await page.route('**/admin-api/flycowerp/newProductTask/page',async r=>{
 assert.equal(r.request().postDataJSON().currentAssigneeId,undefined);
 await r.fulfill({json:{code:0,data:{list:[],total:0}}});
});
const snapshot=()=>page.evaluate(()=>{
 const stores=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s;
 const access=stores.get('core-access');
 return {codes:[...access.accessCodes],menus:access.accessMenus.map(m=>({path:m.path,children:m.children?.map(c=>c.path)}))};
});
function check(s){
 assert.ok(s.codes.includes('flycowerp:drawing:manage'));
 assert.ok(!s.codes.includes('*:*:*'));
 assert.deepEqual(s.codes, [...permissions,'flycowerp:drawing:manage']);
 const launch=s.menus.find(m=>m.path==='/launch'); assert.ok(launch);
 for(const p of ['/launch/tasks','/launch/workbench','/launch/process','/launch/definitions','/launch/duties']) assert.ok(launch.children.includes(p),p);
 assert.equal(s.menus.find(m=>m.path==='/drawing')?.children.length,15);
 assert.ok(!s.menus.find(m=>m.path==='/system')?.children?.includes('/system/role'));
}
try{
 check(await snapshot()); console.log('PASS login: backend super_admin role restores all workflow menus, without global or system grants');
 for(const path of ['/launch/process','/launch/definitions','/launch/duties','/drawing/retouching']) {
  await ctx.navigate(path); assert.equal(new URL(page.url()).pathname,path);check(await snapshot());
 }
 console.log('PASS full reload and direct workflow pages; manager task query has no employee assignee restriction');
 await page.evaluate(async()=>{await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/drawing/launchAudit');});
 await page.waitForTimeout(700);assert.equal(new URL(page.url()).pathname,'/drawing/launchAudit');
 await page.evaluate(async()=>{await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/system/role');});
 await page.waitForTimeout(700);assert.equal(new URL(page.url()).pathname,'/forbidden');
 await ctx.finish();console.log('PASS SPA guard permits workflow and preserves denial of unrelated system routes; no runtime errors or real writes');
}catch(e){console.error(ctx.state.errors);await ctx.browser.close();throw e;}
