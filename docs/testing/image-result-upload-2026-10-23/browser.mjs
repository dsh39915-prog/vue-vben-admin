import fs from 'node:fs/promises';
import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';

const ctx = await setup({ permissions: ['flycowerp:drawing:aiImageModelTask', 'flycowerp:drawing:aiImageActionTask'], userId: 7, roles: [] });
const { page } = ctx;
const calls = [];
const style = { id: '9007199254740993101', styleNo: 'QA-LOCAL-UPLOAD', styleName: '红色' };
const urls = { originalUrl: 'https://example.test/original.png', previewUrl: 'https://example.test/preview.png', thumbnailUrl: 'https://example.test/thumb.png' };
let nodeKey = 'aiImageModelTask';
let sourcePage = 5;
let saveFails = false;
await page.route('**/admin-api/flycowerp/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const endpoint = url.pathname.split('/flycowerp/')[1];
  const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null;
  calls.push({ endpoint, body });
  const task = { id: 88, styleNo: style.styleNo, procInstId: 'qa-upload', currentNodeKey: nodeKey, currentNodeTaskId: '9007199254740993123', currentNodeAssigneeId: '7', currentNodeStatus: 2, flowStatus: 2 };
  let data;
  if (endpoint === 'newProductTask/page') data = { list: [task], total: 1 };
  else if (endpoint === 'newProductTask/get/88') data = task;
  else if (endpoint === 'newProductStyle/list' || endpoint === 'newProductStyle/queryMatchStyleList') data = [style];
  else if (endpoint === 'aiMatchingScheme/list') data = [];
  else if (endpoint === 'flow/draft/get') data = null;
  else if (endpoint === 'aiPromptCategory/page') data = [];
  else if (endpoint === 'aiPrompt/page') data = { records: [], total: 0 };
  else if (endpoint === 'aiModel/page') data = { records: ctx.state.models.filter(model => model.modelType === 0), total: 3 };
  else if (endpoint === 'aiModel/sizeConfig') data = { qualities: [{ quality: '2K', sizes: [{ size: '1536x2048', aspectRatio: '3:4' }] }] };
  else if (endpoint.startsWith('aiImageResult/dropdown/')) data = [
    { imgId: 777, name: '上传测试批次', sourcePage },
    { imgId: 888, name: '最新上传批次', sourcePage },
    { imgId: 779, name: '中间上传批次', sourcePage },
  ];
  else if (endpoint.startsWith('aiImageResult/list/')) data = [{ imgId: 777, name: '上传测试批次', sourcePage, status: 2, list: [] }];
  else if (endpoint === 'temp-image/upload') data = urls;
  else if (endpoint === 'aiImageResult/save') {
    assert.deepEqual(body, { styleId: style.id, styleNo: style.styleNo, sourcePage, imgId: 888, ...urls });
    if (saveFails) return route.fulfill({ json: { code: 500, msg: '模拟图片保存失败' } });
    data = null;
  } else return route.fallback();
  await route.fulfill({ json: { code: 0, data } });
});
const count = endpoint => calls.filter(call => call.endpoint === endpoint).length;
try {
  for (const [key, source] of [['aiImageModelTask', 5], ['aiImageActionTask', 6]]) {
    nodeKey = key; sourcePage = source;
    await ctx.navigate(`/drawing/${key}?taskId=88`);
    const button = page.getByRole('button', { name: '上传本地图片', exact: true });
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(el => el.textContent.trim() === '上传本地图片' && !el.disabled));
    await button.click();
    const upload = page.getByRole('dialog', { name: '上传本地结果图片', exact: true });
    const styleInput = upload.getByRole('textbox', { name: '上传图片款号', exact: true });
    assert.equal(await styleInput.inputValue(), style.styleNo);
    assert.equal(await styleInput.getAttribute('readonly'), '');
    const uploadBatch = upload.locator('[aria-label="上传批次"]');
    assert.equal(await uploadBatch.locator('.ant-select-selection-item').innerText(), '最新上传批次', 'default to the newest batch regardless of dropdown ordering');
    await ctx.select(uploadBatch, '上传测试批次');
    assert.equal(await uploadBatch.locator('.ant-select-selection-item').innerText(), '上传测试批次', 'manual switching remains available');
    await ctx.select(uploadBatch, '最新上传批次');
    await upload.getByRole('button', { name: '选择本地结果图片', exact: true }).waitFor();
    const beforeSelection = count('temp-image/upload');
    await upload.locator('input[type=file]').setInputFiles({ name: 'local.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=', 'base64') });
    const localPreview = upload.locator('.image-file-picker-preview img');
    await localPreview.waitFor();
    assert.ok((await localPreview.getAttribute('src')).startsWith('blob:'));
    await page.waitForFunction(() => document.querySelector('.image-file-picker-preview img')?.naturalWidth > 0);
    assert.equal(count('temp-image/upload'), beforeSelection, 'selection only previews; upload waits for confirmation');
    await upload.locator('.image-file-picker-preview .ant-image').click();
    await page.locator('.ant-image-preview:visible').waitFor();
    await page.locator('.ant-image-preview-operations-operation').first().click();
    await page.locator('.ant-image-preview:visible').waitFor({ state: 'hidden' });
    await upload.locator('input[type=file]').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
    await page.getByText('请选择非空的图片文件', { exact: true }).last().waitFor();
    assert.equal(await localPreview.getAttribute('alt'), 'local.png', 'invalid replacement preserves selected image');
    await upload.getByRole('button', { name: '移除图片', exact: true }).click();
    await upload.getByRole('button', { name: '选择本地结果图片', exact: true }).waitFor();
    assert.equal(await localPreview.count(), 0);
    await upload.locator('input[type=file]').setInputFiles({ name: 'local.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=', 'base64') });
    await localPreview.waitFor();
    saveFails = true;
    await ctx.click('上传并保存', upload);
    await upload.getByText('图片已上传，保存结果失败，请重试保存', { exact: true }).waitFor();
    const uploadCount = count('temp-image/upload');
    saveFails = false;
    await ctx.click('上传并保存', upload);
    await upload.waitFor({ state: 'hidden' });
    assert.equal(count('temp-image/upload'), uploadCount, 'retry reuses uploaded URLs');
    assert.equal(count('aiImageResult/save'), source === 5 ? 2 : 4);
    await page.waitForFunction(() => document.querySelector('[aria-label="历史批次"] input')?.disabled === false);
    await ctx.select(page.locator('[aria-label="历史批次"]'), '上传测试批次');
    await page.waitForFunction(() => document.querySelector('[aria-label="历史批次"] input')?.disabled === false);
    await button.click();
    await upload.waitFor();
    assert.equal(await upload.locator('[aria-label="上传批次"] .ant-select-selection-item').innerText(), '上传测试批次', 'an explicitly filtered batch takes precedence');
    await upload.getByRole('button', { name: /^取\s*消$/, exact: true }).click();
    await upload.waitFor({ state: 'hidden' });
  }
  await ctx.finish();
  await fs.writeFile(new URL('./result.json', import.meta.url), JSON.stringify({ mode: 'mock-browser', verified: ['model/action uploads automatically include styleNo and sourcePage 5/6', 'styleId preserved without int64 precision loss', 'batch and three URLs retained', 'selection previews locally before upload; full preview opens and closes', 'invalid replacement preserves image; remove and reselect work', 'save failure retry reuses uploaded file and new parameters', 'successful response closes modal'], calls: calls.filter(call => ['aiImageResult/save', 'temp-image/upload'].includes(call.endpoint)), runtimeErrors: ctx.state.errors }, null, 2));
  console.log('PASS local image upload: newest batch default for model/action, manual switching, explicit batch override, styleNo, sourcePage, URLs and retry');
} catch (error) {
  console.error(ctx.state.errors);
  await ctx.browser.close();
  throw error;
}
