import {setup,assert} from './codex-drawing-common.mjs';
const ctx=await setup();const {page}=ctx;const calls=[];
const keys=['aiImageTaskDispatch','retouchTaskDispatch','pageTaskDispatch','launchTaskDispatch'];
let tasks=[];let failureMode='';let failUsers=false;let hold;let release;let employee=false;let badScope=false;
const reset=()=>{tasks=keys.flatMap((key,k)=>Array.from({length:12},(_,i)=>({id:k*100+i+1,styleNo:'BATCH-'+key+'-'+(i+1),productSeason:'2026秋',category:'针织裤',flowStatus:i===2?4:1,currentNodeStatus:i===2?4:1,currentNodeKey:key,currentNodeName:key,currentNodeTaskId:i===3?undefined:'node-9007199254740993-'+key+'-'+i,procInstId:'proc-9007199254740993-'+key+'-'+i,currentNodeAssigneeId:i===11?'8':'7',currentNodeAssigneeName:i===11?'其他员工':'当前员工'})));};reset();
await page.route('**/admin-api/system/auth/get-permission-info',r=>r.fulfill({json:{code:0,data:{user:{id:employee?7:1,nickname:'测试员工',username:'worker'},roles:employee?['employee']:['super'],permissions:employee?keys.map(key=>'flycowerp:drawing:'+key):['*:*:*'],menus:[]}}}));
await page.route('**/admin-api/system/user/simple-list',async r=>{calls.push({p:'users'});await r.fulfill({json:failUsers?(failUsers=false,{code:10001,msg:'模拟处理人加载失败',data:null}):{code:0,data:[{id:'0008',nickname:'小李',username:'li'},{id:'7',nickname:'小王',username:'wang'}]}});});
await page.route('**/admin-api/flycowerp/**',async r=>{
 const req=r.request(),u=new URL(req.url()),p=u.pathname.split('/flycowerp/')[1],body=req.postDataJSON();calls.push({p,body});let data;
 if(p==='newProductTask/page'){
  let list=tasks.filter(t=>(!body.flowNodeKey||t.currentNodeKey===body.flowNodeKey)&&(!body.currentAssigneeId||t.currentNodeAssigneeId===body.currentAssigneeId)&&(!body.styleNo||t.styleNo.includes(body.styleNo)));
  if(badScope)list=tasks.filter(t=>t.currentNodeKey===body.flowNodeKey);
  data={list:list.slice((body.pageNo-1)*body.pageSize,body.pageNo*body.pageSize),total:list.length};
 }else if(p==='flow/assign/batch'){
  assert.equal(req.method(),'POST');assert.equal(req.headers().authorization,'Bearer browser-test');assert.deepEqual(Object.keys(body).sort(),['nodeKey','tasks','unifiedAssigneeId','unifiedAssigneeName'].sort());assert.equal(body.unifiedAssigneeId,'0008');assert.equal(body.unifiedAssigneeName,'小李');assert.ok(keys.includes(body.nodeKey));
  for(const t of body.tasks){assert.deepEqual(Object.keys(t).sort(),['nodeTaskId','procInstId']);assert.equal(typeof t.nodeTaskId,'string');assert.match(t.nodeTaskId,/9007199254740993/);assert.ok(tasks.some(row=>row.procInstId===t.procInstId&&row.currentNodeTaskId===t.nodeTaskId&&row.currentNodeKey===body.nodeKey&&(!employee||row.currentNodeAssigneeId==='7')));}
  if(hold)await hold;
  if(failureMode==='api'){failureMode='';await r.fulfill({json:{code:10001,msg:'模拟批量分配失败',data:null}});return;}
  if(failureMode==='false'){failureMode='';data=false;}else {data=true;for(const t of body.tasks){const row=tasks.find(row=>row.procInstId===t.procInstId);row.currentNodeKey='next-stage';row.currentNodeTaskId+='-next';}}
 }else{await r.fallback();return;}
 await r.fulfill({json:{code:0,data}});
});
const count=p=>calls.filter(c=>c.p===p).length;const last=p=>calls.findLast(c=>c.p===p);
const wait=async fn=>{for(let i=0;i<250&&!fn();i++)await page.waitForTimeout(30);assert.ok(fn());};
const row=id=>page.locator('tr[data-row-key="'+id+'"]');const pick=id=>row(id).getByRole('checkbox').check();
const confirm=()=>ctx.click('确认分配',ctx.dialog());const close=()=>ctx.dialog().getByRole('button',{name:'Close',exact:true}).click();
async function nav(key=keys[1]){await ctx.navigate('/drawing/'+key);await row(keys.indexOf(key)*100+1).waitFor();await page.waitForTimeout(400);}
async function open(){await ctx.click('批量分配');await ctx.dialog().getByText('处理人',{exact:true}).waitFor();await page.waitForTimeout(200);}
async function user(){await ctx.select(ctx.dialog().locator('.ant-select'),'小李 (#0008)');}
try{
 for(const [k,key]of keys.entries()){
  await nav(key);assert.ok(await page.getByRole('button',{name:'批量分配',exact:true}).isDisabled());assert.ok(await row(k*100+3).getByRole('checkbox').isDisabled());assert.ok(await row(k*100+4).getByRole('checkbox').isDisabled());
  await pick(k*100+1);await pick(k*100+2);await open();assert.equal(await ctx.dialog().getByText('按款式分配',{exact:true}).count(),0);assert.equal(await ctx.dialog().locator('textarea').count(),0);assert.equal(await ctx.dialog().locator('input[type=file]').count(),0);
  const before=count('flow/assign/batch');await confirm();await ctx.dialog().locator('.ant-form-item-explain-error').getByText('请选择处理人',{exact:true}).waitFor();assert.equal(count('flow/assign/batch'),before);await user();await confirm();await wait(()=>count('flow/assign/batch')===before+1);await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByText('待处理任务（10）',{exact:true}).waitFor();assert.equal(last('flow/assign/batch').body.tasks.length,2);assert.equal(last('flow/assign/batch').body.nodeKey,key);assert.ok(await page.getByRole('button',{name:'批量分配',exact:true}).isDisabled());
 }
 console.log('PASS all 4 assignment nodes, required user, frozen/missing metadata disabled, exact bulk payload/IDs, unified-only controls and refreshed totals');
 reset();await nav();await pick(101);await ctx.click('刷新');await page.getByText('已选择 0 项（当前页）',{exact:true}).waitFor();await pick(101);await ctx.click('查询');await page.getByText('已选择 0 项（当前页）',{exact:true}).waitFor();await page.waitForTimeout(150);await pick(101);await page.locator('.ant-pagination-next').click();await row(111).waitFor();await page.getByText('已选择 0 项（当前页）',{exact:true}).waitFor();await ctx.click('重置');await row(101).waitFor();
 failUsers=true;await pick(101);await open();await ctx.dialog().getByText('处理人列表加载失败，请重试',{exact:true}).waitFor();assert.ok(await ctx.dialog().getByRole('button',{name:'确认分配',exact:true}).isDisabled());await ctx.click('重试',ctx.dialog());await user();
 let before=count('flow/assign/batch');failureMode='false';await confirm();await ctx.dialog().getByText('批量分配未确认成功，请刷新任务后确认状态',{exact:true}).waitFor();assert.equal(count('flow/assign/batch'),before+1);assert.equal(await ctx.dialog().locator('.ant-select-selection-item').getAttribute('title'),'小李 (#0008)');await page.waitForTimeout(250);assert.equal(count('flow/assign/batch'),before+1);
 failureMode='api';await confirm();await page.getByText('模拟批量分配失败',{exact:true}).last().waitFor();assert.ok(await ctx.dialog().isVisible());await page.waitForTimeout(250);assert.equal(count('flow/assign/batch'),before+2);await confirm();await wait(()=>count('flow/assign/batch')===before+3);await page.getByRole('dialog').waitFor({state:'hidden'});
 console.log('PASS selection cleared on refresh/query/page, user-list retry, false/API failure retains form and manual retry without automatic replay');
 for(const variation of ['freeze','node-task','node','gone']){
  reset();await nav();await pick(101);await open();await user();const task=tasks.find(t=>t.id===101);if(variation==='freeze')task.flowStatus=task.currentNodeStatus=4;else if(variation==='node-task')task.currentNodeTaskId='new-task-id';else if(variation==='node')task.currentNodeKey=keys[2];else tasks=tasks.filter(t=>t.id!==101);
  before=count('flow/assign/batch');await confirm();await ctx.dialog().locator('.ant-alert-error').waitFor();assert.equal(count('flow/assign/batch'),before);await close();
 }
 console.log('PASS submit-time freeze, changed task ID, node transition and missing task blocked before bulk write');
 reset();await nav();await pick(101);await open();await user();hold=new Promise(resolve=>release=resolve);before=count('flow/assign/batch');await ctx.dialog().locator('.ant-modal-footer .ant-btn-primary').evaluate(button=>{button.dispatchEvent(new MouseEvent('click',{bubbles:true}));button.dispatchEvent(new MouseEvent('click',{bubbles:true}));});await wait(()=>count('flow/assign/batch')===before+1);assert.ok(await ctx.dialog().getByRole('button',{name:/取\s*消/}).isDisabled());await ctx.dialog().locator('.ant-modal-footer .ant-btn-primary').dispatchEvent('click');await page.evaluate(async()=>{await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/drawing/pageTaskDispatch');});assert.ok(page.url().includes('/drawing/retouchTaskDispatch'));assert.equal(count('flow/assign/batch'),before+1);release();hold=undefined;await page.getByRole('dialog').waitFor({state:'hidden'});
 console.log('PASS in-flight duplicate submit blocked and SPA navigation guarded');
 reset();employee=true;await nav();await page.getByText('待处理任务（11）',{exact:true}).waitFor();assert.equal(last('newProductTask/page').body.currentAssigneeId,'7');assert.equal(await row(112).count(),0);await pick(101);await open();await user();tasks.find(t=>t.id===101).currentNodeAssigneeId='8';before=count('flow/assign/batch');await confirm();await ctx.dialog().getByText('所选任务已流转、转派或不属于当前环节，请刷新列表后重新选择',{exact:true}).waitFor();assert.equal(count('flow/assign/batch'),before);await close();
 reset();await nav();await pick(101);await open();await user();before=count('flow/assign/batch');await confirm();await wait(()=>count('flow/assign/batch')===before+1);await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(last('newProductTask/page').body.currentAssigneeId,'7');
 reset();await nav();await pick(101);await open();await user();badScope=true;before=count('flow/assign/batch');await confirm();await ctx.dialog().getByText('任务筛选结果异常，请刷新后重试',{exact:true}).waitFor();assert.equal(count('flow/assign/batch'),before);await close();badScope=false;
 await ctx.navigate('/drawing/aiMatchingAudit');assert.equal(new URL(page.url()).pathname,'/forbidden');employee=false;await ctx.navigate('/drawing/aiMatchingAudit');await page.getByText('待处理任务（0）',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'批量分配',exact:true}).count(),0);assert.equal(await page.locator('.ant-table-selection-column').count(),0);
 await ctx.finish();console.log('PASS employee scope on preflight/write, reassignment and ignored backend filter blocked, unauthorized route/non-assignment bulk controls absent; zero real writes');
}catch(e){console.error('calls',calls.slice(-10));console.error('errors',ctx.state.errors);await page.screenshot({path:process.env.TEMP+'/codex-batch-assign-failure.png',fullPage:true});await ctx.browser.close();throw e;}
