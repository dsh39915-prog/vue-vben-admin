import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';

const ctx = await setup();
const { page } = ctx;
ctx.state.images = ctx.state.images.map(({ goodsCode, ...image }) => ({ ...image, styleNo: `QA-STYLE-${image.id}` }));
// Disabled models may appear first; generation must choose the first enabled one.
ctx.state.models = [ctx.state.models[1], ctx.state.models[0], ...ctx.state.models.slice(2)];
page.on('pageerror', error => console.error(error.stack));
await page.route('**/admin-api/system/user/simple-list', route => route.fulfill({ json: { code: 0, data: [] } }));
const calls = [];
let nodeKey = 'aiImageModelTask';
const styleId = '9007199254740993123';
await page.route('**/admin-api/flycowerp/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const endpoint = url.pathname.split('/flycowerp/')[1];
  const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null;
  calls.push({ endpoint, body });
  const task = { id: 88, styleNo: 'QA-SOURCE', procInstId: 'qa-source', currentNodeKey: nodeKey, currentNodeTaskId: '1001', currentNodeAssigneeId: '1', currentNodeStatus: 2, flowStatus: 2 };
  let data;
  if (endpoint === 'aiPrompt/page') data = { records: [], total: 0 };
  else if (endpoint === 'newProductTask/page') data = { list: [task], total: 1 };
  else if (endpoint === 'newProductTask/get/88') data = task;
  else if (endpoint === 'newProductStyle/list' || endpoint === 'newProductStyle/queryMatchStyleList') data = [{ id: styleId, styleNo: 'QA-SOURCE', styleName: '红色' }];
  else if (endpoint === 'flow/draft/get') data = null;
  else if (endpoint.startsWith('aiImageResult/')) {
    assert.equal(url.searchParams.get('sourcePage'), nodeKey === 'aiImageActionTask' ? '6' : '5');
    data = [];
  }
  else if (endpoint === 'aiMatchingScheme/list') data = [];
  else return route.fallback();
  await route.fulfill({ json: { code: 0, data } });
});
async function generate(scope, num, button, expected) {
  await scope.locator('.ant-select').first().getByText('测试图片模型', { exact: true }).waitFor();
  await scope.locator('.ant-form-item').filter({ has: page.getByText('画质', { exact: true }) }).locator('.ant-select').waitFor();
  await scope.locator('.ant-form-item').filter({ has: page.getByText('图片尺寸', { exact: true }) }).locator('.ant-select').waitFor();
  await scope.locator('textarea').fill('来源页面测试');
  const styleInput = scope.getByPlaceholder('请输入款号', { exact: true });
  if (await styleInput.count()) await styleInput.fill('  QA-NEW-STYLE  ');
  await scope.locator('.ant-input-number-input').fill(String(num));
  const response = page.waitForResponse(response => response.url().endsWith('/aiImg/save'));
  await ctx.click(button, scope);
  const request = (await response).request().postDataJSON();
  assert.equal(request.sourcePage, expected);
  assert.equal(request.styleNo, expected === 5 || expected === 6 ? 'QA-SOURCE' : 'QA-NEW-STYLE');
  assert.equal(Object.hasOwn(request, 'goodsCode'), false);
  assert.equal(request.aiModelId, 1);
  assert.equal(request.quality, '2K');
  assert.equal(request.size, '1024x1024');
  assert.equal(request.aspectRatio, '1:1');
  assert.equal(Object.hasOwn(request, 'imgType'), false);
  await page.getByText('生成任务已提交，可在任务中心查看进度', { exact: true }).last().waitFor();
}
try {
  await ctx.navigate('/generation/image');
  for (const [num, sourcePage] of [[1, 0], [4, 1]]) {
    await ctx.click('新建图片生成');
    const dialog = page.getByRole('dialog', { name: '新建图片生成', exact: true });
    await dialog.locator('textarea').waitFor();
    await generate(dialog, num, '生成图片', sourcePage);
    await dialog.waitFor({ state: 'hidden' });
  }
  for (const [label, sourcePage] of [['模特图', 5], ['动作图', 6]]) {
    nodeKey = label === '动作图' ? 'aiImageActionTask' : 'aiImageModelTask';
    await ctx.navigate(`/drawing/${nodeKey}?taskId=88`);
    const editor = page.locator('.embedded-image-editor');
    await editor.locator('textarea').waitFor();
    await generate(editor, 4, `立即生成（${label}）`, sourcePage);
    assert.equal(ctx.lastRequest('/aiImg/save').body.styleId, styleId);
  }
  await ctx.navigate('/generation/image');
  await ctx.row('QA-STYLE-1').waitFor();
  assert.equal(await page.getByRole('columnheader', { name: '商品编码', exact: true }).count(), 0);
  const filter = page.getByPlaceholder('请输入款号', { exact: true });
  await filter.fill('  QA-STYLE-1  ');
  const filterResponse = page.waitForResponse(response => response.url().endsWith('/aiImg/page'));
  await ctx.click('查询');
  await filterResponse;
  const filtered = ctx.lastRequest('/aiImg/page').body;
  assert.equal(filtered.styleNo, 'QA-STYLE-1');
  assert.equal(Object.hasOwn(filtered, 'styleNumber'), false);
  await ctx.click('编辑', ctx.row('QA-STYLE-1'));
  const editing = page.getByRole('dialog', { name: '编辑图片生成', exact: true });
  await editing.getByPlaceholder('请输入款号', { exact: true }).waitFor();
  assert.equal(await editing.getByPlaceholder('请输入款号', { exact: true }).inputValue(), 'QA-STYLE-1');
  await editing.getByPlaceholder('请输入款号', { exact: true }).fill('QA-EDITED-STYLE');
  const updatedResponse = page.waitForResponse(response => response.url().endsWith('/aiImg/update'));
  await ctx.click('暂存', editing);
  await updatedResponse;
  assert.equal(ctx.lastRequest('/aiImg/update').body.styleNo, 'QA-EDITED-STYLE');
  assert.equal(Object.hasOwn(ctx.lastRequest('/aiImg/update').body, 'goodsCode'), false);
  await editing.waitFor({ state: 'hidden' });
  await ctx.click('详情 / 结果', ctx.row('QA-EDITED-STYLE'));
  const results = page.getByRole('dialog', { name: '图片生成结果', exact: true });
  await results.getByText(/生图记录 #1 · QA-EDITED-STYLE/).waitFor();
  await results.getByRole('button', { name: 'Close', exact: true }).click();
  await results.waitFor({ state: 'hidden' });
  const sourceField = page.locator('.ant-form-item').filter({ has: page.getByText('来源页面', { exact: true }) });
  for (const [label, sourcePage] of [['单图生成', 0], ['批量生成', 1], ['线稿生图', 3], ['材质增强', 4], ['模特图', 5], ['动作图', 6]]) {
    await ctx.select(sourceField.locator('.ant-select'), label);
    const response = page.waitForResponse(response => response.url().endsWith('/aiImg/page'));
    await ctx.click('查询');
    await response;
    const request = ctx.lastRequest('/aiImg/page').body;
    assert.equal(request.sourcePage, sourcePage);
    assert.equal(Object.hasOwn(request, 'imgType'), false);
  }
  await ctx.finish();
  console.log('PASS sourcePage: standalone 0/1, workflow 5/6 with multiple outputs, all six list filters');
} catch (error) {
  console.error(ctx.state.errors);
  console.error((await page.locator('body').innerText()).slice(-4000));
  await ctx.browser.close();
  throw error;
}
