import {setup,assert} from './codex-drawing-common.mjs';
const ctx=await setup();const{page}=ctx;const calls=[];let nextId=500;let failRole=true;let failUser=true;let grant=[99];let userGrant=[10,77];
const menus=[{id:99,name:'原有菜单',permission:'other:read',type:3,status:0}];
const prefix='flycowerp:drawing:';const stages=['aiMatchingOutput','aiMatchingAudit','aiImageTaskDispatch','aiImageModelTask','aiImageModelAudit','aiImageActionTask','aiImageActionAudit','retouchTaskDispatch','retouching','retouchingAudit','pageTaskDispatch','pageProduction','pageProductionAudit','launchTaskDispatch','launchAudit'];
await page.route('**/admin-api/system/**',async route=>{
 const r=route.request(),url=new URL(r.url()),p=url.pathname.replace('/admin-api/system/',''),body=r.postDataJSON();
 if(!['role/list-all-simple','user/simple-list','menu/list','menu/create','permission/list-role-menus','permission/assign-role-menu','permission/list-user-roles','permission/assign-user-role'].includes(p)){await route.fallback();return;}
 calls.push({p,method:r.method(),body,query:Object.fromEntries(url.searchParams)});let data;
 if(p==='role/list-all-simple')data=[{id:10,name:'搭配专员',code:'matching',status:0},{id:20,name:'审核专员',code:'audit',status:0}];
 else if(p==='user/simple-list')data=[{id:7,nickname:'测试员工',username:'worker'}];
 else if(p==='menu/list')data=menus;
 else if(p==='menu/create'){assert.equal(r.method(),'POST');assert.ok(body.name);assert.ok(body.type===1||body.type===3);data=++nextId;menus.push({...body,id:data});}
 else if(p==='permission/list-role-menus'){assert.equal(url.searchParams.get('roleId'),'10');data=grant;}
 else if(p==='permission/assign-role-menu'){assert.equal(r.method(),'POST');assert.equal(body.roleId,10);if(failRole){failRole=false;data=false;}else{grant=body.menuIds;data=true;}}
 else if(p==='permission/list-user-roles'){assert.equal(url.searchParams.get('userId'),'7');data=userGrant;}
 else if(p==='permission/assign-user-role'){assert.equal(r.method(),'POST');assert.equal(body.userId,7);if(failUser){failUser=false;data=false;}else{userGrant=body.roleIds;data=true;}}
 await route.fulfill({json:{code:0,data}});
});
await page.route('**/admin-api/flycowerp/newProductTask/page',async route=>{
 const body=route.request().postDataJSON();assert.equal(body.currentAssigneeId,undefined);assert.ok(stages.includes(body.flowNodeKey));await route.fulfill({json:{code:0,data:{list:[{id:1,styleNo:'ADMIN-NODE',flowStatus:1,currentNodeKey:body.flowNodeKey,currentNodeAssigneeId:'8'}],total:1}}});
});
const n=p=>calls.filter(c=>c.p===p).length;const check=label=>page.locator('.ant-checkbox-wrapper').filter({has:page.locator('.ant-checkbox + span').filter({hasText:new RegExp('^'+label+'$')})});
const wait=async fn=>{for(let i=0;i<200&&!fn();i++)await new Promise(r=>setTimeout(r,30));assert.ok(fn());};
try{
 await ctx.navigate('/drawing/aiMatchingOutput');await page.getByRole('cell',{name:'ADMIN-NODE',exact:true}).waitFor();
 const paths=await page.evaluate(async()=>{const useAccessStore=()=>document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('core-access');return useAccessStore().accessMenus.find(m=>m.path==='/drawing')?.children?.map(m=>m.path)??[];});assert.deepEqual(paths,stages.map(k=>'/drawing/'+k));
 for(const key of stages.slice(1)){await ctx.navigate('/drawing/'+key);await page.getByRole('cell',{name:'ADMIN-NODE',exact:true}).waitFor();}
 console.log('PASS all 15 stage routes/menu order and manager task scope across employees');
 await ctx.navigate('/launch/duties');await ctx.select(page.locator('.ant-select').first(),'搭配专员');await page.locator('.ant-checkbox-wrapper').first().waitFor();assert.equal(n('menu/create'),0);assert.equal(n('permission/assign-role-menu'),0);
 await check('AI搭配方案输出').click();await check('修图审核').click();grant.push(100);await ctx.click('保存职责');await page.getByText('职责未保存，请重试',{exact:true}).waitFor();assert.equal(n('menu/create'),3);assert.equal(grant.length,2);assert.ok(await check('AI搭配方案输出').locator('input').isChecked());await ctx.click('保存职责');await wait(()=>n('permission/assign-role-menu')===2);await page.getByText('职责已保存，员工重新登录后生效',{exact:true}).last().waitFor();assert.equal(n('menu/create'),3);
 const outputId=menus.find(m=>m.permission===prefix+'aiMatchingOutput').id;const retouchId=menus.find(m=>m.permission===prefix+'retouchingAudit').id;assert.ok(grant.includes(99)&&grant.includes(100)&&grant.includes(outputId)&&grant.includes(retouchId));
 await check('AI搭配方案输出').click();await ctx.click('保存职责');await wait(()=>n('permission/assign-role-menu')===3);assert.ok(!grant.includes(outputId)&&grant.includes(retouchId)&&grant.includes(99)&&grant.includes(100));
 console.log('PASS selected permission registration, no writes on load, failed-grant retry without duplicate records, fresh unrelated grants retained and duty revocation');
 await page.getByRole('tab',{name:'员工角色',exact:true}).click();const pane=page.locator('.ant-tabs-tabpane-active');await ctx.select(pane.locator('.ant-select').first(),'测试员工 (worker)');await pane.getByText('已分配角色 #77',{exact:true}).waitFor();await ctx.select(pane.locator('.ant-select').nth(1),'审核专员');await page.keyboard.press('Escape');await ctx.click('保存员工角色');await page.getByText('员工角色未保存，请重试',{exact:true}).waitFor();await ctx.click('保存员工角色');await wait(()=>n('permission/assign-user-role')===2);assert.deepEqual([...userGrant].sort((a,b)=>a-b),[10,20,77]);
 await ctx.finish();console.log('PASS employee multi-role assignment, unknown existing roles preserved and false-response retry; zero real permission writes');
}catch(e){console.error('calls',calls.slice(-12));console.error('errors',ctx.state.errors);console.error('warn',ctx.state.warnings);await page.screenshot({path:process.env.TEMP+'/codex-drawing-admin-failure.png',fullPage:true});await ctx.browser.close();throw e;}
