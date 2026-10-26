import fs from 'node:fs/promises';
import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';

const ctx = await setup({ permissions: ['flycowerp:drawing:pageProduction'], userId: 7, roles: [] });
const { page } = ctx;
const task = { id: 88, styleNo: 'QA-PAGE', procInstId: 'qa-page', currentNodeKey: 'pageProduction', currentNodeTaskId: '9007199254740993123', currentNodeAssigneeId: '7', currentNodeStatus: 2, flowStatus: 2 };
const styles = [0, 1].map(i => ({ id: `900719925474099310${i}`, styleNo: `QA-PAGE-${i}`, styleName: `款式${i}` }));
const image = id => ({ imageId: String(id), originalUrl: `https://example.test/${id}.png`, previewUrl: `https://example.test/p${id}.png`, thumbnailUrl: `https://example.test/t${id}.png` });
const calls = [];
let draft = null;
let serial = 0;
let failDraft = false;
let failSubmit = false;
let holdReject = false;
let failReject = false;
let storedImages = false;
let release;
await page.route('**/admin-api/flycowerp/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const endpoint = url.pathname.split('/flycowerp/')[1];
  const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null;
  calls.push({ endpoint, body });
  let data;
  if (endpoint === 'newProductTask/page') data = { list: [task], total: 1 };
  else if (endpoint === 'newProductTask/get/88') data = task;
  else if (endpoint === 'newProductStyle/list') data = styles.map((style, index) => storedImages ? {
    ...style,
    productMainImageUrls: Array.from({ length: 5 }, (_, i) => image(101 + index * 100 + i)),
    productDetailImageUrls: [image(106 + index * 100), image(107 + index * 100)],
  } : style);
  else if (['aiMatchingScheme/list', 'flow/nodeDetailList', 'flow/transferRecordList'].includes(endpoint)) data = [];
  else if (endpoint === 'temp-image/upload') data = image(++serial);
  else if (endpoint === 'flow/draft/get') {
    assert.equal(url.searchParams.get('nodeKey'), 'pageProduction');
    assert.equal(url.searchParams.get('procInstId'), task.procInstId);
    data = draft;
  } else if (endpoint === 'flow/draft/save') {
    if (failDraft) return route.fulfill({ json: { code: 500, msg: '模拟页面草稿保存失败' } });
    draft = body.formDataJson; data = 100;
  } else if (endpoint === 'newProductStyle/saveImageData') data = !failSubmit;
  else if (endpoint === 'flow/audit') {
    if (holdReject) await new Promise(resolve => { release = resolve; });
    data = !failReject;
  } else throw Error(`Unexpected API: ${endpoint}`);
  await route.fulfill({ json: { code: 0, data } });
});
const count = endpoint => calls.filter(call => call.endpoint === endpoint).length;
const last = endpoint => calls.findLast(call => call.endpoint === endpoint)?.body;
const cards = () => page.locator('.ant-tabs-tabpane-active .ant-card');
const field = (label, scope = page) => scope.locator('.ant-form-item').filter({ has: page.locator('.ant-form-item-label').filter({ hasText: label }) }).first();
const main = () => field('商品主图', cards().first());
const detail = () => field('详情页图', cards().first());
const remark = () => field('图片备注').locator('textarea');
const file = { name: 'page.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=', 'base64') };
async function upload(scope, input = 0) {
  const before = await scope.locator('.ant-image').count();
  await scope.locator('input[type=file]').nth(input).setInputFiles(file);
  await scope.locator('.ant-image').nth(before).waitFor();
}
async function navigate(query = '') {
  await ctx.navigate(`/drawing/pageProduction?taskId=88${query}`);
  await page.getByText('任务信息', { exact: true }).waitFor();
}
async function save() {
  await Promise.all([page.waitForResponse(response => response.url().endsWith('/flow/draft/save')), ctx.click('保存')]);
  await page.getByText('页面制作草稿已保存', { exact: true }).last().waitFor();
}
async function submit() { await ctx.click('提交'); await page.getByText('确认将页面制作提交到下一节点？', { exact: true }).waitFor(); await ctx.confirm(); }
async function reject() { await ctx.click('驳回'); await page.getByText('确认驳回到上一节点？', { exact: true }).waitFor(); await ctx.click('确认驳回'); }
function checkContext(payload) {
  assert.equal(payload.nodeKey, 'pageProduction');
  assert.equal(payload.nodeTaskId, task.currentNodeTaskId);
  assert.equal(payload.procInstId, task.procInstId);
}
try {
  storedImages = true;
  await navigate();
  await main().locator('.ant-image').nth(4).waitFor();
  assert.deepEqual(await main().locator('.ant-image img').evaluateAll(images => images.map(img => img.getAttribute('src'))), [101, 102, 103, 104, 105].map(id => image(id).thumbnailUrl));
  assert.equal(await detail().locator('.ant-image').count(), 2);
  for (const [scope, count] of [[main(), 5], [detail(), 2]]) {
    assert.equal(await scope.locator('button[aria-label="替换图片"]').count(), count);
    assert.equal(await scope.getByRole('button', { name: '移除图片', exact: true }).count(), count);
    assert.equal(await scope.getByRole('link', { name: '查看原图', exact: true }).count(), count);
    assert.ok((await scope.locator('button[aria-label="替换图片"]').allTextContents()).every(text => !text.trim()), 'replace uses an icon button on the thumbnail');
    assert.ok((await scope.getByRole('button', { name: '移除图片', exact: true }).allTextContents()).every(text => !text.trim()), 'remove uses an icon button on the thumbnail');
  }
  assert.equal(await main().locator('button.image-upload-trigger').count(), 0, 'filled slots use their replacement icon instead of a second upload tile');
  await cards().first().screenshot({ path: new URL('./unified-image-upload.png', import.meta.url).pathname.replace(/^\/(.:)/, '$1') });
  await save();
  assert.deepEqual(JSON.parse(draft).styles[0].mainImageSlots.map(img => img.imageId), ['101', '102', '103', '104', '105']);
  assert.deepEqual(JSON.parse(draft).styles[0].productDetailImageUrls.map(img => img.imageId), ['106', '107']);
  draft = JSON.stringify({
    version: 1, formType: 'pageProduction',
    styles: [{ styleId: styles[0].id, mainImageSlots: [null, null, image(999), null, null], productDetailImageUrls: [] }],
    remarkInfoVO: { contentText: '草稿优先', imageUrls: [] },
  });
  await navigate();
  await main().locator('.ant-image').waitFor();
  assert.equal(await main().locator('.ant-image img').getAttribute('src'), image(999).thumbnailUrl);
  assert.equal(await detail().locator('.ant-image').count(), 0, 'intentionally cleared draft images stay empty');
  assert.equal(await field('商品主图', cards().nth(1)).locator('.ant-image').count(), 5, 'styles absent from the draft use API images');
  await save();
  const restored = JSON.parse(draft);
  assert.deepEqual(restored.styles[0].mainImageSlots.map(img => img?.imageId ?? null), [null, null, '999', null, null]);
  assert.deepEqual(restored.styles[0].productDetailImageUrls, []);
  assert.equal(restored.styles[1].productDetailImageUrls.length, 2);
  storedImages = false;
  draft = null;
  await navigate();
  await page.getByRole('button', { name: '保存', exact: true }).waitFor();
  assert.equal(await cards().locator('.ant-card-head input[type=checkbox]').count(), 0);
  assert.equal(await page.getByRole('button', { name: '提交', exact: true }).isEnabled(), true);
  await save();
  checkContext(last('flow/draft/save'));
  assert.deepEqual(JSON.parse(draft).styles[0].mainImageSlots, [null, null, null, null, null]);
  assert.equal(count('newProductStyle/saveImageData'), 0);
  assert.equal(count('flow/audit'), 0);
  await ctx.click('提交');
  await page.getByText('请先上传本次提交的页面制作图片', { exact: true }).waitFor();
  await reject();
  await page.getByText('请填写驳回原因', { exact: true }).waitFor();

  await upload(main(), 2);
  await upload(detail());
  await save();
  const incomplete = draft;
  assert.equal(JSON.parse(draft).styles[0].mainImageSlots[2].imageId, '1');
  await navigate();
  await main().locator('.ant-image').waitFor();
  assert.equal(await main().locator('.ant-image').count(), 1);
  assert.equal(await main().locator('.ant-image img').getAttribute('src'), image(1).thumbnailUrl);
  await save();
  assert.deepEqual(JSON.parse(draft), JSON.parse(incomplete), 'empty main slots keep their positions');
  await ctx.click('提交');
  await page.getByText('款式0：请按顺序上传全部 5 张商品主图', { exact: true }).waitFor();
  assert.equal(count('newProductStyle/saveImageData'), 0);
  for (const slot of [0, 1, 3, 4]) await upload(main(), slot);
  await ctx.click('提交');
  await page.getByText('请填写备注说明', { exact: true }).waitFor();
  await remark().fill('  页面制作说明  ');
  await upload(field('备注附件'));
  failDraft = true;
  await ctx.click('保存');
  await page.getByText('模拟页面草稿保存失败', { exact: true }).first().waitFor();
  assert.equal(await main().locator('.ant-image').count(), 5);
  failDraft = false;
  await save();
  const complete = draft;
  await navigate();
  await main().locator('.ant-image').nth(4).waitFor();
  assert.equal(await detail().locator('.ant-image').count(), 1);
  assert.equal(await remark().inputValue(), '  页面制作说明  ');
  assert.equal(await field('备注附件').locator('.ant-image').count(), 1);

  const previousId = task.currentNodeTaskId;
  task.currentNodeTaskId = 'changed';
  await ctx.click('保存');
  await page.getByText('任务状态或节点已变化，请刷新任务后重试', { exact: true }).waitFor();
  assert.equal(draft, complete);
  await submit();
  await page.getByText('任务状态或节点已变化，请刷新任务后重试', { exact: true }).first().waitFor();
  await reject();
  await page.getByText('任务状态或节点已变化，请刷新任务后重试', { exact: true }).first().waitFor();
  assert.equal(count('newProductStyle/saveImageData'), 0);
  assert.equal(count('flow/audit'), 0);
  task.currentNodeTaskId = previousId;
  failSubmit = true;
  await submit();
  await page.getByText('页面制作未提交成功，请重试', { exact: true }).waitFor();
  assert.equal(await main().locator('.ant-image').count(), 5);
  const payload = last('newProductStyle/saveImageData');
  checkContext(payload);
  assert.equal(payload.items.length, 1, 'untouched styles are skipped');
  assert.equal(payload.items[0].styleId, styles[0].id);
  assert.deepEqual(payload.items[0].productMainImageUrls.map(img => img.imageId), ['3', '4', '1', '5', '6']);
  assert.equal(payload.items[0].productDetailImageUrls[0].imageId, '2');
  assert.equal(payload.remarkInfoVO.contentText, '页面制作说明');
  assert.equal(payload.remarkInfoVO.imageUrls.length, 1);
  assert.equal(payload.items[0].retouchedModelImageUrls, undefined);
  failSubmit = false;
  await submit();
  await page.getByText('页面制作已提交', { exact: true }).waitFor();

  draft = null;
  await navigate();
  await remark().fill('  请上一节点重新处理  ');
  failReject = true;
  await reject();
  await page.getByText('驳回未成功，请重试', { exact: true }).waitFor();
  assert.equal(await remark().inputValue(), '  请上一节点重新处理  ');
  failReject = false; holdReject = true;
  const requested = page.waitForRequest(request => request.url().endsWith('/flow/audit'));
  await reject(); await requested;
  const submitsBefore = count('newProductStyle/saveImageData');
  checkContext(last('flow/audit'));
  assert.equal(last('flow/audit').auditInfoVO.auditStatus, 2);
  assert.equal(last('flow/audit').auditInfoVO.contentText, '请上一节点重新处理');
  assert.equal(await page.getByRole('button', { name: '提交', exact: true }).isDisabled(), true);
  await page.evaluate(async () => document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/generation/image'));
  await page.getByText('正在处理请求，请完成后再切换任务', { exact: true }).waitFor();
  assert.ok(page.url().includes('/drawing/pageProduction?taskId=88'));
  assert.equal(count('newProductStyle/saveImageData'), submitsBefore);
  release(); release = undefined; holdReject = false;
  await page.waitForURL(url => url.pathname === '/drawing/pageProduction' && !url.search);

  draft = '{invalid';
  await navigate();
  await page.getByText('草稿数据格式不正确，暂不能编辑或覆盖，请联系管理员检查', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '保存', exact: true }).count(), 0);
  const draftsBefore = count('flow/draft/get');
  await navigate('&view=details');
  await page.getByRole('tab', { name: '商品款式', exact: true }).click();
  await cards().first().waitFor();
  assert.equal(count('flow/draft/get'), draftsBefore);
  for (const name of ['保存', '提交', '驳回']) assert.equal(await page.getByRole('button', { name, exact: true }).count(), 0);
  await ctx.finish();
  await fs.writeFile(new URL('./result.json', import.meta.url), JSON.stringify({ mode: 'mock-browser', verified: ['existing API main/detail images populate production form in order and can be saved', 'draft takes priority including empty slots and intentionally cleared detail images; new styles fall back to API', 'save without required validation or style selection', 'partial five-slot drafts preserve empty slots, IDs, detail images, remarks and attachments', 'submit validates all five main images and remark, preserves image order, skips untouched styles', 'failures retain inputs', 'changed node blocks save/submit/reject', 'reject without images uses auditStatus 2 and pageProduction context; pending request blocks navigation', 'invalid drafts cannot be overwritten; readonly excludes drafts and actions'], runtimeErrors: ctx.state.errors, calls }, null, 2));
  console.log('PASS page production save / submit / reject and ordered draft restoration');
} catch (error) {
  release?.();
  console.error(ctx.state.errors);
  await ctx.browser.close();
  throw error;
}
