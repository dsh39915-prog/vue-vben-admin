import fs from 'node:fs/promises';
import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';

const ctx = await setup({ permissions: ['flycowerp:drawing:aiMatchingAudit'], userId: 7, roles: [] });
const { page } = ctx;
const calls = [];
const image = name => ({ imageId: name, originalUrl: `https://example.test/${name}.png`, previewUrl: `https://example.test/${name}-preview.png`, thumbnailUrl: `https://example.test/${name}-thumb.png` });
const task = { id: 88, styleNo: 'QA-AUDIT', procInstId: 'qa-audit-proc', currentNodeKey: 'aiMatchingAudit', currentNodeName: 'AI搭配方案审核', currentNodeTaskId: '9007199254740993123', currentNodeAssigneeId: '7', currentNodeStatus: 2, flowStatus: 2 };
const scheme = { id: '9007199254740993100', styleNo: 'QA-MAIN', styleName: '红色', hasOtherStyle: false, aiMatchingImageUrl: JSON.stringify(image('matching')), clothingProductUrls: [{ ...image('main'), styleNo: 'QA-MAIN', isMain: 1 }, { ...image('aux'), styleNo: 'QA-AUX', isMain: 0 }], propImageUrls: image('prop'), modelImageUrls: image('model'), sceneImageUrls: image('scene'), mainReferenceFrontUrl: image('front'), mainReferenceSideUrl: image('side'), mainReferenceBackUrl: image('back'), otherReferenceUrls: [image('other')] };
let saved = [scheme];
let visible = true;
let materialError = false;
let auditMode = 'false';
let release;
await page.route('https://example.test/**', route => {
  const [width, height] = route.request().url().includes('front') ? [80, 160] : route.request().url().includes('side') ? [160, 80] : [80, 80];
  return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 80 80"><rect width="80" height="80" rx="5" fill="#e1e9fb"/><path d="M25 20L12 32L24 42L25 65H55L56 42L68 32L55 20L47 25H33Z" fill="#6c86b9"/></svg>` });
});
await page.route('**/admin-api/flycowerp/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const endpoint = url.pathname.split('/flycowerp/')[1];
  const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null;
  calls.push({ endpoint, body, query: Object.fromEntries(url.searchParams) });
  let data;
  if (endpoint === 'newProductTask/page') {
    assert.equal(body.flowNodeKey, 'aiMatchingAudit');
    assert.equal(body.currentAssigneeId, '7');
    data = { list: visible ? [task] : [], total: visible ? 1 : 0 };
  } else if (endpoint === 'newProductTask/get/88') data = task;
  else if (endpoint === 'newProductStyle/list') data = [];
  else if (endpoint === 'aiMatchingScheme/list') {
    assert.equal(url.searchParams.get('taskId'), '88');
    if (materialError) return route.fulfill({ json: { code: 500, msg: '模拟材料加载失败', data: null } });
    data = saved;
  } else if (endpoint === 'temp-image/upload') data = image('audit-attachment');
  else if (endpoint === 'flow/audit') {
    assert.equal(request.method(), 'POST');
    assert.equal(body.procInstId, task.procInstId);
    assert.equal(body.nodeTaskId, task.currentNodeTaskId);
    assert.equal(body.nodeKey, 'aiMatchingAudit');
    if (auditMode === 'error') return route.fulfill({ json: { code: 500, msg: '模拟审核失败', data: null } });
    if (auditMode === 'pending') await new Promise(resolve => { release = resolve; });
    data = auditMode !== 'false';
    if (data) visible = false;
  } else return route.fallback();
  await route.fulfill({ json: { code: 0, data } });
});
const modal = () => page.getByRole('dialog', { name: 'AI搭配方案审核', exact: true });
const preview = () => page.getByRole('dialog', { name: '整体搭配方案预览', exact: true });
const row = () => page.locator('tr[data-row-key="88"]');
const materials = () => modal().locator('[data-audit-materials]');
const count = endpoint => calls.filter(call => call.endpoint === endpoint).length;
async function open() {
  await ctx.click(task.flowStatus === 4 ? /^查\s*看$/ : /^审\s*核$/, row());
  await modal().getByText('第1款 · QA-MAIN · 红色', { exact: true }).waitFor();
}
async function close() { await modal().getByRole('button', { name: 'Close', exact: true }).click(); await modal().waitFor({ state: 'hidden' }); }
async function refresh() { await Promise.all([page.waitForResponse(r => r.url().endsWith('/newProductTask/page')), ctx.click(/^刷\s*新$/)]); await row().waitFor(); }
try {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ctx.navigate('/drawing/aiMatchingAudit');
  const listUrl = page.url();
  await open();
  assert.equal(page.url(), listUrl);
  assert.equal(await materials().locator('input, textarea, select').count(), 0, 'submitted scheme identity and images are read-only');
  assert.equal(await modal().getByText('主服饰', { exact: true }).count(), 1);
  assert.equal(await modal().getByText('搭配服饰', { exact: true }).count(), 1);
  for (const key of ['aiMatchingImageUrl', 'clothingProductUrls', 'propImageUrls', 'modelImageUrls', 'sceneImageUrls', 'mainReferences', 'otherReferenceUrls']) await modal().locator(`[data-material="${key}"]`).waitFor();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(viewport);
    const footer = await modal().locator('.ant-modal-footer').boundingBox();
    assert.ok(footer.y >= 0 && footer.y + footer.height <= viewport.height, 'decision buttons remain visible on screen');
    const opinion = await modal().getByPlaceholder('请输入审核意见').boundingBox();
    assert.ok(opinion.y >= 0 && opinion.y + opinion.height < footer.y);
    assert.equal(await modal().locator('.ant-modal-body').evaluate(el => el.scrollHeight <= el.clientHeight + 1), true, 'only materials may scroll');
    await page.screenshot({ path: new URL(`./audit-${viewport.width}.png`, import.meta.url).pathname.replace(/^\/(.:)/, '$1') });
    const size = await materials().evaluate(el => ({ scroll: el.scrollHeight, client: el.clientHeight }));
    assert.ok(size.scroll <= size.client + 1, `reference-sized common scheme fits one screen at ${viewport.width}: ${JSON.stringify(size)}`);
  }
  await modal().getByPlaceholder('请输入审核意见').fill('预览期间保留意见');
  const beforePreview = calls.length;
  await ctx.click('整体搭配方案预览', modal());
  await preview().getByText('QA-MAIN · 红色', { exact: true }).waitFor();
  for (const label of ['服饰与道具', '款式信息', '场景与模特', '主参考图', '其他参考图']) {
    await preview().getByRole('region', { name: label, exact: true }).waitFor();
  }
  const [left, right] = await preview().locator('[data-preview-column]').evaluateAll(columns => columns.map(column => { const { x, y } = column.getBoundingClientRect(); return { x, y }; }));
  assert.ok(left.x < right.x && Math.abs(left.y - right.y) < 2, 'desktop preview uses two columns');
  for (const label of ['正面', '侧面', '背面']) await preview().locator(`img[alt="${label}"]`).waitFor();
  assert.equal(await preview().locator('figcaption').count(), 0, 'images have no visible labels');
  assert.equal(await preview().getByText('未提供', { exact: true }).count(), 0, 'missing images have no placeholders');
  assert.equal(await preview().locator('img[alt="展现力"], img[alt="全身参考图"], img[alt="光线参考图"], img[alt="版型参考图"]').count(), 0);
  for (const label of ['正面', '侧面']) {
    const size = await preview().locator(`img[alt="${label}"]`).evaluate(async img => {
      await img.decode();
      const style = getComputedStyle(img);
      return { width: parseFloat(style.width), height: parseFloat(style.height), ratio: img.naturalHeight / img.naturalWidth };
    });
    assert.equal(size.width, 120, 'preview images use fixed width');
    assert.ok(Math.abs(size.height - size.width * size.ratio) < 1, 'portrait and landscape images preserve aspect ratio');
  }
  const environment = await preview().locator('[data-preview-environment] > div').evaluateAll(columns => columns.map(column => { const { x, y } = column.getBoundingClientRect(); return { x, y }; }));
  assert.ok(environment[0].x < environment[1].x && Math.abs(environment[0].y - environment[1].y) < 2, 'scene and model columns align at the top');
  await preview().locator('.ant-image').filter({ has: page.locator('img[alt="正面"]') }).click();
  await page.locator('.ant-image-preview-wrap').waitFor();
  assert.equal(await page.locator('.ant-image-preview-img').getAttribute('src'), image('front').previewUrl);
  await page.locator('.ant-image-preview-operations-operation').first().click();
  await page.locator('.ant-image-preview-wrap').waitFor({ state: 'hidden' });
  assert.equal(await preview().count(), 1, 'closing image preserves overall preview');
  await page.screenshot({ path: new URL('./overall-preview-1366.png', import.meta.url).pathname.replace(/^\/(.:)/, '$1') });
  await page.keyboard.press('Escape');
  await preview().waitFor({ state: 'hidden' });
  assert.equal(await modal().getByPlaceholder('请输入审核意见').inputValue(), '预览期间保留意见');
  assert.equal(calls.length, beforePreview, 'preview reads current materials without API calls');
  await modal().getByPlaceholder('请输入审核意见').fill('');
  await materials().locator('.ant-image').first().click();
  await page.locator('.ant-image-preview-wrap').waitFor();
  assert.equal(await page.locator('.ant-image-preview-img').getAttribute('src'), image('matching').previewUrl);
  await page.locator('.ant-image-preview-operations-operation').first().click();
  await page.locator('.ant-image-preview-wrap').waitFor({ state: 'hidden' });
  await ctx.click(/^通\s*过$/, modal());
  await modal().getByText('请填写审核意见', { exact: true }).waitFor();
  assert.equal(count('flow/audit'), 0);
  await modal().getByPlaceholder('请输入审核意见').fill('  审核同意  ');
  await ctx.click(/^通\s*过$/, modal());
  await page.getByText('审核未成功，请重试', { exact: true }).waitFor();
  assert.equal(await modal().getByPlaceholder('请输入审核意见').inputValue(), '  审核同意  ');
  auditMode = 'error';
  await ctx.click(/^驳\s*回$/, modal());
  await page.getByText('模拟审核失败', { exact: true }).waitFor();
  assert.equal(await modal().getByPlaceholder('请输入审核意见').inputValue(), '  审核同意  ');
  await modal().locator('summary').click();
  const file = { name: 'audit.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=', 'base64') };
  await modal().locator('input[type=file]').setInputFiles(file);
  await modal().locator('img[src="https://example.test/audit-attachment-thumb.png"]').waitFor();
  await modal().locator('summary').click();
  auditMode = 'pending';
  await Promise.all([page.waitForRequest(r => r.url().endsWith('/flow/audit')), ctx.click(/^通\s*过$/, modal())]);
  assert.equal(await modal().getByRole('button', { name: /^取\s*消$/ }).isDisabled(), true);
  assert.equal(await modal().getByRole('button', { name: 'Close', exact: true }).count(), 0);
  await page.keyboard.press('Escape');
  await page.evaluate(async () => { await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/generation/image'); });
  await page.getByText('正在提交搭配方案审核，请完成后再切换页面', { exact: true }).waitFor();
  assert.equal(page.url(), listUrl);
  const pass = calls.findLast(call => call.endpoint === 'flow/audit').body;
  assert.deepEqual(pass.auditInfoVO, { auditStatus: 1, contentText: '审核同意', imageUrls: [image('audit-attachment')] });
  release(); release = undefined;
  await modal().waitFor({ state: 'hidden' });
  await row().waitFor({ state: 'hidden' });

  visible = true;
  await refresh(); await open();
  await modal().getByPlaceholder('请输入审核意见').fill('请调整搭配');
  auditMode = 'success';
  await ctx.click(/^驳\s*回$/, modal());
  await modal().waitFor({ state: 'hidden' });
  await row().waitFor({ state: 'hidden' });
  assert.equal(calls.findLast(call => call.endpoint === 'flow/audit').body.auditInfoVO.auditStatus, 2);

  visible = true;
  await refresh(); await open();
  await modal().getByPlaceholder('请输入审核意见').fill('保留意见');
  task.currentNodeTaskId = 'changed-node';
  const before = count('flow/audit');
  await ctx.click(/^通\s*过$/, modal());
  await modal().getByText('任务状态或节点已变化，请关闭窗口并刷新列表后重试', { exact: true }).waitFor();
  assert.equal(count('flow/audit'), before);
  assert.equal(await modal().getByPlaceholder('请输入审核意见').inputValue(), '保留意见');
  await close();

  // Extra supplied materials stay visible, with only one expanded style at a time.
  saved = [{ ...scheme, sceneImageUrls: [image('scene'), image('scene2')], mainReferenceVisionUrl: image('vision'), fullBodyReferenceUrls: [image('full'), image('full2')], lightReferenceUrl: image('light'), versionReferenceUrl: image('version'), aiGeneratedImageUrls: [image('generated')] }, { ...scheme, id: 'scheme2', styleName: '蓝色' }];
  await refresh(); await open();
  for (const key of ['fullBodyReferenceUrls', 'lightReferenceUrl', 'versionReferenceUrl', 'aiGeneratedImageUrls']) assert.equal(await modal().locator(`[data-material="${key}"]`).count(), 1);
  await ctx.click('整体搭配方案预览', modal());
  assert.equal(await preview().getByRole('region', { name: '场景与模特' }).locator('img').count(), 3);
  for (const label of ['展现力', '全身参考图1', '全身参考图2', '光线参考图', '版型参考图']) await preview().locator(`img[alt="${label}"]`).waitFor();
  await preview().getByText('方案成图', { exact: true }).click();
  await preview().locator('img[alt="AI搭配方案图"]').waitFor();
  await preview().locator('img[alt="AI生成图片1"]').waitFor();
  await page.screenshot({ path: new URL('./overall-preview-full-1366.png', import.meta.url).pathname.replace(/^\/(.:)/, '$1') });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await preview().locator('.ant-modal-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  const mobileEnvironment = await preview().locator('[data-preview-environment] > div').evaluateAll(columns => columns.map(column => { const { x, y } = column.getBoundingClientRect(); return { x, y }; }));
  assert.ok(mobileEnvironment[0].x < mobileEnvironment[1].x && Math.abs(mobileEnvironment[0].y - mobileEnvironment[1].y) < 2);
  await preview().getByRole('button', { name: 'Close', exact: true }).click();
  await preview().waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 1366, height: 768 });
  await modal().getByText('第2款 · QA-MAIN · 蓝色', { exact: true }).click();
  assert.equal(await modal().locator('.ant-collapse-item-active').count(), 1);
  await modal().locator('.ant-collapse-item-active').getByRole('button', { name: '整体搭配方案预览', exact: true }).click();
  await preview().getByText('QA-MAIN · 蓝色', { exact: true }).waitFor();
  await preview().getByRole('button', { name: 'Close', exact: true }).click();
  await preview().waitFor({ state: 'hidden' });
  await close();

  materialError = true;
  await ctx.click(/^审\s*核$/, row());
  await modal().getByText('模拟材料加载失败', { exact: true }).count();
  await modal().getByRole('button', { name: /^重\s*试$/ }).waitFor();
  materialError = false;
  await ctx.click(/^重\s*试$/, modal());
  await modal().getByText('第1款 · QA-MAIN · 红色', { exact: true }).waitFor();
  await close();

  task.flowStatus = task.currentNodeStatus = 4;
  await refresh(); await open();
  assert.equal(await modal().getByRole('button', { name: /^通\s*过$/ }).count(), 0);
  assert.equal(await modal().getByRole('button', { name: /^驳\s*回$/ }).count(), 0);
  await close();
  // A stale list row must not allow material access after reassignment.
  task.currentNodeAssigneeId = '9';
  const readsBefore = count('aiMatchingScheme/list');
  await ctx.click(/^查\s*看$/, row());
  await modal().getByText('任务筛选结果异常，请刷新后重试', { exact: true }).waitFor();
  assert.equal(count('aiMatchingScheme/list'), readsBefore);
  await close();
  task.currentNodeAssigneeId = '7';
  task.flowStatus = task.currentNodeStatus = 2;
  await ctx.navigate('/drawing/aiMatchingAudit?taskId=88');
  await ctx.click('审核任务');
  await modal().getByText('第1款 · QA-MAIN · 红色', { exact: true }).waitFor();
  assert.equal(await materials().locator('input, textarea, select').count(), 0);
  await close();
  await ctx.finish();
  await fs.writeFile(new URL('./result.json', import.meta.url), JSON.stringify({ mode: 'mock-browser', verified: ['employee-scoped list opens readonly materials in modal without URL changes', 'common scheme fits one screen at 1440x900; fixed opinion/footer at 1366x768', 'all supplied material fields and main/companion distinction', 'accordion styles and image previews', 'required opinion, pass=1/reject=2, trimmed opinion and attachments', 'false/error retains input; pending close/navigation locks', 'success closes and refreshes list', 'stale node blocks write; frozen readonly; reassignment blocks material reads', 'material load failure and retry'], calls, runtimeErrors: ctx.state.errors }, null, 2));
  console.log('PASS compact scoped matching audit modal');
} catch (error) {
  if (release) release();
  await page.screenshot({ path: new URL('./failure.png', import.meta.url).pathname.replace(/^\/(.:)/, '$1') });
  console.error(ctx.state.errors);
  await ctx.browser.close();
  throw error;
}
