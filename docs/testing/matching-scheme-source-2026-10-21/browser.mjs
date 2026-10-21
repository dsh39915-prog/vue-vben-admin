import fs from 'node:fs/promises';
import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';

const ctx = await setup();
const { page } = ctx;
const calls = [];
const image = name => ({ originalUrl: `https://example.test/${name}.png`, previewUrl: `https://example.test/${name}-preview.png`, thumbnailUrl: `https://example.test/${name}-thumb.png`, imageId: `qa-${name}` });
const task = { id: 88, styleNo: 'QA-TASK', procInstId: 'qa-source-proc', currentNodeKey: 'aiMatchingOutput', currentNodeName: 'AI搭配方案输出', currentNodeTaskId: 'qa-source-node', currentNodeAssigneeId: '1', currentNodeStatus: 2, flowStatus: 2 };
const styles = [
  { id: '9007199254740993123', styleNo: 'QA-MAIN', styleName: '红色', clothingProductUrl: image('table-main').originalUrl },
  { id: '9007199254740993124', styleNo: 'QA-AUX', styleName: '蓝色', clothingProductUrl: JSON.stringify(image('table-aux')) },
];
const complete = (style, id) => ({ id, styleNo: style.styleNo, styleName: style.styleName, hasOtherStyle: false, aiMatchingImageUrl: image('saved-scheme'), mainReferenceFrontUrl: image('saved-front'), mainReferenceSideUrl: image('saved-side'), mainReferenceBackUrl: image('saved-back'), modelImageUrls: image('saved-model'), sceneImageUrls: image('saved-scene'), clothingProductUrls: [{ ...image('old-main'), styleNo: style.styleNo, isMain: 1 }] });
let saved = [];
let failSave = false;
let release;
await page.route('**/admin-api/flycowerp/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const endpoint = url.pathname.split('/flycowerp/')[1];
  const body = request.postDataJSON();
  calls.push({ endpoint, method: request.method(), body, query: Object.fromEntries(url.searchParams) });
  let data;
  if (endpoint === 'newProductTask/page') data = { list: [task], total: 1 };
  else if (endpoint === 'newProductTask/get/88') data = task;
  else if (endpoint === 'newProductStyle/list') {
    assert.equal(url.searchParams.get('taskId'), '88');
    data = styles;
  } else if (endpoint === 'aiMatchingScheme/list') data = saved;
  else if (endpoint === 'aiMatchingScheme/save') {
    assert.equal(request.method(), 'POST');
    assert.equal(body.schemes.length, 2);
    assert.equal(body.procInstId, task.procInstId);
    assert.equal(body.nodeTaskId, task.currentNodeTaskId);
    for (const [index, scheme] of body.schemes.entries()) {
      const source = styles[index];
      const sourceImage = typeof source.clothingProductUrl === 'string' && source.clothingProductUrl.startsWith('https') ? { originalUrl: source.clothingProductUrl, previewUrl: source.clothingProductUrl, thumbnailUrl: source.clothingProductUrl } : JSON.parse(source.clothingProductUrl);
      assert.equal(scheme.styleNo, source.styleNo);
      assert.equal(scheme.styleName, source.styleName);
      assert.equal(scheme.clothingProductUrls.filter(img => img.isMain === 1).length, sourceImage ? 1 : 0);
      if (sourceImage) assert.deepEqual(scheme.clothingProductUrls[0], { ...sourceImage, styleNo: source.styleNo, isMain: 1 });
      else assert.equal(body.status, 0, 'missing main is only allowed in drafts');
      assert.ok(scheme.clothingProductUrls.slice(1).every(img => img.isMain === 0));
      assert.equal(scheme.aiMatchingImageUrl.originalUrl, image('saved-scheme').originalUrl);
    }
    if (failSave) return route.fulfill({ json: { code: 500, msg: '模拟保存失败', data: null } });
    if (body.status === 1) await new Promise(resolve => { release = resolve; });
    saved = body.schemes;
    data = saved.map(scheme => scheme.id);
  } else if (['flow/nodeDetailList', 'flow/transferRecordList'].includes(endpoint)) data = [];
  else return route.fallback();
  await route.fulfill({ json: { code: 0, data } });
});
const cards = () => page.locator('.ant-tabs-tabpane-active .ant-card').filter({ has: page.locator('.ant-collapse') });
const card = (index = 0) => cards().nth(index);
const clothing = (index = 0) => card(index).locator('.ant-form-item').filter({ has: page.locator('.ant-form-item-label').getByText('服装商品图', { exact: true }) });
const countSave = () => calls.filter(call => call.endpoint === 'aiMatchingScheme/save').length;
async function navigate() { await ctx.navigate('/launch/workbench?taskId=88'); await page.getByRole('tab', { name: 'AI 搭配方案', exact: true }).click(); }

