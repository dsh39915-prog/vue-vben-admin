import fs from 'node:fs/promises';
import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';

const ctx = await setup();
const { page } = ctx;
const calls = [];
const key = 'QA/RESULT 88';
const urls = { originalUrl: 'https://example.test/local-original.png', previewUrl: 'https://example.test/local-preview.png', thumbnailUrl: 'https://example.test/local-thumb.png' };
const groups = new Map([[333, [{ id: 101, isAiCreate: 0, ...urls }, { id: 102, isAiCreate: 1, ...urls }, { id: 103, ...urls }]], [334, []]]);
let uploadMode = 'failure';
let saveMode = 'failure';
let deleteMode = 'error';
let release;
const task = { id: 88, styleNo: 'QA-RESULT', procInstId: 'qa-proc', currentNodeKey: 'aiImageModelTask', currentNodeTaskId: 'qa-node', currentNodeAssigneeId: '1', currentNodeStatus: 2, flowStatus: 2 };
await page.route('**/admin-api/flycowerp/**', async route => {
  const request = route.request();
  const endpoint = new URL(request.url()).pathname.split('/flycowerp/')[1];
  if (endpoint.startsWith('aiImageResult/') || endpoint === 'temp-image/upload') calls.push({ endpoint, method: request.method() });
  let data;
  if (endpoint === 'temp-image/upload') {
    assert.equal(request.method(), 'POST');
    assert.equal(request.headers().authorization, 'Bearer browser-test');
    assert.match(request.postDataBuffer().toString('latin1'), /name="file"; filename="result.png"/);
    if (uploadMode === 'failure') return route.fulfill({ json: { code: 500, msg: '模拟上传失败', data: null } });
    data = uploadMode === 'incomplete' ? { originalUrl: urls.originalUrl } : urls;
  } else if (endpoint === 'aiImageResult/save') {
    const body = request.postDataJSON();
    calls.at(-1).body = body;
    assert.equal(request.method(), 'POST');
    assert.deepEqual(body, { businessKey: key, imgId: 334, ...urls });
    if (saveMode === 'failure') return route.fulfill({ json: { code: 500, msg: '模拟保存失败', data: null } });
    if (saveMode === 'false') return route.fulfill({ json: { code: 0, data: false } });
    if (saveMode === 'pending') await new Promise(resolve => { release = resolve; });
    groups.set(334, [104, 105, 106, 107].map(id => ({ id, isAiCreate: 0, ...urls })));
    data = { id: 104 };
  } else if (endpoint.startsWith('aiImageResult/delete/')) {
    assert.equal(request.method(), 'GET');
    const id = Number(endpoint.split('/').at(-1));
    assert.ok([104, 105, 106, 107].includes(id));
    if (deleteMode === 'error') return route.fulfill({ json: { code: 500, msg: '模拟删除失败', data: null } });
    groups.set(334, groups.get(334).filter(result => result.id !== id));
    if (!groups.get(334).length) groups.delete(334);
    if (deleteMode === 'missing') return route.fulfill({ json: { code: 0 } });
    data = deleteMode === 'null' ? null : deleteMode === 'true';
  } else if (endpoint.startsWith('aiImageResult/dropdown/')) {
    data = [...groups.keys()].sort((a, b) => b - a).map(imgId => ({ imgId, name: `批次${imgId}` }));
  } else if (endpoint.startsWith('aiImageResult/list/')) {
    const segments = endpoint.slice('aiImageResult/list/'.length).split('/');
    assert.ok([key, '88'].includes(decodeURIComponent(segments[0])));
    const imgId = segments.length === 1 ? undefined : Number(segments[1]);
    assert.ok(imgId === undefined || Number.isSafeInteger(imgId));
    data = (imgId === undefined ? [...groups.keys()].sort((a, b) => b - a) : [imgId]).map(id => ({ imgId: id, name: `批次${id}`, createTime: '2026-10-21 12:00:00', list: groups.get(id) || [] }));
  } else if (endpoint === 'newProductTask/page') data = { list: [task], total: 1 };
  else if (endpoint === 'newProductTask/get/88') data = task;
  else if (['flow/nodeDetailList', 'flow/transferRecordList', 'aiMatchingScheme/list', 'newProductStyle/list'].includes(endpoint)) data = [];
  else return route.fallback();
  await route.fulfill({ json: { code: 0, data } });
});

