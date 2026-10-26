import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';

const ctx = await setup();
const { page } = ctx;
const image = name => ({ originalUrl: `https://example.test/${name}.png`, previewUrl: `https://example.test/${name}-preview.png`, thumbnailUrl: `https://example.test/${name}-thumb.png` });
const task = { id: 88, styleNo: 'QA-MAIN', procInstId: 'qa-style-proc', currentNodeKey: 'aiMatchingOutput', currentNodeName: 'AI搭配方案输出', currentNodeTaskId: '9007199254740993888', currentNodeAssigneeId: '1', currentNodeStatus: 2, flowStatus: 2 };
const main = { id: '9007199254740993001', styleNo: 'QA-MAIN', styleName: '红色', clothingProductUrl: image('main') };
const remote = { id: '9007199254740993002', styleNo: 'REMOTE-AX23', styleName: '蓝色', clothingProductUrl: image('remote'), aiModelImageUrls: JSON.stringify([image('model-output')]), aiActionImageUrls: [image('model-output'), image('action-output')] };
const availabilityCases = [
  { id: 'case-model', styleNo: 'MODEL-ONLY', styleName: '蓝色', clothingProductUrl: image('model-only-clothing'), aiModelImageUrls: [image('model-only-output')], aiActionImageUrls: null, visible: true },
  { id: 'case-action', styleNo: 'ACTION-ONLY', styleName: '蓝色', clothingProductUrl: image('action-only-clothing'), aiModelImageUrls: [], aiActionImageUrls: JSON.stringify([image('action-only-output')]), visible: true },
  { id: 'case-empty', styleNo: 'EMPTY-IMAGES', styleName: '蓝色', clothingProductUrl: image('empty-clothing'), aiModelImageUrls: [], aiActionImageUrls: 'null', visible: false },
  { id: 'case-missing', styleNo: 'MISSING-IMAGES', styleName: '蓝色', clothingProductUrl: image('missing-fields-clothing'), visible: false },
];
const alias = { ...remote, id: '9007199254740993003', styleNo: 'REMOTE-ALIAS' };
const missing = { id: '9007199254740993004', styleNo: 'REMOTE-MISSING', styleName: '黑色', clothingProductUrl: null };
const calls = [];
const held = new Map();
let draftJson = null;
let failQuery = true;
let applyMode = '';
await page.route('**/admin-api/system/user/simple-list', route => route.fulfill({ json: { code: 0, data: [] } }));
await page.route('**/admin-api/flycowerp/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const endpoint = url.pathname.split('/flycowerp/')[1];
  const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null;
  calls.push({ endpoint, method: request.method(), body, query: Object.fromEntries(url.searchParams) });
  let data;
  if (endpoint === 'newProductTask/page') data = { list: [task], total: 1 };
  else if (endpoint === 'newProductTask/get/88') data = task;
  else if (endpoint === 'newProductStyle/list') data = [main];
  else if (endpoint === 'aiMatchingScheme/list') data = [];
  else if (endpoint === 'flow/draft/get') data = draftJson;
  else if (endpoint === 'flow/draft/save') {
    assert.equal(body.nodeTaskId, task.currentNodeTaskId);
    draftJson = body.formDataJson;
    data = '9007199254740993999';
  } else if (endpoint === 'newProductStyle/queryMatchStyleList') {
    assert.equal(request.method(), 'GET');
    assert.deepEqual(Object.keys(Object.fromEntries(url.searchParams)), ['styleNo']);
    const text = url.searchParams.get('styleNo');
    assert.ok(text !== null && text === text.trim());
    if (text === remote.styleNo && applyMode === 'fail') return route.fulfill({ json: { code: 500, msg: '模拟复用失败，请重试' } });
    if (text === remote.styleNo && applyMode === 'mismatch') return route.fulfill({ json: { code: 0, data: [alias] } });
    if (text === 'FAIL' && failQuery) return route.fulfill({ json: { code: 500, msg: '模拟款号查询失败' } });
    if (text === 'OLD' || text === 'CLOSE') {
      await new Promise(resolve => held.set(text, resolve));
      data = [{ ...remote, styleNo: `${text}-RESULT` }];
    } else if (text === 'EMPTY') data = [];
    else if (text === 'BAD') data = { unexpected: true };
    else if (text === 'NEW') data = [{ ...remote, styleNo: 'NEW-RESULT' }];
    else data = [remote, alias, main, missing, ...availabilityCases];
  } else throw new Error(`Unexpected API: ${endpoint}`);
  await route.fulfill({ json: { code: 0, data } });
});
const modal = () => page.getByRole('dialog').filter({ has: page.getByText('任务款号：QA-MAIN', { exact: false }) });
const picker = () => page.getByRole('dialog', { name: '按款号添加辅服饰图', exact: true });
const search = () => picker().getByPlaceholder('输入款号模糊查询服饰图片');
// The scheme also reads its own AI history when opening; isolate picker queries.
const queryCalls = () => calls.filter(call => call.endpoint === 'newProductStyle/queryMatchStyleList' && call.query.styleNo !== main.styleNo);
const row = (styleNo, styleName = '蓝色') => picker().getByText(`${styleNo} · ${styleName}`, { exact: true }).locator('..');
async function openTask() {
  await ctx.click(/^提\s*交$/, ctx.row('QA-MAIN'));
  await modal().locator('[data-clothing=main]').waitFor();
}
async function openPicker() { await ctx.click('添加辅服饰图', modal()); await search().waitFor(); await row(remote.styleNo).waitFor(); }
async function closePicker() { await ctx.click('完成选择', picker()); await picker().waitFor({ state: 'hidden' }); }
async function waitHeld(text) {
  for (let i = 0; i < 40 && !held.has(text); i++) await page.waitForTimeout(25);
  assert.ok(held.has(text));
}
try {
  await ctx.navigate('/drawing/aiMatchingOutput');
  await openTask();
  await openPicker();
  assert.deepEqual(queryCalls().map(call => call.query.styleNo), ['']);
  await search().fill('C');
  await page.waitForTimeout(30);
  await search().fill('Co');
  await page.waitForTimeout(30);
  await search().fill(' Coat ');
  await row(remote.styleNo).waitFor();
  assert.deepEqual(queryCalls().map(call => call.query.styleNo), ['', 'Coat']);
  assert.equal(await row(missing.styleNo, '黑色').getByRole('button', { name: '暂无服饰图', exact: true }).isDisabled(), true);
  assert.equal(await row(main.styleNo, '红色').getByRole('button', { name: '已添加', exact: true }).isDisabled(), true);
  await ctx.click('添加搭配服饰', row(remote.styleNo));
  await modal().locator('[data-clothing=companion] img[src*="remote-thumb"]').waitFor();
  await modal().locator('[data-clothing=companion]').getByText('已用AI方案生过图片', { exact: true }).waitFor();
  assert.equal(await row(alias.styleNo).getByRole('button', { name: '已添加', exact: true }).isDisabled(), true);
  assert.equal(await modal().locator('[data-clothing=main]').count(), 1);
  assert.equal(await modal().locator('[data-clothing=companion]').count(), 1);
  await page.screenshot({ path: fileURLToPath(new URL('./picker.png', import.meta.url)) });
  const beforeClear = queryCalls().length;
  await search().fill('  ');
  await row(remote.styleNo).waitFor();
  await page.waitForTimeout(350);
  assert.equal(queryCalls().length, beforeClear + 1);
  assert.equal(queryCalls().at(-1).query.styleNo, '');
  await search().fill('Coat');
  await row(remote.styleNo).waitFor();
  await search().fill('');
  await row(remote.styleNo).waitFor();
  assert.equal(queryCalls().at(-1).query.styleNo, '');
  await search().fill('EMPTY');
  await picker().getByText('没有匹配的服饰款式', { exact: true }).waitFor();
  await search().fill('FAIL');
  await picker().getByRole('button', { name: '重试查询', exact: true }).waitFor();
  assert.equal(await picker().getByText('没有匹配的服饰款式', { exact: true }).count(), 0);
  failQuery = false;
  await ctx.click('重试查询', picker());
  await row(remote.styleNo).waitFor();
  await search().fill('BAD');
  await picker().getByText('服饰款式列表格式不正确', { exact: true }).waitFor();
  await search().fill('OLD');
  await waitHeld('OLD');
  await search().fill('NEW');
  await row('NEW-RESULT').waitFor();
  const oldResponse = page.waitForResponse(response => response.url().endsWith('styleNo=OLD'));
  held.get('OLD')(); held.delete('OLD');
  await oldResponse;
  await page.waitForTimeout(100);
  assert.equal(await row('OLD-RESULT').count(), 0);
  await row('NEW-RESULT').waitFor();
  await search().fill('CLOSE');
  await waitHeld('CLOSE');
  await closePicker();
  await openPicker();
  assert.equal(queryCalls().at(-1).query.styleNo, '');
  const closedResponse = page.waitForResponse(response => response.url().endsWith('styleNo=CLOSE'));
  held.get('CLOSE')(); held.delete('CLOSE');
  await closedResponse;
  await page.waitForTimeout(100);
  assert.equal(await row('CLOSE-RESULT').count(), 0);
  assert.equal(await search().inputValue(), '');
  const beforeEnter = queryCalls().length;
  await search().fill('FAST');
  await search().press('Enter');
  await row(remote.styleNo).waitFor();
  await page.waitForTimeout(350);
  assert.equal(queryCalls().length, beforeEnter + 1);
  await closePicker();
  const apply = () => modal().getByRole('button', { name: '应用AI搭配方案', exact: true });
  for (const style of availabilityCases) {
    await openPicker();
    await ctx.click('添加搭配服饰', row(style.styleNo));
    await closePicker();
    const companion = modal().locator('[data-clothing=companion]').filter({ has: page.getByText(`搭配服饰 · ${style.styleNo}`, { exact: true }) });
    await companion.waitFor();
    assert.equal(await companion.getByRole('button', { name: '应用AI搭配方案', exact: true }).count(), style.visible ? 1 : 0);
    await companion.getByRole('button', { name: '移除搭配服饰 2', exact: true }).click();
    await companion.waitFor({ state: 'hidden' });
  }
  const generated = () => modal().locator('.ant-form-item').filter({ has: page.locator('label', { hasText: /^AI生成图片$/ }) });
  assert.equal(await apply().count(), 1);
  applyMode = 'fail';
  await apply().click();
  await page.getByText('模拟复用失败，请重试', { exact: true }).waitFor();
  assert.equal(await generated().locator('img').count(), 0);
  applyMode = 'mismatch';
  await apply().click();
  await page.getByText('未找到唯一匹配的辅服饰款式，请重新选择', { exact: true }).waitFor();
  assert.equal(await generated().locator('img').count(), 0);
  applyMode = '';
  await apply().click();
  await generated().locator('img[src*="model-output-thumb"]').waitFor();
  await generated().locator('img[src*="action-output-thumb"]').waitFor();
  assert.equal(await generated().locator('.ant-image-img').count(), 2);
  assert.equal(queryCalls().at(-1).query.styleNo, remote.styleNo);
  await apply().click();
  await page.getByText('没有可补充的空白图片位置，已有内容已保留', { exact: true }).waitFor();
  assert.equal(await generated().locator('.ant-image-img').count(), 2);
  await ctx.click('保存方案', modal());
  await page.getByText('搭配方案已保存', { exact: true }).waitFor();
  const saved = JSON.parse(draftJson);
  assert.equal(saved.schemes.length, 1);
  assert.deepEqual(saved.schemes[0].clothingProductUrls.map(img => [img.styleNo, img.isMain]), [[main.styleNo, 1], [remote.styleNo, 0]]);
  assert.deepEqual(saved.schemes[0].clothingProductUrls[1], { ...remote.clothingProductUrl, styleNo: remote.styleNo, isMain: 0 });
  assert.deepEqual(saved.schemes[0].aiGeneratedImageUrls, ['model-output', 'action-output'].map(name => ({ ...image(name), styleNo: remote.styleNo, isMain: 0 })));
  await modal().getByRole('button', { name: 'Close', exact: true }).click();
  await modal().waitFor({ state: 'hidden' });
  await openTask();
  await modal().locator('[data-clothing=companion] img[src*="remote-thumb"]').waitFor();
  await modal().locator('[data-clothing=companion]').getByText('已用AI方案生过图片', { exact: true }).waitFor();
  assert.equal(await modal().locator('[data-clothing=main]').count(), 1);
  await generated().locator('img[src*="action-output-thumb"]').waitFor();
  assert.equal(await generated().locator('.ant-image-img').count(), 2);
  await ctx.finish();
  await fs.writeFile(new URL('./result.json', import.meta.url), JSON.stringify({ mode: 'mock-browser', verified: ['GET queryMatchStyleList with trimmed styleNo and no taskId', 'debounced typing and immediate Enter without duplicate request', 'server fuzzy matches displayed even when not in task styles or containing the literal search term', 'all three clothing image URLs retained and remote styleNo added with isMain=0', 'unique source main stays locked, missing-image and duplicate candidates cannot be added', 'opening, reopening, whitespace and cleared input query with empty styleNo and display candidates', 'no-result, error/retry and malformed response states', 'slow stale responses and closed-picker responses cannot replace current results', 'remote companions survive flow draft save and reopen'], calls, runtimeErrors: ctx.state.errors }, null, 2));
  console.log('PASS remote fuzzy companion clothing search');
} catch (error) {
  for (const release of held.values()) release();
  console.error(ctx.state.errors);
  await page.screenshot({ path: fileURLToPath(new URL('./failure.png', import.meta.url)), fullPage: true });
  await ctx.browser.close();
  throw error;
}
