import fs from 'node:fs/promises';
import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';

const ctx = await setup({ permissions: ['flycowerp:drawing:retouching', 'flycowerp:drawing:pageProduction'], userId: 7, roles: [] });
const { page } = ctx;
const task = { id: 88, styleNo: 'QA-RETOUCH', procInstId: 'qa-retouch', currentNodeKey: 'retouching', currentNodeTaskId: '9007199254740993123', currentNodeAssigneeId: '7', currentNodeStatus: 2, flowStatus: 2 };
const styles = [0, 1, 2].map(i => ({ id: `900719925474099310${i}`, styleNo: `QA-RETOUCH-${i}`, styleName: `款式${i}` }));
const image = i => ({ imageId: String(i), originalUrl: `https://example.test/${i}.png`, previewUrl: `https://example.test/p${i}.png`, thumbnailUrl: `https://example.test/t${i}.png` });
const calls = [];
let draft = null;
let serial = 0;
let failDraft = false;
let failSubmit = false;
let failReject = false;
let holdReject = false;
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
  else if (endpoint === 'newProductStyle/list') data = styles;
  else if (['aiMatchingScheme/list', 'flow/nodeDetailList', 'flow/transferRecordList'].includes(endpoint)) data = [];
  else if (endpoint === 'temp-image/upload') data = image(++serial);
  else if (endpoint === 'flow/draft/get') {
    assert.equal(url.searchParams.get('nodeKey'), 'retouching');
    assert.equal(url.searchParams.get('procInstId'), task.procInstId);
    data = draft;
  } else if (endpoint === 'flow/draft/save') {
    if (failDraft) return route.fulfill({ json: { code: 500, msg: '模拟草稿保存失败' } });
    draft = body.formDataJson;
    data = '9007199254740993199';
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
const remark = () => field('图片备注').locator('textarea');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=', 'base64');
async function upload(scope) {
  const before = await scope.locator('.ant-image').count();
  await scope.locator('input[type=file]').setInputFiles({ name: 'qa.png', mimeType: 'image/png', buffer: png });
  await scope.locator('.ant-image').nth(before).waitFor();
}
async function navigate(query = '') {
  await ctx.navigate(`/drawing/${task.currentNodeKey}?taskId=88${query}`);
  await page.getByText('任务信息', { exact: true }).waitFor();
}
async function save() {
  await ctx.click('保存款式图片');
  await page.getByText('修图草稿已保存', { exact: true }).waitFor();
}
async function submit() { await ctx.click('提交'); await page.getByText('确认将修图提交到下一节点？', { exact: true }).waitFor(); await ctx.confirm(); }
async function reject() { await ctx.click('驳回'); await page.getByText('确认驳回到上一节点？', { exact: true }).waitFor(); await ctx.click('确认驳回'); }
function checkContext(payload) {
  assert.equal(payload.nodeKey, 'retouching');
  assert.equal(payload.nodeTaskId, task.currentNodeTaskId);
  assert.equal(payload.procInstId, task.procInstId);
}
try {
  await navigate();
  await page.getByRole('button', { name: '提交', exact: true }).waitFor();
  assert.equal(await cards().locator('.ant-card-head input[type=checkbox]').count(), 0);
  assert.equal(await page.getByRole('button', { name: '提交', exact: true }).isEnabled(), true);
  await save();
  assert.equal(count('newProductStyle/saveImageData'), 0);
  assert.equal(count('flow/audit'), 0);
  checkContext(last('flow/draft/save'));
  assert.equal(JSON.parse(draft).styles.length, 3);
  await ctx.click('提交');
  await page.getByText('请先上传本次提交的修图图片', { exact: true }).waitFor();
  assert.equal(count('newProductStyle/saveImageData'), 0);
  await reject();
  await page.getByText('请填写驳回原因', { exact: true }).waitFor();
  assert.equal(count('flow/audit'), 0);

  await upload(field('精修模特图', cards().nth(0)));
  await upload(field('精修动作图', cards().nth(1)));
  await ctx.click('提交');
  await page.getByText('请填写备注说明', { exact: true }).waitFor();
  await upload(field('备注附件'));
  await remark().fill('  修图测试备注  ');
  failDraft = true;
  await ctx.click('保存款式图片');
  await page.getByText('模拟草稿保存失败', { exact: true }).first().waitFor();
  assert.equal(await cards().locator('.ant-image').count(), 2);
  failDraft = false;
  await save();
  const saved = draft;
  await navigate();
  await field('精修模特图', cards().nth(0)).locator('.ant-image').waitFor();
  assert.equal(await cards().locator('.ant-image').count(), 2);
  assert.equal(await field('备注附件').locator('.ant-image').count(), 1);
  assert.equal(await remark().inputValue(), '  修图测试备注  ');
  await save();
  assert.deepEqual(JSON.parse(draft), JSON.parse(saved));

  const oldTaskId = task.currentNodeTaskId;
  task.currentNodeTaskId = 'changed-task';
  await ctx.click('保存款式图片');
  await page.getByText('任务状态或节点已变化，请刷新任务后重试', { exact: true }).waitFor();
  assert.equal(draft, saved);
  await submit();
  await page.getByText('任务状态或节点已变化，请刷新任务后重试', { exact: true }).first().waitFor();
  assert.equal(count('newProductStyle/saveImageData'), 0);
  await reject();
  await page.getByText('任务状态或节点已变化，请刷新任务后重试', { exact: true }).first().waitFor();
  assert.equal(count('flow/audit'), 0);
  task.currentNodeTaskId = oldTaskId;

  failSubmit = true;
  await submit();
  await page.getByText('修图未提交成功，请重试', { exact: true }).waitFor();
  assert.equal(await cards().locator('.ant-image').count(), 2);
  const payload = last('newProductStyle/saveImageData');
  checkContext(payload);
  assert.deepEqual(payload.items.map(item => item.styleId), styles.slice(0, 2).map(style => style.id));
  assert.equal(payload.items[0].retouchedModelImageUrls[0].imageId, '1');
  assert.equal(payload.items[1].retouchedActionImageUrls[0].imageId, '2');
  assert.equal(payload.remarkInfoVO.contentText, '修图测试备注');
  assert.equal(payload.remarkInfoVO.imageUrls.length, 1);
  failSubmit = false;
  await submit();
  await page.getByText('修图已提交', { exact: true }).waitFor();
  await field('精修模特图', cards().nth(0)).locator('.ant-image').waitFor();

  draft = null;
  await navigate();
  await page.getByRole('button', { name: '驳回', exact: true }).waitFor();
  await remark().fill('  返回上一节点重新处理  ');
  failReject = true;
  await reject();
  await page.getByText('驳回未成功，请重试', { exact: true }).waitFor();
  assert.equal(await remark().inputValue(), '  返回上一节点重新处理  ');
  failReject = false;
  holdReject = true;
  const auditRequest = page.waitForRequest(request => request.url().endsWith('/flow/audit'));
  await reject();
  await auditRequest;
  const beforeSubmit = count('newProductStyle/saveImageData');
  assert.equal(await page.getByRole('button', { name: '提交', exact: true }).isDisabled(), true);
  await page.evaluate(async () => { await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/generation/image'); });
  await page.getByText('正在处理请求，请完成后再切换任务', { exact: true }).waitFor();
  assert.ok(page.url().includes('/drawing/retouching?taskId=88'));
  checkContext(last('flow/audit'));
  assert.equal(last('flow/audit').auditInfoVO.auditStatus, 2);
  assert.equal(last('flow/audit').auditInfoVO.contentText, '返回上一节点重新处理');
  assert.equal(count('newProductStyle/saveImageData'), beforeSubmit);
  release(); release = undefined; holdReject = false;
  await page.waitForURL(url => url.pathname === '/drawing/retouching' && !url.search);

  draft = '{invalid';
  await navigate();
  await page.getByText('草稿数据格式不正确，暂不能编辑或覆盖，请联系管理员检查', { exact: true }).waitFor();
  const draftsBefore = count('flow/draft/get');
  await navigate('&view=details');
  await page.getByRole('tab', { name: '商品款式', exact: true }).click();
  await cards().first().waitFor();
  assert.equal(count('flow/draft/get'), draftsBefore, 'readonly details never loads editable draft');
  assert.equal(await page.getByRole('button', { name: '提交', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: '驳回', exact: true }).count(), 0);

  draft = null;
  task.currentNodeKey = 'pageProduction';
  await navigate();
  await cards().first().locator('.ant-card-head input[type=checkbox]').waitFor();
  assert.equal(count('flow/draft/get'), draftsBefore);
  assert.equal(await page.getByRole('button', { name: '提交', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: '驳回', exact: true }).count(), 0);
  await ctx.click('保存款式图片'); await ctx.confirm();
  await page.getByText('请先选择款式', { exact: true }).waitFor();
  await ctx.finish();
  await fs.writeFile(new URL('./result.json', import.meta.url), JSON.stringify({ mode: 'mock-browser', verified: ['empty/incomplete draft saves without selection and without advancing flow', 'draft round trip preserves images, style IDs, remarks and attachments', 'submit validates images and remarks, sends both retouch fields and skips untouched styles', 'failed saves/submission/rejection retain input', 'changed node blocks draft, submit and rejection writes', 'rejection needs reason but no images, guards navigation while pending, returns to list on success', 'invalid draft protected from overwrite; readonly never loads draft or shows actions', 'page production selection and existing save behavior retained'], runtimeErrors: ctx.state.errors, calls }, null, 2));
  console.log('PASS retouching save / submit / reject');
} catch (error) {
  if (release) release();
  console.error(ctx.state.errors);
  await ctx.browser.close();
  throw error;
}
