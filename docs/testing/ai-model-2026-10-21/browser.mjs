import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';
import fs from 'node:fs/promises';

const ctx = await setup();
const { page } = ctx;
const providers = [{ id: 2, name: '阿里云百炼' }, { id: 9, name: 'OpenAI' }];
const models = [
  { id: 1, modelName: '测试图片模型', modelCode: 'image-test', modelType: 0, providerId: 9, status: 1, testStatus: 0 },
  { id: 2, modelName: '历史服务商模型', modelCode: 'legacy-test', modelType: 1, providerId: 99, status: 0, testStatus: 0 },
];
const calls = [];
let failProviders = true;
let emptyProviders = false;
let testingReads = 0;
await page.route('**/admin-api/flycowerp/aiModel/**', async route => {
  const request = route.request();
  const endpoint = new URL(request.url()).pathname.split('/aiModel/')[1];
  const body = request.postData() ? request.postDataJSON() : null;
  calls.push({ endpoint, method: request.method(), body });
  let data;
  if (endpoint === 'providerList') {
    assert.equal(request.method(), 'GET');
    if (failProviders) {
      await route.fulfill({ json: { code: 500, msg: '模拟服务商读取失败', data: null } });
      return;
    }
    data = emptyProviders ? [] : providers;
  } else if (endpoint === 'page') {
    assert.equal(request.method(), 'POST');
    if (models[0].testStatus === 1 && ++testingReads >= 2) {
      models[0].testStatus = 2;
      models[0].result = '异步测试成功';
    }
    const rows = models.filter(model => body.providerId === undefined || model.providerId === body.providerId);
    data = { records: rows, total: rows.length, current: body.page, size: body.pageSize };
  } else if (endpoint.startsWith('detail/')) data = models.find(model => model.id === Number(endpoint.split('/')[1]));
  else if (endpoint === 'save' || endpoint === 'update') {
    assert.equal(request.method(), 'POST');
    assert.equal(typeof body.providerId, 'number');
    assert.ok(Object.keys(body).every(key => ['id', 'modelName', 'modelCode', 'modelType', 'providerId', 'status', 'apiUrl', 'apiKey', 'ak', 'sk'].includes(key)));
    if (endpoint === 'save') {
      assert.equal(body.id, undefined);
      assert.equal(body.providerId, 2);
      models.push({ ...body, id: 3, testStatus: 0 });
      data = 3;
    } else {
      assert.equal(body.id, 2);
      assert.equal(body.providerId, 99);
      Object.assign(models[1], body);
      data = true;
    }
  } else if (endpoint === 'testConnection/1') {
    assert.equal(request.method(), 'GET');
    models[0].testStatus = 1;
    data = '测试任务已提交';
  } else throw new Error('Unexpected model API ' + endpoint);
  await route.fulfill({ json: { code: 0, data } });
});

async function query() {
  const response = page.waitForResponse(response => response.url().endsWith('/aiModel/page'));
  await ctx.click('查询');
  await response;
}
const editorProvider = () => ctx.dialog().locator('.ant-form-item').filter({ hasText: '服务商' }).locator('.ant-select');
const results = [];
try {
  await ctx.navigate('/system/ai-model');
  await page.getByText('服务商列表加载失败，请重试', { exact: true }).waitFor();
  failProviders = false;
  await ctx.click('重试');
  await page.getByRole('cell', { name: 'OpenAI', exact: true }).waitFor();
  results.push('provider load failure and retry; table resolves provider name');

  await ctx.select(page.locator('.ant-form-inline .ant-select').nth(1), 'OpenAI');
  await query();
  assert.equal(calls.findLast(call => call.endpoint === 'page').body.providerId, 9);
  await page.getByRole('cell', { name: '历史服务商模型', exact: true }).waitFor({ state: 'hidden' });
  await ctx.click('重置');
  await page.getByRole('cell', { name: '历史服务商模型', exact: true }).waitFor();
  assert.equal(calls.findLast(call => call.endpoint === 'page').body.providerId, undefined);
  results.push('provider filter sends numeric ID; reset clears filter');

  await ctx.click('新增模型');
  await ctx.dialog().getByLabel('模型名称', { exact: true }).fill('新增服务商模型');
  await ctx.dialog().getByLabel('模型编码', { exact: true }).fill('provider-new');
  await ctx.click(/^保\s*存$/, ctx.dialog());
  await ctx.dialog().getByText('请选择服务商', { exact: true }).last().waitFor();
  assert.equal(calls.filter(call => call.endpoint === 'save').length, 0);
  await ctx.select(editorProvider(), '阿里云百炼');
  await ctx.click(/^保\s*存$/, ctx.dialog());
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('cell', { name: '新增服务商模型', exact: true }).waitFor();
  results.push('create requires explicit provider selection and sends selected ID');

  await ctx.click('编辑', ctx.row('历史服务商模型'));
  await editorProvider().getByTitle('服务商 #99', { exact: true }).waitFor();
  await ctx.dialog().getByLabel('模型名称', { exact: true }).fill('历史服务商模型已编辑');
  await ctx.click(/^保\s*存$/, ctx.dialog());
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('cell', { name: '历史服务商模型已编辑', exact: true }).waitFor();
  await ctx.click('详情', ctx.row('历史服务商模型已编辑'));
  await editorProvider().getByTitle('服务商 #99', { exact: true }).waitFor();
  assert.ok((await editorProvider().getAttribute('class')).includes('ant-select-disabled'));
  await ctx.dialog().getByRole('button', { name: 'Close', exact: true }).click();
  results.push('unknown historical provider preserved during edit and read-only details');

  await ctx.click('测试连接', ctx.row('测试图片模型'));
  await ctx.row('测试图片模型').getByText('测试中', { exact: true }).first().waitFor();
  assert.equal(await ctx.row('测试图片模型').getByRole('button', { name: /测试中/ }).isDisabled(), true);
  await ctx.row('测试图片模型').getByText('异步测试成功', { exact: true }).waitFor({ timeout: 15000 });
  await ctx.row('测试图片模型').getByText('测试成功', { exact: true }).waitFor();
  assert.equal(calls.filter(call => call.endpoint === 'testConnection/1').length, 1);
  results.push('asynchronous model test polls status/result and blocks duplicate submission');

  emptyProviders = true;
  await ctx.navigate('/system/ai-model');
  await ctx.click('新增模型');
  await editorProvider().locator('.ant-select-selector').click();
  await page.locator('.ant-select-dropdown:visible').getByText('暂无服务商', { exact: true }).waitFor();
  results.push('empty provider list offers no fabricated default');
  await ctx.finish();
  await fs.writeFile(new URL('./result.json', import.meta.url), JSON.stringify({ mode: 'mock-browser', results, calls, runtimeErrors: ctx.state.errors }, null, 2));
  console.log('PASS AI model provider loading/filter/create/edit/details/empty state and async test regression');
} catch (error) {
  await ctx.browser.close();
  throw error;
}
