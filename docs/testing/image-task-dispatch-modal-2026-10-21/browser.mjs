import fs from 'node:fs/promises';
import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';

const ctx = await setup({ permissions: ['flycowerp:drawing:aiImageTaskDispatch'], userId: 7, roles: [] });
const { page } = ctx;
const task = { id: 88, styleNo: 'QA-DISPATCH', procInstId: 'qa-dispatch-proc', currentNodeKey: 'aiImageTaskDispatch', currentNodeName: 'AI图片生成任务分配', currentNodeTaskId: '9007199254740993123', currentNodeAssigneeId: '7', currentNodeStatus: 2, flowStatus: 2 };
const styles = [{ id: '9007199254740993101', styleNo: 'QA-DISPATCH', styleName: '红色' }, { id: '9007199254740993102', styleNo: 'QA-DISPATCH', styleName: '蓝色' }];
const calls = [];
let visible = true;
let fail = false;
let pending = false;
let release;
await page.route('**/admin-api/system/user/simple-list', route => route.fulfill({ json: { code: 0, data: [{ id: 7, nickname: '员工甲' }, { id: 8, nickname: '员工乙' }] } }));
await page.route('**/admin-api/flycowerp/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const endpoint = url.pathname.split('/flycowerp/')[1];
  const body = request.postDataJSON();
  calls.push({ endpoint, body, query: Object.fromEntries(url.searchParams) });
  let data;
  if (endpoint === 'newProductTask/page') {
    assert.equal(body.flowNodeKey, 'aiImageTaskDispatch');
    assert.equal(body.currentAssigneeId, '7');
    data = { list: visible ? [task] : [], total: visible ? 1 : 0 };
  } else if (endpoint === 'newProductStyle/list') {
    assert.equal(url.searchParams.get('taskId'), '88');
    data = styles;
  } else if (endpoint === 'flow/assign') {
    assert.equal(body.procInstId, task.procInstId);
    assert.equal(body.nodeTaskId, task.currentNodeTaskId);
    assert.equal(body.nodeKey, 'aiImageTaskDispatch');
    if (fail) return route.fulfill({ json: { code: 500, msg: '模拟分配失败', data: null } });
    if (pending) await new Promise(resolve => { release = resolve; });
    visible = false;
    data = true;
  } else throw new Error(`Unexpected API: ${endpoint}`);
  await route.fulfill({ json: { code: 0, data } });
});
const dialog = () => page.getByRole('dialog', { name: '分配任务', exact: true });
const row = () => ctx.row('QA-DISPATCH');
const count = endpoint => calls.filter(call => call.endpoint === endpoint).length;
async function open() { await ctx.click(/^分\s*配$/, row()); await dialog().locator('.ant-select').first().waitFor(); }
async function refresh() { await ctx.click(/^刷\s*新$/); await row().waitFor(); }
async function close() { await ctx.click(/^取\s*消$/, dialog()); await dialog().waitFor({ state: 'hidden' }); }
try {
  await ctx.navigate('/drawing/aiImageTaskDispatch');
  const listUrl = page.url();
  await open();
  assert.equal(page.url(), listUrl);
  assert.equal(count('newProductTask/get/88'), 0, 'direct assign does not open details');
  await dialog().getByText('按款式分配', { exact: true }).waitFor();
  await ctx.click('确认执行', dialog());
  await dialog().getByText('请填写分配备注', { exact: true }).waitFor();
  assert.equal(count('flow/assign'), 0);
  await dialog().locator('textarea').fill('  图片任务分配  ');
  await ctx.select(dialog().locator('.ant-select'), '员工甲 (#7)');
  fail = true;
  await ctx.click('确认执行', dialog());
  await page.getByText('模拟分配失败', { exact: true }).waitFor();
  assert.equal(await dialog().locator('textarea').inputValue(), '  图片任务分配  ');
  fail = false;
  pending = true;
  await Promise.all([page.waitForRequest(request => request.url().endsWith('/flow/assign')), ctx.click('确认执行', dialog())]);
  assert.equal(await dialog().getByRole('button', { name: /^取\s*消$/ }).isDisabled(), true);
  await page.evaluate(async () => { await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/generation/image'); });
  await page.getByText('请先完成或关闭节点操作窗口，再切换页面', { exact: true }).waitFor();
  assert.equal(page.url(), listUrl);
  const unified = calls.findLast(call => call.endpoint === 'flow/assign').body;
  assert.equal(unified.assignMode, 'unified');
  assert.equal(unified.unifiedAssigneeId, '7');
  assert.equal(unified.remarkInfoVO.contentText, '图片任务分配');
  release(); release = undefined; pending = false;
  await dialog().waitFor({ state: 'hidden' });
  await row().waitFor({ state: 'hidden' });

  visible = true;
  await refresh(); await open();
  await dialog().getByText('按款式分配', { exact: true }).click();
  await dialog().locator('textarea').fill('按颜色分配');
  await ctx.select(dialog().locator('.ant-select').nth(0), '员工甲 (#7)');
  await page.locator('.ant-select-dropdown:visible').waitFor({ state: 'hidden' });
  await ctx.select(dialog().locator('.ant-select').nth(1), '员工乙 (#8)');
  await ctx.click('确认执行', dialog());
  await dialog().waitFor({ state: 'hidden' });
  assert.deepEqual(calls.findLast(call => call.endpoint === 'flow/assign').body.styleAssignList.map(item => [item.styleId, item.assigneeId]), styles.map((style, i) => [style.id, String(7 + i)]));

  visible = true;
  await refresh(); await open();
  await dialog().locator('textarea').fill('节点变化应阻止');
  await ctx.select(dialog().locator('.ant-select'), '员工甲 (#7)');
  task.currentNodeTaskId = 'changed-node';
  const before = count('flow/assign');
  await ctx.click('确认执行', dialog());
  await page.getByText('任务状态或节点已变化，请关闭窗口并刷新列表后重试', { exact: true }).last().waitFor();
  assert.equal(count('flow/assign'), before);
  await close();

  await refresh();
  visible = false;
  const stylesBefore = count('newProductStyle/list');
  await ctx.click(/^分\s*配$/, row());
  await page.getByText('任务状态或节点已变化，请关闭窗口并刷新列表后重试', { exact: true }).last().waitFor();
  await dialog().getByText('分配数据加载失败，请重试', { exact: true }).waitFor();
  assert.equal(count('newProductStyle/list'), stylesBefore, 'scope checked before loading style data');
  assert.equal(await dialog().getByRole('button', { name: '确认执行', exact: true }).isDisabled(), true);
  await close();
  await ctx.finish();
  await fs.writeFile(new URL('./result.json', import.meta.url), JSON.stringify({ mode: 'mock-browser', verified: ['list assign opens modal directly without navigation or detail request', 'required remark and assignee, unified and per-style assignments', 'failure retains inputs; success closes and refreshes', 'pending close and navigation guarded', 'node change blocks writes', 'scope checked before loading styles'], calls, runtimeErrors: ctx.state.errors }, null, 2));
  console.log('PASS direct image task dispatch modal');
} catch (error) {
  if (release) release();
  console.error(ctx.state.errors);
  await ctx.browser.close();
  throw error;
}
