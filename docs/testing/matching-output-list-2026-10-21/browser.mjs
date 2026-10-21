import fs from 'node:fs/promises';
import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';

const calls = [];
async function run(employee = false) {
  const ctx = await setup(employee ? { permissions: ['flycowerp:drawing:aiMatchingOutput'], userId: 7, roles: [] } : {});
  const { page } = ctx;
  const task = { id: 88, styleNo: 'QA-MATCH', productSeason: '2026秋', category: '外套', mainPlatform: '天猫', visualLevel: 0, procInstId: 'qa-list-proc', currentNodeKey: 'aiMatchingOutput', currentNodeName: 'AI搭配方案输出', currentNodeTaskId: '9007199254740993123', currentNodeAssigneeId: '7', currentNodeAssigneeName: '小王', currentNodeStatus: 2, flowStatus: 2 };
  const tasks = [task, { ...task, id: 89, styleNo: 'QA-MISSING', currentNodeTaskId: undefined }];
  let failUsers = true;
  let freezeMode = 'false';
  let release;
  await page.route('**/admin-api/system/user/simple-list', route => {
    if (failUsers) {
      failUsers = false;
      return route.fulfill({ json: { code: 500, msg: '模拟处理人读取失败', data: null } });
    }
    return route.fulfill({ json: { code: 0, data: [{ id: 7, username: 'wang', nickname: '小王' }] } });
  });
  await page.route('**/admin-api/flycowerp/**', async route => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname.split('/flycowerp/')[1];
    const body = request.postDataJSON();
    calls.push({ employee, endpoint, method: request.method(), body });
    let data;
    if (endpoint === 'newProductTask/page') {
      assert.equal(body.flowNodeKey, 'aiMatchingOutput');
      if (employee) assert.equal(body.currentAssigneeId, '7');
      data = { list: tasks.filter(t => (!body.currentAssigneeId || t.currentNodeAssigneeId === body.currentAssigneeId) && (body.flowStatus === undefined || t.flowStatus === body.flowStatus)), total: tasks.length };
    } else if (['flow/freeze', 'flow/unfreeze'].includes(endpoint)) {
      assert.equal(employee, false);
      assert.equal(request.method(), 'POST');
      assert.deepEqual(body, { procInstId: task.procInstId, nodeTaskId: task.currentNodeTaskId, nodeKey: 'aiMatchingOutput', remarkInfoVO: { contentText: endpoint === 'flow/freeze' ? '列表冻结测试' : '列表解冻测试', imageUrls: [] } });
      if (endpoint === 'flow/freeze' && freezeMode === 'pending') await new Promise(resolve => { release = resolve; });
      data = endpoint === 'flow/unfreeze' || freezeMode !== 'false';
      if (data) task.flowStatus = task.currentNodeStatus = endpoint === 'flow/freeze' ? 4 : 2;
    } else return route.fallback();
    await route.fulfill({ json: { code: 0, data } });
  });
  const field = label => page.locator('.ant-form-item').filter({ has: page.locator('.ant-form-item-label').getByText(label, { exact: true }) });
  const row = () => page.locator('tr[data-row-key="88"]');
  const countFreeze = () => calls.filter(call => call.employee === employee && call.endpoint === 'flow/freeze').length;
  try {
    await ctx.navigate('/drawing/aiMatchingOutput');
    await row().waitFor();
    for (const label of ['日期逾期情况', '耗时逾期情况', '上新时间', 'AI搭配方案提交计划完成时间']) await field(label).waitFor();
    assert.equal(await page.getByRole('button', { name: '展开筛选', exact: true }).count(), 0);
    if (employee) {
      assert.equal(await field('当前处理人').count(), 0);
      assert.equal(await page.getByRole('button', { name: /^冻\s*结$/ }).count(), 0);
      assert.equal(await page.getByRole('button', { name: /^解\s*冻$/ }).count(), 0);
      await ctx.click('重置');
      await row().waitFor();
      await ctx.finish();
      return;
    }
    await page.getByText('处理人列表加载失败', { exact: true }).waitFor();
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/system/user/simple-list')), ctx.click('重试')]);
    async function select(label, value) {
      const control = field(label).locator('.ant-select');
      await page.locator('.ant-select-dropdown:visible').waitFor({ state: 'hidden' });
      await control.locator('.ant-select-selector').click();
      await page.locator('.ant-select-dropdown:visible').getByTitle(value, { exact: true }).click();
      await page.locator('.ant-select-dropdown:visible').waitFor({ state: 'hidden' });
    }
    await select('当前处理人', '小王 (wang)');
    await select('日期逾期情况', '已逾期');
    await select('耗时逾期情况', '未逾期');
    await select('视觉重要层级', 'S');
    async function setRange(label, start, end) {
      const inputs = field(label).locator('input');
      await inputs.nth(0).click();
      await page.locator(`.ant-picker-dropdown:visible .ant-picker-cell-in-view[title="${start.slice(0, 10)}"]`).click();
      const firstConfirm = page.locator('.ant-picker-dropdown:visible .ant-picker-ok button');
      if (await firstConfirm.count() && await firstConfirm.isEnabled()) await firstConfirm.click();
      await inputs.nth(1).click();
      await page.locator(`.ant-picker-dropdown:visible .ant-picker-cell-in-view[title="${end.slice(0, 10)}"]`).click();
      const confirm = page.locator('.ant-picker-dropdown:visible .ant-picker-ok button');
      if (await confirm.count()) await confirm.click();
      await field('款号').locator('input').click();
    }
    await setRange('上新时间', '2026-10-01 00:00:00', '2026-10-31 23:59:59');
    await setRange('AI搭配方案提交计划完成时间', '2026-10-02 00:00:00', '2026-10-30 23:59:59');
    await page.getByPlaceholder('请输入款号').fill(' QA-MATCH ');
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/newProductTask/page')), ctx.click('查询')]);
    const query = calls.findLast(call => call.endpoint === 'newProductTask/page').body;
    assert.equal(query.currentAssigneeId, '7');
    assert.equal(query.dateOverdueStatus, 1);
    assert.equal(query.timeOverdueStatus, '0');
    assert.equal(query.visualLevel, 0);
    assert.equal(query.styleNo, 'QA-MATCH');
    assert.deepEqual(query.launchTimes.map(value => value.slice(0, 10)), ['2026-10-01', '2026-10-31']);
    assert.deepEqual(query.flowNodePlanEndTimes.map(value => value.slice(0, 10)), ['2026-10-02', '2026-10-30']);
    for (const value of [...query.launchTimes, ...query.flowNodePlanEndTimes]) assert.match(value, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/newProductTask/page')), ctx.click('重置')]);
    const reset = calls.findLast(call => call.endpoint === 'newProductTask/page').body;
    assert.deepEqual(reset, { pageNo: 1, pageSize: 10, flowNodeKey: 'aiMatchingOutput' });
    assert.equal(await page.locator('tr[data-row-key="89"]').getByRole('button', { name: /^冻\s*结$/ }).count(), 0);
    await ctx.click(/^冻\s*结$/, row());
    await ctx.dialog().locator('textarea').fill('列表冻结测试');
    await ctx.click('确认执行', ctx.dialog());
    await page.getByText('冻结节点未成功，请重试', { exact: true }).waitFor();
    assert.equal(await ctx.dialog().locator('textarea').inputValue(), '列表冻结测试');
    freezeMode = 'pending';
    await Promise.all([page.waitForRequest(r => r.url().endsWith('/flow/freeze')), ctx.click('确认执行', ctx.dialog())]);
    await page.evaluate(async () => { await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/generation/image'); });
    await page.getByText('请先完成或关闭节点操作窗口，再切换页面', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/drawing/aiMatchingOutput');
    release();
    release = undefined;
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await ctx.click(/^解\s*冻$/, row());
    await ctx.dialog().locator('textarea').fill('列表解冻测试');
    await ctx.click('确认执行', ctx.dialog());
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await ctx.click(/^冻\s*结$/, row());
    await ctx.dialog().locator('textarea').fill('列表冻结测试');
    const before = countFreeze();
    task.currentNodeTaskId = 'changed-node-id';
    await ctx.click('确认执行', ctx.dialog());
    await page.getByText('任务状态或节点已变化，请关闭窗口并刷新列表后重试', { exact: true }).waitFor();
    assert.equal(countFreeze(), before);
    await ctx.click(/^取\s*消$/, ctx.dialog());
    await ctx.finish();
  } catch (error) {
    if (release) release();
    await page.screenshot({ path: new URL('./failure.png', import.meta.url).pathname.replace(/^\/(.:)/, '$1'), fullPage: true });
    await ctx.browser.close();
    throw error;
  }
}

await run();
await run(true);
await fs.writeFile(new URL('./result.json', import.meta.url), JSON.stringify({ mode: 'mock-browser', verified: ['node advanced filters visible by default', 'manager assignee initial load failure/retry', 'both overdue types and both date ranges submit/reset correctly', 'manager list freeze/unfreeze, nodeTaskId and remarks', 'failed operation retains input; pending navigation blocked', 'changed nodeTaskId blocks stale write; incomplete context hides operation', 'employee scope remains own tasks without manager controls'], calls }, null, 2));
console.log('PASS matching output list filters and scoped freeze/unfreeze');
