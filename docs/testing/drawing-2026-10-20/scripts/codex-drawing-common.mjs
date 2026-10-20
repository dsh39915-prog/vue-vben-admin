import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const { chromium } = createRequire(path.join(process.cwd(), 'package.json'))('playwright');
export { assert };
export async function setup({permissions=['*:*:*'], userId=1, roles=['super']}={}) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  page.setDefaultTimeout(12000);
  const state = {
    requests: [], errors: [], warnings: [], failNext: '', sizeConfig: true,
    models: Array.from({ length: 12 }, (_, i) => ({ id: i + 1, modelName: i === 0 ? '测试图片模型' : i === 1 ? '禁用图片模型' : i === 2 ? '手动尺寸模型' : `视频模型${i + 1}`, modelCode: `model-${i + 1}`, modelType: i < 3 ? 0 : 1, providerId: 1, status: i === 1 ? 0 : 1, apiUrl: 'https://example.test/api', apiKey: 'fake-key', ak: 'fake-ak', sk: 'fake-sk', updateTime: 1791627276000 })),
    results: [
      { id: 201, imgId: 1, taskId: 5, slotNo: 1, imageUrl: 'https://example.test/current-1.png', isCurrent: 1, createTime: '2026-10-12 10:00:00' },
      { id: 202, imgId: 1, taskId: 5, slotNo: 2, imageUrl: 'https://example.test/current-2.png', isCurrent: 1, createTime: '2026-10-12 10:00:00' },
      { id: 200, imgId: 1, taskId: 2, slotNo: 1, imageUrl: 'https://example.test/history-1.png', isCurrent: 0, createTime: '2026-10-11 10:00:00' },
    ],
    images: [], tasks: [],
  };
  state.images = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, goodsCode: `GOODS-${i + 1}`, prompt: `商品提示词${i + 1}`, num: 2, aiModelId: 1, originalImg: '', referenceImg: i === 0 ? 'https://example.test/ref1.png,https://example.test/ref2.png' : '', promptType: 1, promptId: 1, size: '1024x1024', quality: '2K', aspectRatio: '1:1', status: i === 1 ? 0 : 1, results: i === 0 ? state.results.filter((r) => r.isCurrent === 1) : [], createTime: '2026-10-12 10:00:00' }));
  state.tasks = [5, 3, 0, 1, 2, 4, 5].map((status, i) => ({ id: i + 1, imgId: 1, modelId: 1, status, taskType: 0, sourcePage: 0, generateType: 0, progress: status === 2 ? 100 : 0, imgNum: 2, resultCount: status === 2 ? 2 : 0, prompt: '任务提示词', imageSize: '1024x1024', quality: '2K', aspectRatio: '1:1', createTime: '2026-10-12 10:00:00', errorMessage: status === 3 ? '测试失败原因' : '', errorDetail: status === 3 ? '测试错误详情' : '' }));
  page.on('pageerror', (error) => state.errors.push(error.message));
  page.on('console', (msg) => { if (msg.type() === 'warning') state.warnings.push(msg.text()); });
  await page.route('https://example.test/**', (route) => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=', 'base64') }));
  await page.route('**/admin-api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const p = url.pathname;
    const method = request.method();
    const body = request.postDataJSON();
    state.requests.push({ path: p, method, body, query: Object.fromEntries(url.searchParams) });
    if (state.failNext === p) { state.failNext = ''; await route.fulfill({ json: { code: 10001, msg: '模拟请求失败', data: null } }); return; }
    let data = null;
    const pageResult = (records) => ({ records: records.slice((body.page - 1) * body.pageSize, body.page * body.pageSize), current: body.page, size: body.pageSize, total: records.length });
    const lastId = () => Number(p.split('/').at(-1));
    if (p.endsWith('/system/auth/login')) data = { accessToken: 'browser-test', refreshToken: 'browser-refresh', userId: 1 };
    else if (p.endsWith('/system/auth/get-permission-info')) data = { user: { id: userId, nickname: 'Browser Test', username: 'test' }, roles, permissions, menus: [] };
    else if (p.endsWith('/newProductTask/page')) data = { list: [], total: 0 };
    else if (p.endsWith('/aiModel/page')) {
      assert.equal(method, 'POST');
      data = pageResult(state.models.filter((r) => (body.modelType === undefined || body.modelType === r.modelType) && (body.status === undefined || body.status === r.status) && (!body.modelName || r.modelName.includes(body.modelName)) && (!body.providerId || body.providerId === r.providerId)));
    } else if (p.includes('/aiModel/detail/')) { assert.equal(method, 'GET'); data = state.models.find((r) => r.id === lastId()) ?? null; }
    else if (p.endsWith('/aiModel/save')) { assert.equal(method, 'POST'); assert.equal(body.id, undefined); data = Math.max(...state.models.map((r) => r.id)) + 1; state.models.push({ ...body, id: data }); }
    else if (p.endsWith('/aiModel/update')) { assert.equal(method, 'POST'); Object.assign(state.models.find((r) => r.id === body.id), body); data = true; }
    else if (p.includes('/aiModel/enable/') || p.includes('/aiModel/disable/')) { assert.equal(method, 'GET'); const ids = p.split('/').at(-1).split(',').map(Number); state.models.filter((r) => ids.includes(r.id)).forEach((r) => { r.status = p.includes('/enable/') ? 1 : 0; }); data = true; }
    else if (p.includes('/aiModel/delete/')) { assert.equal(method, 'GET'); state.models = state.models.filter((r) => r.id !== lastId()); data = true; }
    else if (p.includes('/aiModel/testConnection/')) { assert.equal(method, 'GET'); data = '测试连接成功'; }
    else if (p.endsWith('/aiModel/sizeConfig')) { assert.equal(method, 'GET'); data = state.sizeConfig && url.searchParams.get('modelCode') !== 'model-3' ? { qualities: [{ quality: '2K', sizes: [{ aspectRatio: '1:1', size: '1024x1024' }, { aspectRatio: '3:4', size: '1536x2048' }] }, { quality: '4K', sizes: [{ aspectRatio: '1:1', size: '4096x4096' }] }] } : null; }
    else if (p.endsWith('/aiPromptCategory/page')) data = [{ id: 1, name: '测试提示词类别' }];
    else if (p.endsWith('/aiPrompt/page')) data = [{ id: 1, name: '测试模板', categoryId: 1, userPrompt: '模板用户提示词', referenceImg: 'https://example.test/template.png' }];
    else if (p.includes('/aiPrompt/details/')) data = { id: 1, name: '测试模板', categoryId: 1, userPrompt: '模板用户提示词', referenceImg: 'https://example.test/template.png' };
    else if (p.endsWith('/aiImg/page')) { assert.equal(method, 'POST'); data = pageResult(state.images.filter((r) => (!body.aiModelId || r.aiModelId === body.aiModelId) && (!body.prompt || r.prompt.includes(body.prompt)) && (body.isImg === undefined || Boolean(r.referenceImg) === body.isImg))); }
    else if (p.includes('/aiImg/details/')) { assert.equal(method, 'GET'); data = state.images.find((r) => r.id === lastId()) ?? null; }
    else if (p.endsWith('/aiImg/save') || p.endsWith('/aiImg/update')) {
      assert.equal(method, 'POST');
      if (p.endsWith('/save')) { assert.equal(body.id, undefined); const id = Math.max(...state.images.map((r) => r.id)) + 1; state.images.push({ ...body, id, results: [] }); data = id; }
      else { assert.ok(body.id); Object.assign(state.images.find((r) => r.id === body.id), body); data = true; }
    } else if (p.endsWith('/aiImageTask/page')) { assert.equal(method, 'POST'); data = pageResult(state.tasks.filter((r) => (body.status === undefined || r.status === body.status) && (!body.aiModelId || r.modelId === body.aiModelId) && (body.taskType === undefined || body.taskType === r.taskType) && (body.sourcePage === undefined || body.sourcePage === r.sourcePage))); }
    else if (p.endsWith('/aiImageTask/statistics')) { data = { totalCount: state.tasks.length, waitingCount: state.tasks.filter((r) => r.status === 0).length, runningCount: state.tasks.filter((r) => r.status === 1).length, successCount: state.tasks.filter((r) => r.status === 2).length, failCount: state.tasks.filter((r) => r.status === 3).length, cancelCount: state.tasks.filter((r) => r.status === 4).length }; }
    else if (p.includes('/aiImageTask/detail/')) { assert.equal(method, 'GET'); data = state.tasks.find((r) => r.id === lastId()) ?? null; }
    else if (/\/aiImageTask\/(start|retry|cancel)\//.test(p)) { assert.equal(method, 'GET'); const ids = p.split('/').at(-1).split(',').map(Number); state.tasks.filter((r) => ids.includes(r.id)).forEach((r) => { r.status = p.includes('/cancel/') ? 4 : 0; }); data = true; }
    else if (p.includes('/aiImageTask/delete/')) { assert.equal(method, 'DELETE'); state.tasks = state.tasks.filter((r) => r.id !== lastId()); data = true; }
    else if (p.includes('/aiImageResult/history/')) { assert.equal(method, 'GET'); const segments = p.split('/history/')[1].split('/').map(Number); data = state.results.filter((r) => r.imgId === segments[0] && (segments.length === 1 || r.slotNo === segments[1])); }
    else if (/\/aiImageTask\/result\/(regenerate|material-enhance)\//.test(p)) { assert.equal(method, 'POST'); assert.equal(body, null); data = { taskId: 100 }; }
    else throw new Error(`Unexpected API: ${method} ${p}`);
    await route.fulfill({ json: { code: 0, msg: '', data } });
  });
  await page.goto((process.env.DRAWING_TEST_BASE_URL || 'http://127.0.0.1:5666'), { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(async () => { const { useAuthStore } = await import('/src/store/auth.ts'); await useAuthStore().authLogin({ username: 'test', password: 'unused' }); });
  async function navigate(route) { await page.goto(`${process.env.DRAWING_TEST_BASE_URL || 'http://127.0.0.1:5666'}${route}`, { waitUntil: 'networkidle', timeout: 60000 }); }
  const dialog = () => page.getByRole('dialog').last();
  const click = (name, scope = page) => scope.getByRole('button', { name, exact: true }).click();
  const row = (text) => page.getByRole('row').filter({ has: page.getByRole('cell', { name: String(text), exact: true }) });
  const confirm = () => click(/^确\s*定$/);
  const lastRequest = (suffix) => state.requests.findLast((r) => r.path.endsWith(suffix));
  async function select(control, label) { await control.locator('.ant-select-selector').click(); await page.locator('.ant-select-dropdown:visible').getByTitle(label, { exact: true }).click(); }
  async function finish() { assert.deepEqual(state.errors, []); assert.equal(state.warnings.some((v) => v.includes('model is required')), false); await browser.close(); }
  return { browser, page, state, navigate, dialog, click, row, confirm, lastRequest, select, finish };
}
