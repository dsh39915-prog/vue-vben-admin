import fs from 'node:fs/promises';
import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';

const ctx = await setup();
const { page } = ctx;
const key = 'QA/ALL BATCHES';
const calls = [];
const group = id => ({ imgId: id, name: `批次${id}`, createTime: '2026-10-21 09:00:00', list: [{ id: id * 10, isAiCreate: 1, originalUrl: `https://example.test/${id}.png` }] });
let data = [group(303), group(302), group(301)];
let dropdownEmpty = false;
let fail = false;
let delay = false;
let release;
await page.route('**/admin-api/flycowerp/aiImageResult/**', async route => {
  const request = route.request();
  const endpoint = new URL(request.url()).pathname.split('/aiImageResult/')[1];
  calls.push(endpoint);
  let result;
  if (endpoint.startsWith('dropdown/')) result = dropdownEmpty ? [] : data.map(({ imgId, name }) => ({ imgId, name }));
  else if (endpoint.startsWith('list/')) {
    const parts = endpoint.slice(5).split('/');
    assert.equal(decodeURIComponent(parts[0]), key);
    assert.ok(parts.length === 1 || Number.isSafeInteger(Number(parts[1])));
    if (fail) return route.fulfill({ json: { code: 500, msg: '模拟批次查询失败', data: null } });
    result = parts.length === 1 ? data : data.filter(group => group.imgId === Number(parts[1]));
    if (delay) { delay = false; await new Promise(resolve => { release = resolve; }); }
  } else return route.fallback();
  await route.fulfill({ json: { code: 0, data: result } });
});
const batch = () => page.locator('.ant-select[aria-label="历史批次"]');
const titles = () => page.locator('.ant-card-head-title').filter({ hasText: /^批次\d+$/ });
async function ready() { await page.waitForFunction(() => document.querySelector('[aria-label="历史批次"] input')?.disabled === false); }
async function choose(label) {
  await ready();
  await page.locator('.ant-select-dropdown:visible').waitFor({ state: 'hidden' });
  await ctx.select(batch(), label);
  await page.locator('.ant-select-dropdown:visible').waitFor({ state: 'hidden' });
  await ready();
}
async function refresh() { await ctx.click(/^刷\s*新$/); await ready(); }
try {
  await ctx.navigate('/generation/results?businessKey=' + encodeURIComponent(key));
  await ready();
  assert.equal(await batch().locator('.ant-select-selection-item').innerText(), '全部批次');
  assert.deepEqual(await titles().allTextContents(), ['批次303', '批次302', '批次301']);
  assert.ok(calls.includes('list/' + encodeURIComponent(key)));
  assert.equal(calls.some(call => /\/undefined$|\/all$/.test(call)), false);
  await page.getByText('3 条生图记录 · 3 张图片', { exact: false }).waitFor();

  await choose('批次302');
  assert.deepEqual(await titles().allTextContents(), ['批次302']);
  assert.equal(calls.at(-1), 'list/' + encodeURIComponent(key) + '/302');
  await refresh();
  assert.equal(await batch().locator('.ant-select-selection-item').innerText(), '批次302');
  assert.deepEqual(await titles().allTextContents(), ['批次302']);
  await choose('全部批次');
  await refresh();
  assert.equal(await batch().locator('.ant-select-selection-item').innerText(), '全部批次');
  assert.equal(await titles().count(), 3);

  // Missing selected batch falls back to all and retains the other batches.
  await choose('批次302');
  data = data.filter(group => group.imgId !== 302);
  await refresh();
  assert.equal(await batch().locator('.ant-select-selection-item').innerText(), '全部批次');
  assert.deepEqual(await titles().allTextContents(), ['批次303', '批次301']);

  // A valid all-batches result must not be hidden by an empty dropdown response.
  dropdownEmpty = true;
  await refresh();
  assert.equal(await titles().count(), 2);
  assert.equal(await batch().locator('input').isEnabled(), true);
  fail = true;
  await refresh();
  await page.getByText('查询失败，请刷新重试', { exact: true }).waitFor();
  assert.equal(await titles().count(), 0);
  fail = false;
  await refresh();
  assert.equal(await titles().count(), 2);

  // A late result after resetting the business key cannot repopulate the old task.
  delay = true;
  await ctx.click(/^刷\s*新$/);
  await page.waitForFunction(() => document.querySelector('[aria-label="历史批次"] input')?.disabled === true);
  await ctx.click(/^重\s*置$/);
  await page.getByText('输入流程任务 Key 查询图片', { exact: true }).waitFor();
  release(); release = undefined;
  await page.waitForLoadState('networkidle');
  assert.equal(await titles().count(), 0);
  await page.getByPlaceholder('请输入流程任务 Key').fill(key);
  data = [];
  await ctx.click(/^查\s*询$/);
  await page.getByText('该流程任务暂无生成批次', { exact: true }).waitFor();
  await ready();
  assert.equal(await batch().locator('.ant-select-selection-item').innerText(), '全部批次');
  assert.equal(await page.getByRole('button', { name: '上传本地图片', exact: true }).isDisabled(), true);
  await ctx.finish();
  await fs.writeFile(new URL('./result.json', import.meta.url), JSON.stringify({ mode: 'mock-browser', verified: ['default all batches uses no imgId suffix and groups all returned batches', 'single batch uses imgId suffix', 'refresh preserves all/single selection', 'missing batch falls back to all', 'all results queried even when dropdown empty', 'failure retry and empty results', 'stale response after reset ignored', 'business key encoded; no all/undefined path'], calls, runtimeErrors: ctx.state.errors }, null, 2));
  console.log('PASS all batches and single batch image results');
} catch (error) {
  if (release) release();
  console.error(ctx.state.errors);
  await ctx.browser.close();
  throw error;
}
