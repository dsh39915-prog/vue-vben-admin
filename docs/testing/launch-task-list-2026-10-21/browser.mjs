import fs from 'node:fs/promises';
import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';

const ctx = await setup();
const { page } = ctx;
const calls = [];
const task = { id: 88, styleNo: 'QA-LIST', productSeason: '2026秋', category: '外套', mainPlatform: '天猫', visualLevel: 0, flowStatus: 2, currentNodeName: 'AI搭配方案输出', currentNodeKey: 'aiMatchingOutput', currentNodeTaskId: 'node-88', currentNodeStatus: 1, currentNodeAssigneeId: '7', currentNodeAssigneeName: '小王', dateOverdueStatus: 1, dateOverdueDesc: '已逾期 1天2小时', timeOverdueStatus: 0, launchTime: '2026-10-21 09:00:00', flowStartTime: '2026-10-01 09:00:00', productDeadline: '2026-10-31 09:00:00' };
await page.route('**/admin-api/system/user/simple-list', route => route.fulfill({ json: { code: 0, data: [{ id: 7, username: 'wang', nickname: '小王' }] } }));
await page.route('**/admin-api/flycowerp/newProductTask/page', async route => {
  assert.equal(route.request().method(), 'POST');
  calls.push(route.request().postDataJSON());
  await route.fulfill({ json: { code: 0, data: { list: [task, { ...task, id: 89, styleNo: 'QA-EMPTY', currentNodeStatus: undefined, currentNodeAssigneeName: undefined }], total: 2 } } });
});
const field = label => page.locator('.ant-form-item').filter({ has: page.locator('.ant-form-item-label').getByText(label, { exact: true }) });
const row = id => page.locator(`tr[data-row-key="${id}"]`);
async function select(label, value) {
  await page.locator('.ant-select-dropdown:visible').waitFor({ state: 'hidden' });
  await ctx.select(field(label).locator('.ant-select'), value);
  await page.locator('.ant-select-dropdown:visible').waitFor({ state: 'hidden' });
}
async function setRange(label, start, end) {
  const inputs = field(label).locator('input');
  await inputs.nth(0).click();
  await page.locator(`.ant-picker-dropdown:visible .ant-picker-cell-in-view[title="${start}"]`).click();
  const firstConfirm = page.locator('.ant-picker-dropdown:visible .ant-picker-ok button');
  if (await firstConfirm.count() && await firstConfirm.isEnabled()) await firstConfirm.click();
  await inputs.nth(1).click();
  await page.locator(`.ant-picker-dropdown:visible .ant-picker-cell-in-view[title="${end}"]`).click();
  const confirm = page.locator('.ant-picker-dropdown:visible .ant-picker-ok button');
  if (await confirm.count()) await confirm.click();
  await field('款号').locator('input').click();
}
try {
  await ctx.navigate('/launch/tasks');
  await row(88).waitFor();
  for (const label of ['所在节点', '日期逾期情况', '耗时逾期情况', '当前处理人', '上新时间', '流程开始时间', '商品要求货期']) await field(label).waitFor();
  assert.equal(await page.getByRole('button', { name: '展开筛选', exact: true }).count(), 0);
  assert.equal(await row(88).getByRole('button', { name: /^处\s*理$/ }).count(), 0);
  assert.equal(await row(88).getByRole('button', { name: /^详\s*情$/ }).count(), 0);
  assert.equal(await row(88).getByRole('button', { name: '流程详情', exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: '导入任务', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Excel导入', exact: true }).waitFor();
  const headers = await page.getByRole('columnheader').allTextContents();
  for (const label of ['节点状态', '日期逾期情况', '耗时逾期情况', '当前处理人']) assert.ok(headers.includes(label));
  const cell = (id, title) => row(id).locator('td').nth(headers.indexOf(title));
  assert.equal(await cell(88, '流程状态').innerText(), '进行中');
  assert.equal(await cell(88, '节点状态').innerText(), '未开始');
  assert.match(await cell(88, '日期逾期情况').innerText(), /已逾期 1天2小时/);
  assert.equal(await cell(88, '耗时逾期情况').innerText(), '未逾期');
  assert.equal(await cell(88, '当前处理人').innerText(), '小王');
  assert.equal(await cell(89, '节点状态').innerText(), '-');
  assert.equal(await cell(89, '当前处理人').innerText(), '7');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByText('Excel模板下载', { exact: true }).click()]);
  assert.equal(download.suggestedFilename(), 'template-tasks.xlsx');
  assert.deepEqual(await fs.readFile(await download.path()), await fs.readFile(new URL('../../../apps/web-antd/public/template-tasks.xlsx', import.meta.url)), 'download matches supplied public template exactly');

  await select('所在节点', 'AI搭配方案输出');
  await select('日期逾期情况', '已逾期');
  await select('耗时逾期情况', '未逾期');
  await select('当前处理人', '小王 (wang)');
  await setRange('上新时间', '2026-10-01', '2026-10-31');
  await setRange('流程开始时间', '2026-10-02', '2026-10-30');
  await setRange('商品要求货期', '2026-10-03', '2026-10-29');
  await field('款号').locator('input').fill(' QA-LIST ');
  await Promise.all([page.waitForResponse(response => response.url().endsWith('/newProductTask/page')), ctx.click(/^查\s*询$/)]);
  const query = calls.at(-1);
  assert.equal(query.flowNodeKey, 'aiMatchingOutput');
  assert.equal(query.dateOverdueStatus, 1);
  assert.equal(query.timeOverdueStatus, '0');
  assert.equal(query.currentAssigneeId, '7');
  assert.equal(query.styleNo, 'QA-LIST');
  for (const [key, dates] of Object.entries({ launchTimes: ['2026-10-01', '2026-10-31'], flowStartTimes: ['2026-10-02', '2026-10-30'], productDeadlines: ['2026-10-03', '2026-10-29'] })) {
    assert.deepEqual(query[key].map(value => value.slice(0, 10)), dates);
    assert.ok(query[key].every(value => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)));
  }
  await Promise.all([page.waitForResponse(response => response.url().endsWith('/newProductTask/page')), ctx.click(/^重\s*置$/)]);
  assert.deepEqual(calls.at(-1), { pageNo: 1, pageSize: 10 });
  for (const label of ['所在节点', '日期逾期情况', '耗时逾期情况', '当前处理人', '上新时间', '流程开始时间', '商品要求货期']) await field(label).waitFor();
  await ctx.finish();
  await fs.writeFile(new URL('./result.json', import.meta.url), JSON.stringify({ mode: 'mock-browser', verified: ['redundant handle/details removed; process details retained', 'Excel import label and exact template file download', 'requested filters visible by default', 'node/overdue/assignee and three date ranges submitted with correct types and reset', 'distinct flow/node status; overdue description and assignee/fallback displayed'], calls, runtimeErrors: ctx.state.errors }, null, 2));
  console.log('PASS launch task list, expanded filters and Excel template download');
} catch (error) {
  console.error(ctx.state.errors);
  await ctx.browser.close();
  throw error;
}