try {
  await navigate();
  await card().locator('[data-clothing=main]').waitFor();
  assert.equal(await cards().count(), 2);
  assert.equal(await page.getByRole('button', { name: '添加搭配方案', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: '移除方案', exact: true }).count(), 0);
  for (let index = 0; index < 2; index++) {
    assert.equal(await card(index).getByPlaceholder('请输入方案款号').inputValue(), styles[index].styleNo);
    assert.equal(await card(index).getByPlaceholder('请输入方案款号').isDisabled(), true);
    assert.equal(await card(index).getByPlaceholder('例如：红色').isDisabled(), true);
    assert.equal(await clothing(index).locator('[data-clothing=main]').count(), 1);
    assert.equal(await clothing(index).locator('input, button:not([class*="preview"])').count(), 1, 'only companion picker button exists; main has no editable controls');
    assert.equal(await clothing(index).locator('input[type=file], input[type=checkbox]').count(), 0);
  }
  assert.equal(await clothing().locator('[data-clothing=main] img').getAttribute('src'), image('table-main').originalUrl);
  assert.equal(await clothing(1).locator('[data-clothing=main] img').getAttribute('src'), image('table-aux').thumbnailUrl);

  saved = styles.map((style, index) => complete(style, '90071992547409931' + index));
  await navigate();
  await card().locator('[data-clothing=companion]').waitFor();
  assert.equal(await card().locator(`img[src="${image('saved-scheme').thumbnailUrl}"]`).count(), 1);
  await ctx.click('添加辅服饰图', clothing());
  await ctx.dialog().getByText('请输入款号查找服饰图片', { exact: true }).waitFor();
  await ctx.dialog().getByPlaceholder('输入款号筛选现有款式').fill('NO-MATCH');
  await ctx.dialog().getByText('没有匹配的现有款式', { exact: true }).waitFor();
  await ctx.dialog().getByPlaceholder('输入款号筛选现有款式').fill(' QA-MAIN ');
  assert.equal(await ctx.dialog().getByRole('button', { name: '已添加', exact: true }).isDisabled(), true);
  await ctx.dialog().getByPlaceholder('输入款号筛选现有款式').fill('qa-aux');
  await ctx.click('添加搭配服饰', ctx.dialog());
  assert.equal(await ctx.dialog().getByRole('button', { name: '已添加', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: '保存方案', exact: true }).isDisabled(), true);
  await ctx.click('完成选择', ctx.dialog());
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await clothing().locator('[data-clothing=main]').count(), 1);
  assert.equal(await clothing().locator('[data-clothing=companion]').count(), 2);
  assert.equal(await clothing().locator('input[type=checkbox]').count(), 0);
  failSave = true;
  await ctx.click('保存方案');
  await page.getByText('模拟保存失败', { exact: true }).waitFor();
  assert.equal(await clothing().locator('[data-clothing=companion]').count(), 2);
  failSave = false;
  await Promise.all([page.waitForResponse(response => response.url().endsWith('/aiMatchingScheme/save')), ctx.click('保存方案')]);
  await clothing().locator('[data-clothing=main]').waitFor();
  const payload = calls.findLast(call => call.endpoint === 'aiMatchingScheme/save').body;
  assert.equal(payload.schemes[0].id, '900719925474099310');
  assert.equal(payload.schemes[0].clothingProductUrls.at(-1).originalUrl, image('table-aux').originalUrl);
  assert.equal(payload.schemes[0].clothingProductUrls.at(-1).styleNo, 'QA-AUX');
  await ctx.click('移除搭配服饰 2', clothing());
  assert.equal(await clothing().locator('[data-clothing=companion]').count(), 1);
  assert.equal(await clothing().locator('[data-clothing=main]').count(), 1);
  await ctx.click('提交方案');
  await Promise.all([page.waitForRequest(request => request.url().endsWith('/aiMatchingScheme/save')), ctx.confirm()]);
  await page.evaluate(async () => { await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/generation/image'); });
  await page.getByText('正在处理请求，请完成后再切换任务', { exact: true }).waitFor();
  release();
  release = undefined;
  await clothing().locator('[data-clothing=main]').waitFor();
  assert.equal(calls.findLast(call => call.endpoint === 'aiMatchingScheme/save').body.status, 1);

  styles[0].clothingProductUrl = null;
  await navigate();
  await clothing().getByText('表格数据缺少主服饰图，请补齐来源数据后重新加载', { exact: true }).waitFor();
  await Promise.all([page.waitForResponse(response => response.url().endsWith('/aiMatchingScheme/save')), ctx.click('保存方案')]);
  const beforeMissing = countSave();
  await ctx.click('提交方案');
  await ctx.confirm();
  await page.getByText('请检查方案中标红的必填项和图片', { exact: true }).waitFor();
  assert.equal(countSave(), beforeMissing);
  styles[0].clothingProductUrl = image('table-main').originalUrl;
  saved.push({ ...saved[0], id: 'qa-orphan', styleNo: 'QA-REMOVED', styleName: '旧颜色' });
  await navigate();
  await page.getByText('已有方案与表格款式不一致，请核对来源数据后重新加载', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '保存方案', exact: true }).count(), 0);
  saved.pop();
  task.flowStatus = task.currentNodeStatus = 4;
  await navigate();
  await clothing().locator('[data-clothing=main]').waitFor();
  assert.equal(await clothing().getByRole('button', { name: '添加辅服饰图', exact: true }).count(), 0);
  assert.equal(await clothing().getByRole('button', { name: /^移除搭配服饰 / }).count(), 0);
  assert.equal(await clothing().getByRole('link', { name: '查看原图', exact: true }).first().getAttribute('disabled'), null, 'readonly mode still permits viewing originals');
  await ctx.finish();
  await fs.writeFile(new URL('./result.json', import.meta.url), JSON.stringify({ mode: 'mock-browser', verified: ['source styles automatically create one scheme per style/color', 'plain URL and serialized image source decoding', 'source identity and exactly one main image locked', 'saved IDs and other scheme materials preserved', 'style number search, no match, duplicate prevention, companion add/remove', 'available source main stays unique; all companions=0 with source styleNo', 'save failure retains changes; submit guards route', 'missing main allows draft save but blocks submit; mismatched source blocks editing', 'frozen task remains read-only'], calls, runtimeErrors: ctx.state.errors }, null, 2));
  console.log('PASS table-based matching schemes, immutable main clothing and existing style companion selection');
} catch (error) {
  if (release) release();
  console.error('runtime errors', ctx.state.errors);
  await ctx.browser.close();
  throw error;
}
