import fs from 'node:fs/promises';
import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';

const ctx = await setup();
const { page } = ctx;
const styleId = '9007199254740993123';
const calls = [];
const image = name => ({ originalUrl: `https://example.test/${name}.png`, previewUrl: `https://example.test/${name}-preview.png`, thumbnailUrl: `https://example.test/${name}-thumb.png` });
const sources = [0, 1, 3, 4, 5, 6];
const labels = ['单图生成', '批量生成', '线稿生图', '材质增强', '模特图', '动作图'];
const groups = Object.fromEntries(sources.map(sourcePage => [sourcePage, [1, 2].map(index => ({ imgId: sourcePage * 100 + index, name: `来源${sourcePage}批次${index}`, sourcePage, list: [{ id: sourcePage * 1000 + index, isAiCreate: 1, ...image(`${sourcePage}-${index}`) }] }))]));
let emptyDropdown = false;
let failList = false;
let delaySource;
let release;
await page.route('**/admin-api/flycowerp/aiImageResult/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const endpoint = url.pathname.split('/aiImageResult/')[1];
  const params = Object.fromEntries(url.searchParams);
  const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null;
  calls.push({ endpoint, params, body });
  let data;
  if (endpoint.startsWith('list/') || endpoint.startsWith('dropdown/')) {
    const [operation, key, ...suffix] = endpoint.split('/');
    assert.equal(decodeURIComponent(key), styleId);
    assert.equal(suffix.length, 0, 'imgId is a query parameter, never a path suffix');
    assert.ok(sources.includes(Number(params.sourcePage)) && params.sourcePage !== undefined);
    if (operation === 'dropdown') data = emptyDropdown ? [] : groups[params.sourcePage].map(({ imgId, name, sourcePage }) => ({ imgId, name, sourcePage }));
    else {
      if (failList) return route.fulfill({ json: { code: 500, msg: '模拟结果查询失败' } });
      data = groups[params.sourcePage].filter(group => params.imgId === undefined || group.imgId === Number(params.imgId));
      if (delaySource === params.sourcePage) { delaySource = undefined; await new Promise(resolve => { release = resolve; }); }
    }
  } else if (endpoint === 'save') {
    assert.equal(body.styleId, styleId);
    assert.equal(body.styleNo, 'QA-LOCAL-STYLE');
    assert.equal(body.sourcePage, 6);
    assert.equal(body.imgId, 602);
    assert.deepEqual({ originalUrl: body.originalUrl, previewUrl: body.previewUrl, thumbnailUrl: body.thumbnailUrl }, image('local'));
    groups[6][1].list.push({ id: 999, isAiCreate: 0, ...image('local') });
    data = true;
  } else if (endpoint === 'delete/999') {
    groups[6][1].list = groups[6][1].list.filter(result => result.id !== 999);
    data = false; // code=0 means deletion succeeded.
  } else throw new Error(`Unexpected result API: ${endpoint}`);
  await route.fulfill({ json: { code: 0, data } });
});
await page.route('**/admin-api/flycowerp/temp-image/upload', route => route.fulfill({ json: { code: 0, data: { ...image('local'), imageId: 'temp-local' } } }));
const batch = () => page.locator('[aria-label="历史批次"]');
const source = () => page.locator('[aria-label="结果来源页面"]');
const titles = () => page.locator('.ant-card-head-title').filter({ hasText: /^来源\d批次\d$/ });
async function ready() { await page.waitForFunction(() => document.querySelector('[aria-label="历史批次"] input')?.disabled === false); }
async function changeSource(label) { await ctx.select(source(), label); await ready(); }
async function changeBatch(label) { await ctx.select(batch(), label); await ready(); }
try {
  await ctx.navigate(`/generation/results?styleId=${styleId}`);
  await ready();
  assert.deepEqual(await titles().allTextContents(), ['来源0批次1', '来源0批次2']);
  assert.deepEqual(calls.at(-1).params, { sourcePage: '0' });
  await changeBatch('来源0批次2');
  assert.deepEqual(await titles().allTextContents(), ['来源0批次2']);
  assert.deepEqual(calls.at(-1).params, { sourcePage: '0', imgId: '2' });
  await ctx.click('刷新'); await ready();
  assert.deepEqual(calls.at(-1).params, { sourcePage: '0', imgId: '2' });
  for (const [index, label] of labels.entries()) {
    if (index === 0) continue;
    await changeSource(label);
    assert.deepEqual(await titles().allTextContents(), [`来源${sources[index]}批次1`, `来源${sources[index]}批次2`]);
    assert.equal(calls.at(-1).params.imgId, undefined);
  }
  await changeBatch('来源6批次2');
  await ctx.click('上传本地图片');
  const upload = page.getByRole('dialog', { name: '上传本地结果图片', exact: true });
  await upload.getByRole('textbox', { name: '上传图片款号', exact: true }).fill('  QA-LOCAL-STYLE  ');
  await upload.locator('input[type=file]').setInputFiles({ name: 'local.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=', 'base64') });
  await ctx.click('上传并保存', upload);
  await upload.waitFor({ state: 'hidden' }); await ready();
  await page.getByRole('button', { name: '删除本地图片 999', exact: true }).waitFor();
  assert.deepEqual(calls.at(-1).params, { sourcePage: '6', imgId: '602' });
  await ctx.click('删除本地图片 999');
  await page.locator('.ant-popconfirm:visible').getByRole('button', { name: /^确\s*定$/ }).click();
  await page.getByText('图片已删除', { exact: true }).waitFor(); await ready();
  assert.equal(await page.getByRole('button', { name: '删除本地图片 999', exact: true }).count(), 0);
  assert.deepEqual(calls.at(-1).params, { sourcePage: '6', imgId: '602' });
  delaySource = '5';
  await ctx.select(source(), '模特图');
  for (let i = 0; i < 80 && !release; i++) await page.waitForTimeout(25);
  assert.ok(release);
  await changeSource('动作图');
  const lateResponse = page.waitForResponse(response => response.url().includes('/aiImageResult/list/') && new URL(response.url()).searchParams.get('sourcePage') === '5');
  release(); release = undefined;
  await lateResponse; await page.waitForTimeout(100);
  assert.deepEqual(await titles().allTextContents(), ['来源6批次1', '来源6批次2']);
  emptyDropdown = true;
  await ctx.click('刷新'); await ready();
  assert.equal(await titles().count(), 2);
  failList = true;
  await ctx.click('刷新'); await ready();
  await page.getByText('查询失败，请刷新重试', { exact: true }).waitFor();
  failList = false;
  await ctx.click('刷新'); await ready();
  assert.equal(await titles().count(), 2);
  await ctx.finish();
  await fs.writeFile(new URL('./result.json', import.meta.url), JSON.stringify({ mode: 'mock-browser', verified: ['required sourcePage on dropdown and list', 'imgId in query; all batches omit imgId', 'all six sources, refreshed and reset batch selection', 'upload and code=0 deletion preserve source and batch', 'late responses cannot replace a newer source', 'empty dropdown still queries results', 'failed result query and refresh recovery'], calls, runtimeErrors: ctx.state.errors }, null, 2));
  console.log('PASS result sourcePage, query imgId, upload/delete, stale response and retry');
} catch (error) {
  if (release) release();
  console.error(ctx.state.errors);
  await ctx.browser.close();
  throw error;
}
