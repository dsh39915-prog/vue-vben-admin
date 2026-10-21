import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';

const ctx = await setup();
const { page } = ctx;
const calls = [];
const image = name => ({ originalUrl: `https://example.test/${name}.png`, previewUrl: `https://example.test/${name}.png`, thumbnailUrl: `https://example.test/${name}.png`, imageId: name });
const task = { id: 88, styleNo: 'QA-MODAL', procInstId: 'qa-modal-proc', currentNodeKey: 'aiMatchingOutput', currentNodeName: 'AI搭配方案输出', currentNodeTaskId: 'qa-modal-node', currentNodeAssigneeId: '1', currentNodeStatus: 2, flowStatus: 2 };
const styles = [{ id: 'style-1', styleNo: 'QA-MAIN', styleName: '红色', clothingProductUrl: image('main').originalUrl }, { id: 'style-2', styleNo: 'QA-AUX', styleName: '蓝色', clothingProductUrl: image('aux').originalUrl }];
let saved = styles.map((s, i) => ({ id: `scheme-${i}`, styleNo: s.styleNo, styleName: s.styleName, hasOtherStyle: false, aiMatchingImageUrl: image('scheme'), mainReferenceFrontUrl: image('front'), mainReferenceSideUrl: image('side'), mainReferenceBackUrl: image('back'), modelImageUrls: image('model'), sceneImageUrls: image('scene'), clothingProductUrls: [{ ...image(i ? 'aux' : 'main'), isMain: 1, styleNo: s.styleNo }] }));
let failSave = false;
let visible = true;
let release;
let uploadSerial = 0;
await page.route('**/admin-api/system/user/simple-list', route => route.fulfill({ json: { code: 0, data: [{ id: 1, nickname: 'Test' }] } }));
await page.route('**/admin-api/flycowerp/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const endpoint = url.pathname.split('/flycowerp/')[1];
  const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null;
  calls.push({ endpoint, body, query: Object.fromEntries(url.searchParams) });
  let data;
  if (endpoint === 'newProductTask/page') data = { list: visible ? [task] : [], total: visible ? 1 : 0 };
  else if (endpoint === 'newProductTask/get/88') data = task;
  else if (endpoint === 'newProductStyle/list') data = styles;
  else if (endpoint === 'aiMatchingScheme/list') data = saved;
  else if (endpoint === 'temp-image/upload') {
    assert.match(request.headers()['content-type'], /multipart\/form-data/);
    data = image('uploaded-scene-' + ++uploadSerial);
  }
  else if (endpoint === 'library-category/tree') data = [];
  else if (endpoint === 'library-image/page') {
    assert.equal(url.searchParams.get('libraryType'), '2');
    data = { list: [{ id: 42, imageName: '测试场景', libraryType: 2, categoryId: 1, ...image('library-scene') }], total: 1 };
  }
  else if (endpoint === 'aiMatchingScheme/save') {
    assert.equal(body.procInstId, task.procInstId);
    assert.equal(body.nodeTaskId, task.currentNodeTaskId);
    assert.equal(body.schemes.length, 2);
    assert.ok(body.schemes.every(scheme => scheme.clothingProductUrls.filter(img => img.isMain === 1).length === 1));
    if (failSave) return route.fulfill({ json: { code: 500, msg: '模拟保存失败', data: null } });
    if (body.status === 1) await new Promise(resolve => { release = resolve; });
    saved = body.schemes;
    if (body.status === 1) visible = false;
    data = saved.map(scheme => scheme.id);
  } else return route.fallback();
  await route.fulfill({ json: { code: 0, data } });
});
const modal = () => page.getByRole('dialog').filter({ has: page.getByText('任务款号：QA-MODAL', { exact: false }) });
const cards = () => modal().locator('.ant-card').filter({ has: page.locator('.ant-collapse') });
const first = () => cards().first();
const sceneField = () => first().locator('.ant-form-item').filter({ has: page.locator('.ant-form-item-label').getByText('场景图', { exact: true }) });
const count = endpoint => calls.filter(call => call.endpoint === endpoint).length;
async function open() {
  await ctx.click(task.flowStatus === 4 ? /^查\s*看$/ : /^提\s*交$/, ctx.row('QA-MODAL'));
  await first().locator('[data-clothing=main]').waitFor();
}
async function close() {
  await modal().getByRole('button', { name: 'Close', exact: true }).click();
  await modal().waitFor({ state: 'hidden' });
}
try {
  const completeSchemes = structuredClone(saved);
  saved = saved.map(({ id, styleNo, styleName, clothingProductUrls }) => ({ id, styleNo, styleName, clothingProductUrls }));
  await ctx.navigate('/drawing/aiMatchingOutput');
  const listUrl = page.url();
  await open();
  await Promise.all([page.waitForResponse(r => r.url().endsWith('/aiMatchingScheme/save')), ctx.click('保存方案', modal())]);
  await page.getByText('搭配方案已保存', { exact: true }).last().waitFor();
  const draft = calls.findLast(call => call.endpoint === 'aiMatchingScheme/save').body;
  assert.equal(draft.status, 0);
  assert.ok(draft.schemes.every(scheme => !scheme.aiMatchingImageUrl && !scheme.mainReferenceFrontUrl));
  const beforeIncompleteSubmit = count('aiMatchingScheme/save');
  await ctx.click('提交方案', modal());
  await ctx.confirm();
  await page.getByText('请检查方案中标红的必填项和图片', { exact: true }).waitFor();
  assert.ok(await modal().locator('.ant-form-item-has-error').count() > 0);
  assert.equal(count('aiMatchingScheme/save'), beforeIncompleteSubmit);
  await Promise.all([page.waitForResponse(r => r.url().endsWith('/aiMatchingScheme/save')), ctx.click('保存方案', modal())]);
  assert.equal(await modal().locator('.ant-form-item-has-error').count(), 0);
  await close();
  saved = completeSchemes;
  await open();
  const references = first().getByRole('region', { name: '主参考图', exact: true });
  assert.equal(await references.locator('.ant-form-item').count(), 4);
  for (const [width, height] of [[1440, 900], [1366, 768]]) {
    await page.setViewportSize({ width, height });
    await references.scrollIntoViewIfNeeded();
    const boxes = await references.locator('.ant-form-item').evaluateAll(items => items.map(item => {
      const { x, y, width } = item.getBoundingClientRect();
      return { x, y, width };
    }));
    assert.ok(boxes.every(box => Math.abs(box.y - boxes[0].y) < 2), 'front, side, back and vision share one row');
    assert.ok(boxes[0].x + boxes[0].width <= boxes[1].x && boxes[1].x + boxes[1].width <= boxes[2].x);
    assert.deepEqual(await references.locator('.ant-form-item-label').allTextContents(), ['正面', '侧面', '背面', '展现力']);
    assert.equal(await references.locator('..').getAttribute('data-scheme-column'), 'right');
    const columnPositions = await first().locator('[data-scheme-column]').evaluateAll(columns => columns.map(column => { const { x, y } = column.getBoundingClientRect(); return { x, y }; }));
    assert.ok(columnPositions[0].x < columnPositions[1].x && Math.abs(columnPositions[0].y - columnPositions[1].y) < 2);
    await page.screenshot({ path: fileURLToPath(new URL(`./main-references-${width}.png`, import.meta.url)) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await references.evaluate(element => element.scrollWidth <= element.clientWidth), true);
  await page.setViewportSize({ width: 1600, height: 1200 });
  assert.equal(await sceneField().locator('.ant-image').count(), 1, 'legacy single scene remains visible');
  assert.equal(await sceneField().locator('[data-workflow-add] input[type=file]').getAttribute('multiple'), '');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=', 'base64');
  await sceneField().locator('[data-workflow-add] input[type=file]').setInputFiles([1, 2].map(i => ({ name: `scene-${i}.png`, mimeType: 'image/png', buffer: png })));
  await sceneField().locator('img[src="https://example.test/uploaded-scene-2.png"]').waitFor();
  assert.equal(await sceneField().locator('.ant-image').count(), 3, 'batch upload appends to existing scenes');
  assert.equal(await sceneField().getByRole('link', { name: '查看原图', exact: true }).first().getAttribute('href'), image('scene').originalUrl);
  assert.equal(await sceneField().getByRole('button', { name: '移除图片', exact: true }).first().innerText(), '');
  assert.equal(await sceneField().getByRole('button', { name: '替换图片', exact: true }).first().innerText(), '');
  await sceneField().locator('[data-image-action=replace] input[type=file]').nth(1).setInputFiles({ name: 'scene-replacement.png', mimeType: 'image/png', buffer: png });
  await sceneField().locator('img[src="https://example.test/uploaded-scene-3.png"]').waitFor();
  assert.deepEqual(await sceneField().locator('img').evaluateAll(images => images.map(image => image.src)), ['scene', 'uploaded-scene-3', 'uploaded-scene-2'].map(name => image(name).originalUrl), 'replace changes one image and preserves sibling scenes');
  await ctx.click('从图库选择', sceneField());
  await ctx.dialog().getByText('测试场景', { exact: true }).click();
  await ctx.click('选用图片', ctx.dialog());
  await sceneField().locator('img[src="https://example.test/library-scene.png"]').waitFor();
  assert.equal(await sceneField().locator('.ant-image').count(), 4, 'library selection appends without replacing');
  await sceneField().getByRole('button', { name: '移除图片', exact: true }).nth(1).click();
  assert.equal(await sceneField().locator('.ant-image').count(), 3);
  const sceneUrls = ['scene', 'uploaded-scene-2', 'library-scene'].map(name => image(name).originalUrl);
  assert.equal(page.url(), listUrl);
  assert.equal(await cards().count(), 2);
  assert.equal(await first().getByPlaceholder('请输入方案款号').isDisabled(), true);
  assert.equal(await first().locator('[data-clothing=main]').count(), 1);
  assert.equal(await modal().getByRole('button', { name: '添加搭配方案' }).count(), 0);
  await modal().locator('textarea').fill('弹窗编辑备注');

  await ctx.click('添加辅服饰图', first());
  await ctx.dialog().getByPlaceholder('输入款号筛选现有款式').fill('QA-AUX');
  await ctx.click('添加搭配服饰', ctx.dialog());
  assert.equal(await modal().getByRole('button', { name: 'Close', exact: true }).count(), 0);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 2);
  await ctx.click('完成选择', ctx.dialog());
  await modal().getByRole('button', { name: 'Close', exact: true }).waitFor();
  failSave = true;
  await ctx.click('保存方案', modal());
  await page.getByText('模拟保存失败', { exact: true }).waitFor();
  assert.equal(await modal().locator('textarea').inputValue(), '弹窗编辑备注');
  assert.equal(await first().locator('[data-clothing=companion]').count(), 1);
  failSave = false;
  await ctx.click('保存方案', modal());
  await page.getByText('搭配方案已保存', { exact: true }).last().waitFor();
  assert.equal(page.url(), listUrl);
  assert.equal(await modal().locator('textarea').inputValue(), '弹窗编辑备注');
  const payload = calls.findLast(call => call.endpoint === 'aiMatchingScheme/save').body;
  assert.equal(payload.status, 0);
  assert.equal(payload.remarkInfoVO.contentText, '弹窗编辑备注');
  assert.equal(payload.schemes[0].clothingProductUrls[1].styleNo, 'QA-AUX');
  assert.deepEqual(payload.schemes[0].sceneImageUrls.map(image => image.originalUrl), sceneUrls);

  await ctx.click('提交方案', modal());
  await Promise.all([page.waitForRequest(r => r.url().endsWith('/aiMatchingScheme/save')), ctx.confirm()]);
  await page.evaluate(async () => { await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/generation/image'); });
  await page.getByText('正在处理搭配方案，请完成后再切换页面', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await modal().getByRole('button', { name: 'Close', exact: true }).count(), 0);
  assert.equal(page.url(), listUrl);
  release(); release = undefined;
  await modal().waitFor({ state: 'hidden' });
  await ctx.row('QA-MODAL').waitFor({ state: 'hidden' });
  assert.equal(page.url(), listUrl);
  assert.equal(calls.findLast(call => call.endpoint === 'aiMatchingScheme/save').body.status, 1);

  visible = true;
  await ctx.click(/^刷\s*新$/);
  await open();
  assert.deepEqual(await sceneField().locator('img').evaluateAll(images => images.map(image => image.src)), sceneUrls, 'all saved scenes survive reload');
  // Reassignment/flow change between opening and save must block writes, retaining the dialog.
  task.currentNodeTaskId = 'changed-node';
  const before = count('aiMatchingScheme/save');
  await ctx.click('保存方案', modal());
  await modal().getByText('任务状态或节点已变化，请关闭窗口并刷新列表后重试', { exact: true }).waitFor();
  assert.equal(count('aiMatchingScheme/save'), before);
  await close();

  task.flowStatus = task.currentNodeStatus = 4;
  await ctx.click(/^刷\s*新$/);
  await open();
  assert.equal(await modal().getByRole('button', { name: '保存方案', exact: true }).count(), 0);
  assert.equal(await modal().getByRole('button', { name: '添加辅服饰图', exact: true }).count(), 0);
  await close();

  // If the scope has changed after list fetch, never request materials or details.
  visible = false;
  const materialBefore = count('aiMatchingScheme/list');
  const detailBefore = count('newProductTask/get/88');
  await ctx.click(/^查\s*看$/, ctx.row('QA-MODAL'));
  await page.getByText('任务已流转、未分配给你或不属于当前环节，请关闭窗口并刷新列表', { exact: true }).waitFor();
  assert.equal(count('aiMatchingScheme/list'), materialBefore);
  assert.equal(count('newProductTask/get/88'), detailBefore);
  await ctx.finish();
  await fs.writeFile(new URL('./result.json', import.meta.url), JSON.stringify({ mode: 'mock-browser', verified: ['incomplete schemes save as drafts without required validation', 'incomplete submit blocked without API write', 'draft save clears prior required errors', 'list submit opens modal without changing URL', 'source schemes and immutable main clothing preserved', 'nested picker locks outer close', 'save failure retains edits', 'save success retains modal and remark', 'submit locks navigation and close, then closes and refreshes list', 'changed node blocks writes', 'frozen task readonly', 'scope rechecked before loading materials'], calls, runtimeErrors: ctx.state.errors }, null, 2));
  console.log('PASS matching scheme submit modal');
} catch (error) {
  if (release) release();
  console.error(ctx.state.errors);
  await ctx.browser.close();
  throw error;
}
