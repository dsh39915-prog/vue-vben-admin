import fs from 'node:fs/promises';
import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';

const ctx = await setup();
const { page } = ctx;
const bytes = await fs.readFile(new URL('./fixtures/single-qa-task.xlsx', import.meta.url));
const rows = [];
const calls = [];
let mode = 'failure';
let release;
await page.route('**/admin-api/system/user/simple-list', route => route.fulfill({ json: { code: 0, data: [] } }));
await page.route('**/admin-api/flycowerp/newProductTask/**', async route => {
  const request = route.request();
  const endpoint = new URL(request.url()).pathname.split('/newProductTask/')[1];
  calls.push({ endpoint, method: request.method() });
  if (endpoint === 'page') {
    await route.fulfill({ json: { code: 0, data: { list: rows, total: rows.length } } });
    return;
  }
  assert.equal(endpoint, 'import');
  assert.equal(request.method(), 'POST');
  assert.equal(request.headers().authorization, 'Bearer browser-test');
  assert.match(request.headers()['content-type'], /^multipart\/form-data;.*boundary=/);
  assert.match(request.postDataBuffer().toString('latin1'), /name="file"; filename="qa-tasks.xlsx"/);
  assert.ok(request.postDataBuffer().includes(bytes));
  if (mode === 'failure') {
    await route.fulfill({ json: { code: 400, msg: '第 2 行：款号不能为空', data: null } });
    return;
  }
  if (mode === 'pending') await new Promise(resolve => { release = resolve; });
  if (mode !== 'empty-result') rows.push({ id: 99, styleNo: 'QA-IMPORT-BROWSER', productSeason: '2026冬', category: '外套', flowStatus: 0 });
  await route.fulfill({ json: { code: 0, data: mode === 'empty-result' ? null : '导入成功，导入1条数据' } });
});

try {
  await ctx.navigate('/launch/tasks');
  assert.equal(await page.getByRole('button', { name: '新增任务', exact: true }).count(), 0);
  await ctx.click('Excel导入');
  const input = () => ctx.dialog().getByLabel('任务 Excel 文件', { exact: true });
  assert.equal(await ctx.dialog().getByRole('button', { name: '开始导入', exact: true }).isDisabled(), true);
  await input().setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('not an Excel file') });
  await page.getByText('请选择 .xlsx 或 .xls 格式的 Excel 文件', { exact: true }).waitFor();
  await input().setInputFiles({ name: 'empty.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.alloc(0) });
  await page.getByText('不能导入空文件', { exact: true }).waitFor();
  assert.equal(calls.filter(call => call.endpoint === 'import').length, 0);
  await input().setInputFiles({ name: 'qa-tasks.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: bytes });
  await ctx.click('开始导入', ctx.dialog());
  await page.getByText('第 2 行：款号不能为空', { exact: true }).waitFor();
  await ctx.dialog().getByText('导入失败，请检查文件内容及接口错误提示后重试。', { exact: true }).waitFor();
  assert.equal(await input().evaluate(element => element.files[0].name), 'qa-tasks.xlsx');

  mode = 'pending';
  const request = page.waitForRequest(request => request.url().endsWith('/newProductTask/import'));
  await ctx.click('开始导入', ctx.dialog());
  await request;
  assert.equal(await input().isDisabled(), true);
  assert.equal(await ctx.dialog().getByRole('button', { name: /^关\s*闭$/ }).isDisabled(), true);
  await page.evaluate(async () => {
    await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/generation/image');
  });
  await page.getByText('正在导入任务，请完成后再离开页面', { exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/launch/tasks');
  assert.equal(calls.filter(call => call.endpoint === 'import').length, 2);
  const pageRequestsBeforeSuccess = calls.filter(call => call.endpoint === 'page').length;
  release();
  await ctx.dialog().getByText('导入成功，导入1条数据', { exact: true }).waitFor();
  await page.getByRole('cell', { name: 'QA-IMPORT-BROWSER', exact: true }).waitFor();
  assert.ok(calls.filter(call => call.endpoint === 'page').length > pageRequestsBeforeSuccess);
  assert.equal(await input().isDisabled(), true);
  await ctx.click(/^完\s*成$/, ctx.dialog());
  await page.getByRole('dialog').waitFor({ state: 'hidden' });

  mode = 'empty-result';
  await ctx.click('Excel导入');
  assert.equal(await ctx.dialog().getByRole('button', { name: '开始导入', exact: true }).isDisabled(), true);
  await input().setInputFiles({ name: 'qa-tasks.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: bytes });
  await ctx.click('开始导入', ctx.dialog());
  await ctx.dialog().getByText('导入请求已完成，但未返回有效说明，请核对任务列表后再操作。', { exact: true }).waitFor();
  assert.equal(await ctx.dialog().getByRole('button', { name: '开始导入', exact: true }).count(), 0);
  await ctx.finish();
  await fs.writeFile(new URL('./browser-result.json', import.meta.url), JSON.stringify({
    mode: 'mock-browser', verified: ['import entry restored; manual create stays absent', 'extension and empty file validation', 'multipart file and authentication headers', 'server error preserves file for retry', 'pending request locks file/close/navigation', 'success message/readback refresh and no duplicate submit', 'missing result shown as warning; reopening resets file'], calls, runtimeErrors: ctx.state.errors,
  }, null, 2));
  console.log('PASS launch Excel import validation, multipart upload, retry, busy guards, results and list refresh');
} catch (error) {
  if (release) release();
  await ctx.browser.close();
  throw error;
}
