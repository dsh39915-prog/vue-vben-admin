import fs from 'node:fs/promises';
import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';

const ctx = await setup();
const { page } = ctx;
const calls = [];
const styleNo = 'QA-TASK-1023';
const styleId = '9007199254740993123';
const records = [0, 3, 4, 5, 2, 1].map((status, i) => ({
  id: 101 + i, imgId: 201 + i, styleId, styleNo: i === 1 ? null : styleNo, status, taskType: 0,
  sourcePage: 5, generateType: 0, modelId: 1, imgNum: 2,
  resultCount: status === 2 ? 2 : 0, progress: status === 2 ? 100 : 0,
  createTime: '2026-10-23 10:00:00',
}));
await page.route('**/admin-api/flycowerp/aiImageTask/**', async route => {
  const request = route.request();
  const endpoint = new URL(request.url()).pathname.split('/aiImageTask/')[1];
  const body = request.postDataJSON();
  calls.push({ endpoint, method: request.method(), body });
  let data;
  if (endpoint === 'page') {
    assert.equal(request.method(), 'POST');
    assert.equal(Object.hasOwn(body, 'styleId'), false);
    const items = body.styleNo && body.styleNo !== styleNo ? [] : records;
    data = { records: items, total: items.length, current: body.page, size: body.pageSize };
  } else if (endpoint === 'statistics') {
    data = { totalCount: 6, waitingCount: 1, runningCount: 1, successCount: 1, failCount: 1, stagingCount: 1 };
  } else if (endpoint.startsWith('detail/')) {
    data = { ...records.find(item => item.id === Number(endpoint.split('/')[1])), styleNo: endpoint === 'detail/101' ? styleNo : null, pauseFlag: 0 };
  } else throw new Error(`Unexpected task operation: ${endpoint}`);
  await route.fulfill({ json: { code: 0, data } });
});
const row = id => page.locator('.ant-table-tbody tr[data-row-key="' + id + '"]');
const dialog = () => page.getByRole('dialog', { name: '生图任务详情', exact: true });
const lastPage = () => calls.findLast(call => call.endpoint === 'page').body;
async function query(text) {
  await page.getByPlaceholder('请输入款号', { exact: true }).fill(text);
  const response = page.waitForResponse(response => response.url().endsWith('/aiImageTask/page'));
  await ctx.click('查询');
  await response;
}
try {
  await ctx.navigate('/task-center');
  await row(101).waitFor();
  await page.getByRole('switch').click(); // Keep the regression independent of polling.
  assert.equal(await page.getByPlaceholder('请输入款式 ID', { exact: true }).count(), 0);
  await query('  ' + styleNo + '  ');
  assert.equal(lastPage().styleNo, styleNo);
  assert.equal(lastPage().page, 1);
  await row(101).getByRole('cell', { name: styleNo, exact: true }).waitFor();
  assert.equal(await page.getByRole('columnheader', { name: '款式 ID', exact: true }).count(), 0);
  await row(102).getByRole('cell', { name: '-', exact: true }).waitFor();
  for (const [id, expected] of [[101, 1], [102, 1], [103, 0], [104, 0], [105, 0], [106, 0]]) {
    assert.equal(await row(id).getByRole('button', { name: '重试', exact: true }).count(), expected);
  }
  await row(103).getByRole('checkbox').check();
  assert.equal(await page.getByRole('button', { name: '批量重试', exact: true }).isDisabled(), true);
  await row(103).getByRole('checkbox').uncheck();
  await row(101).getByRole('checkbox').check();
  assert.equal(await page.getByRole('button', { name: '批量重试', exact: true }).isDisabled(), false);
  await row(101).getByRole('button', { name: '详情', exact: true }).click();
  await dialog().getByText(styleNo, { exact: true }).waitFor();
  await dialog().getByText(styleId, { exact: true }).waitFor();
  assert.equal(await dialog().getByText('流程任务 KEY', { exact: true }).count(), 0);
  await dialog().getByRole('button', { name: 'Close', exact: true }).click();
  await dialog().waitFor({ state: 'hidden' });
  await row(102).getByRole('button', { name: '详情', exact: true }).click();
  const numberItem = dialog().locator('.ant-descriptions-item-label').filter({ hasText: /^款号$/ }).locator('xpath=following-sibling::*[1]');
  await numberItem.getByText('-', { exact: true }).waitFor();
  await dialog().getByRole('button', { name: 'Close', exact: true }).click();
  await dialog().waitFor({ state: 'hidden' });
  await query('NO-MATCH');
  await page.getByText('暂无数据', { exact: true }).waitFor();
  await query('   ');
  assert.equal(Object.hasOwn(lastPage(), 'styleNo'), false);
  await row(101).waitFor();
  await query(styleNo);
  const resetResponse = page.waitForResponse(response => response.url().endsWith('/aiImageTask/page'));
  await ctx.click('重置');
  await resetResponse;
  assert.equal(Object.hasOwn(lastPage(), 'styleNo'), false);
  assert.equal(await page.getByPlaceholder('请输入款号', { exact: true }).inputValue(), '');
  await page.locator('.ant-statistic').filter({ has: page.getByText('暂存', { exact: true }) }).getByText('1', { exact: true }).waitFor();
  assert.equal(ctx.state.warnings.some(warning => warning.includes('Sum of column')), false);
  await ctx.finish();
  await fs.writeFile(new URL('./result.json', import.meta.url), JSON.stringify({ mode: 'mock-browser', verified: ['trimmed styleNo filter replaces unsupported styleId', 'list shows styleNo with null fallback and removes styleId column', 'detail shows styleNo with null fallback and removes businessKey', 'blank query and reset omit styleNo', 'only waiting and failed tasks can retry; cancelled selection cannot batch retry', 'stagingCount displayed'], calls, runtimeErrors: ctx.state.errors }, null, 2));
  console.log('PASS AI image task updated fields');
} catch (error) {
  console.error(ctx.state.errors);
  console.error((await page.locator('body').innerText()).slice(-3500));
  await ctx.browser.close();
  throw error;
}