const count = endpoint => calls.filter(call => call.endpoint === endpoint).length;
const file = { name: 'result.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=', 'base64') };
try {
  await ctx.navigate('/generation/results?businessKey=' + encodeURIComponent(key));
  await page.getByText('本地上传', { exact: true }).waitFor();
  assert.equal(await page.getByText('AI 生成', { exact: true }).count(), 1);
  assert.equal(await page.getByText('来源未知', { exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: /^删除本地图片 / }).count(), 1);
  assert.equal(await page.getByRole('button', { name: '删除本地图片 101', exact: true }).count(), 1);
  await ctx.click('上传本地图片');
  const input = () => ctx.dialog().getByLabel('本地结果图片', { exact: true });
  assert.equal(await ctx.dialog().getByRole('button', { name: '上传并保存' }).isDisabled(), true);
  await input().setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('bad') });
  await page.getByText('请选择非空的图片文件', { exact: true }).waitFor();
  assert.equal(count('temp-image/upload'), 0);
  await input().setInputFiles(file);
  assert.equal(await ctx.dialog().getByRole('button', { name: '上传并保存' }).isDisabled(), true, 'all-batches view must require explicit target batch');
  assert.equal(count('temp-image/upload'), 0);
  const uploadBatch = () => ctx.dialog().locator('.ant-select[aria-label="上传批次"]');
  await ctx.select(uploadBatch(), '批次334');
  await page.locator('.ant-select-dropdown:visible').waitFor({ state: 'hidden' });
  await ctx.click('上传并保存', ctx.dialog());
  await ctx.dialog().getByText('图片上传失败，请重试', { exact: true }).waitFor();
  assert.equal(count('aiImageResult/save'), 0);
  uploadMode = 'incomplete';
  await ctx.click('上传并保存', ctx.dialog());
  await ctx.dialog().getByText('上传未返回完整图片地址，请重试', { exact: true }).waitFor();
  assert.equal(count('aiImageResult/save'), 0);
  uploadMode = 'success';
  await ctx.click('上传并保存', ctx.dialog());
  await ctx.dialog().getByText('图片已上传，保存结果失败，请重试保存', { exact: true }).waitFor();
  assert.equal(count('temp-image/upload'), 3);
  saveMode = 'false';
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/aiImageResult/save')),
    ctx.click('上传并保存', ctx.dialog()),
  ]);
  await ctx.dialog().getByText('图片已上传，保存结果失败，请重试保存', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('input[type=file]')?.disabled === false);
  saveMode = 'pending';
  await Promise.all([
    page.waitForRequest(request => request.url().endsWith('/aiImageResult/save')),
    ctx.click('上传并保存', ctx.dialog()),
  ]);
  await page.waitForFunction(() => document.querySelector('input[type=file]')?.disabled);
  assert.equal(await uploadBatch().locator('input').isDisabled(), true, 'batch cannot change during upload/save');
  assert.equal(await page.getByRole('tab', { name: '全部结果' }).getAttribute('aria-disabled'), 'true');
  await page.evaluate(async () => {
    await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/generation/image');
  });
  await page.getByText('正在处理结果图片，请完成后再离开页面', { exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/generation/results');
  assert.equal(count('temp-image/upload'), 3, 'save retry must reuse uploaded addresses');
  assert.equal(typeof release, 'function');
  release();
  release = undefined;
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '删除本地图片 104', exact: true }).waitFor();

  await ctx.click('删除本地图片 104');
  await page.getByRole('tooltip').getByRole('button', { name: /^取\s*消$/ }).click();
  assert.equal(count('aiImageResult/delete/104'), 0);
  await ctx.click('删除本地图片 104');
  await ctx.confirm();
  await page.getByText('模拟删除失败', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '删除本地图片 104', exact: true }).count(), 1);
  for (const [index, mode] of ['false', 'null', 'missing', 'true'].entries()) {
    deleteMode = mode;
    const id = 104 + index;
    const refreshBefore = calls.filter(call => call.endpoint.startsWith('aiImageResult/dropdown/')).length;
    await ctx.click(`删除本地图片 ${id}`);
    await ctx.confirm();
    await page.getByRole('button', { name: `删除本地图片 ${id}`, exact: true }).waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '删除本地图片 101', exact: true }).waitFor();
    assert.ok(calls.filter(call => call.endpoint.startsWith('aiImageResult/dropdown/')).length > refreshBefore, `code=0 with ${mode} data refreshes results`);
    assert.equal(await page.getByText('图片未删除，请重试', { exact: true }).count(), 0);
  }
  await page.getByRole('button', { name: '删除本地图片 101', exact: true }).waitFor();
  assert.equal(count('aiImageResult/delete/104'), 2);
  await ctx.select(page.locator('.ant-select[aria-label="历史批次"]'), '批次333');
  await page.locator('.ant-select-dropdown:visible').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '删除本地图片 101', exact: true }).waitFor();
  await ctx.click('上传本地图片');
  assert.equal(await uploadBatch().locator('.ant-select-selection-item').innerText(), '批次333', 'single batch is prefilled');
  await input().setInputFiles(file);
  assert.equal(await ctx.dialog().getByRole('button', { name: '上传并保存' }).isEnabled(), true);
  await ctx.click(/^取\s*消$/, ctx.dialog());
  await ctx.dialog().waitFor({ state: 'hidden' });
  await ctx.navigate('/launch/workbench?taskId=88');
  await page.getByRole('tab', { name: '生成结果与历史', exact: true }).click();
  await page.getByRole('button', { name: '上传本地图片', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '删除本地图片 101', exact: true }).count(), 1);
  task.flowStatus = task.currentNodeStatus = 4;
  await ctx.navigate('/launch/workbench?taskId=88');
  await page.getByRole('tab', { name: '生成结果与历史', exact: true }).click();
  await page.getByText('本地上传', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '上传本地图片', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: /^删除本地图片 / }).count(), 0);
  groups.clear();
  await ctx.navigate('/generation/results?businessKey=' + encodeURIComponent(key));
  await page.getByText('该流程任务暂无生成批次', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '上传本地图片', exact: true }).isDisabled(), true);
  await page.getByText('暂无可用批次，请先生成图片批次后再上传本地图片。', { exact: true }).waitFor();
  await ctx.finish();
  await fs.writeFile(new URL('./result.json', import.meta.url), JSON.stringify({ mode: 'mock-browser', verified: ['record ID and AI/local/unknown sources', 'local upload multipart then JSON save with three URLs, business key and required numeric imgId', 'all-batches view requires explicit upload target; single batch prefilled', 'no batches blocks upload', 'invalid file and incomplete upload blocked', 'upload/save retry without duplicate upload retains target imgId', 'pending navigation, batch and tab guards', 'success reloads batch dropdown and results', 'delete cancel sends no request; nonzero code retains image; code=0 with false/null/missing/true data refreshes successfully', 'node workspace editable and frozen read-only'], calls, runtimeErrors: ctx.state.errors }, null, 2));
  console.log('PASS image result local upload/save, delete, source fields, scope and busy guards');
} catch (error) {
  if (release) release();
  await ctx.browser.close();
  throw error;
}
