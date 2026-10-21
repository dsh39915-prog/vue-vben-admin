import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';
import fs from 'node:fs/promises';

const ctx = await setup();
const { page } = ctx;
const calls = [];
const task = {
  id: 88, styleNo: 'QA-FREEZE', procInstId: 'qa-freeze-proc',
  currentNodeKey: 'retouching', currentNodeTaskId: '9007199254740993123',
  currentNodeAssigneeId: '7', currentNodeStatus: 2, flowStatus: 2,
};
await page.route('**/admin-api/flycowerp/**', async route => {
  const request = route.request();
  const endpoint = new URL(request.url()).pathname.split('/flycowerp/')[1];
  let data;
  if (endpoint === 'newProductTask/page') data = { list: [task], total: 1 };
  else if (endpoint === 'newProductTask/get/88') data = task;
  else if (['flow/nodeDetailList', 'flow/transferRecordList', 'aiMatchingScheme/list', 'newProductStyle/list'].includes(endpoint)) data = [];
  else if (['flow/freeze', 'flow/unfreeze'].includes(endpoint)) {
    const body = request.postDataJSON();
    assert.equal(request.method(), 'POST');
    assert.deepEqual(body, {
      procInstId: task.procInstId, nodeKey: task.currentNodeKey,
      nodeTaskId: task.currentNodeTaskId,
      remarkInfoVO: { contentText: endpoint === 'flow/freeze' ? '测试冻结' : '测试解冻', imageUrls: [] },
    });
    calls.push({ endpoint, body });
    task.currentNodeStatus = task.flowStatus = endpoint === 'flow/freeze' ? 4 : 2;
    data = true;
  } else throw new Error('Unexpected freeze API ' + endpoint);
  await route.fulfill({ json: { code: 0, data } });
});

try {
  for (const route of ['/launch/process', '/launch/workbench']) {
    await ctx.navigate(route + '?taskId=88');
    await ctx.click('冻结节点');
    await ctx.dialog().locator('textarea').fill('测试冻结');
    await ctx.click('确认执行', ctx.dialog());
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await ctx.click('解冻节点');
    await ctx.dialog().locator('textarea').fill('测试解冻');
    await ctx.click('确认执行', ctx.dialog());
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '冻结节点', exact: true }).waitFor();
  }
  assert.equal(calls.length, 4);
  task.currentNodeStatus = task.flowStatus = 4;
  delete task.currentNodeTaskId;
  await ctx.navigate('/launch/process?taskId=88');
  await ctx.click('解冻节点');
  await ctx.dialog().locator('textarea').fill('保留操作备注');
  await ctx.click('确认执行', ctx.dialog());
  await page.getByText('节点任务信息不完整，请刷新任务', { exact: true }).waitFor();
  assert.equal(calls.length, 4);
  assert.equal(await ctx.dialog().locator('textarea').inputValue(), '保留操作备注');
  await ctx.finish();
  await fs.writeFile(new URL('./result.json', import.meta.url), JSON.stringify({
    mode: 'mock-browser', verified: ['freeze/unfreeze in process management and workbench', 'string nodeTaskId preserved', 'missing nodeTaskId blocks request and retains remark'], calls, runtimeErrors: ctx.state.errors,
  }, null, 2));
  console.log('PASS freeze/unfreeze nodeTaskId on both pages; missing task ID blocks request; no runtime errors');
} catch (error) {
  await ctx.browser.close();
  throw error;
}
