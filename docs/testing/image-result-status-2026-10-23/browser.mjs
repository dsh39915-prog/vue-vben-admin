import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';

const ctx = await setup({ permissions: ['flycowerp:drawing:aiImageModelTask', 'flycowerp:drawing:aiImageActionTask'], userId: 7, roles: [] });
const { page } = ctx;
const calls = [];
const image = name => ({ originalUrl: `https://example.test/${name}.png`, previewUrl: `https://example.test/${name}-preview.png`, thumbnailUrl: `https://example.test/${name}-thumb.png` });
let nodeKey = 'aiImageModelTask';
let sourcePage = 5;
let groups = [];
let generated;
let failPoll = false;
const task = () => ({ id: 88, styleNo: 'QA-GENERATING', procInstId: 'qa-generating', currentNodeKey: nodeKey, currentNodeName: nodeKey, currentNodeTaskId: '9007199254740993123', currentNodeAssigneeId: '7', currentNodeStatus: 2, flowStatus: 2 });
const style = { id: '9007199254740993101', styleNo: 'QA-GENERATING', styleName: '红色', clothingProductUrl: image('clothing') };
await page.route('**/admin-api/flycowerp/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const endpoint = url.pathname.split('/flycowerp/')[1];
  const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null;
  calls.push({ endpoint, body, query: Object.fromEntries(url.searchParams) });
  let data;
  if (endpoint === 'newProductTask/page') data = { list: [task()], total: 1 };
  else if (endpoint === 'newProductTask/get/88') data = task();
  else if (endpoint === 'newProductStyle/list' || endpoint === 'newProductStyle/queryMatchStyleList') data = [style];
  else if (endpoint === 'aiMatchingScheme/list') data = [];
  else if (endpoint === 'flow/draft/get') data = null;
  else if (endpoint === 'aiModel/page') data = { records: ctx.state.models.filter(model => model.modelType === 0), total: 3 };
  else if (endpoint === 'aiModel/sizeConfig') data = { qualities: [{ quality: '2K', sizes: [{ size: '1536x2048', aspectRatio: '3:4' }] }] };
  else if (endpoint === 'aiPromptCategory/page') data = [];
  else if (endpoint === 'aiPrompt/page') data = { records: [], total: 0 };
  else if (endpoint.startsWith('aiImageResult/dropdown/')) {
    assert.equal(url.searchParams.get('sourcePage'), String(sourcePage));
    data = groups.map(({ imgId, name }) => ({ imgId, name }));
  } else if (endpoint.startsWith('aiImageResult/list/')) {
    assert.equal(endpoint.split('/').at(-1), style.id);
    assert.equal(url.searchParams.get('sourcePage'), String(sourcePage));
    if (failPoll) return route.fulfill({ json: { code: 500, msg: '模拟自动更新失败' } });
    data = groups.filter(group => !url.searchParams.has('imgId') || group.imgId === Number(url.searchParams.get('imgId')));
  } else if (endpoint === 'aiImg/save') {
    assert.equal(body.sourcePage, sourcePage);
    assert.equal(body.styleId, style.id);
    generated = { imgId: 99, name: '新生成批次', sourcePage, status: 0, createTime: '2026-10-23 14:30:00', list: [] };
    groups.unshift(generated);
    data = 99;
  } else throw new Error(`Unexpected endpoint: ${endpoint}`);
  await route.fulfill({ json: { code: 0, data } });
});
const batch = name => page.locator('.result-batch').filter({ has: page.locator('.ant-card-head-title').getByText(name, { exact: true }) });
const resultCount = () => calls.filter(call => call.endpoint.startsWith('aiImageResult/list/')).length;
async function refresh() { await ctx.click(/^刷\s*新$/, page.locator('.ant-card').filter({ has: page.getByText('生成结果与历史', { exact: true }) }).last()); }
async function waitForQuery(before) {
  for (let i = 0; i < 160 && resultCount() === before; i++) await page.waitForTimeout(50);
  assert.ok(resultCount() > before, 'pending batches automatically refresh');
}
const verified = [];
try {
  for (const [key, source, label] of [['aiImageModelTask', 5, '模特图'], ['aiImageActionTask', 6, '动作图']]) {
    nodeKey = key; sourcePage = source; failPoll = false;
    groups = [2, 3, 4, 5, undefined].map((status, index) => ({ imgId: index + 1, name: `历史批次${index + 1}`, sourcePage, status, list: [] }));
    await ctx.navigate(`/drawing/${nodeKey}?taskId=88`);
    await batch('历史批次1').getByText('生成已完成', { exact: true }).waitFor();
    await batch('历史批次2').getByText('图片生成失败', { exact: true }).waitFor();
    await batch('历史批次3').getByText('生成任务已取消', { exact: true }).waitFor();
    await batch('历史批次4').getByText('参数已暂存', { exact: true }).waitFor();
    await batch('历史批次5').getByText('暂无图片', { exact: true }).waitFor();
    const editor = page.locator('.embedded-image-editor');
    const prompt = editor.locator('.ant-form-item').filter({ has: page.locator('.ant-form-item-label').getByText('提示词', { exact: true }) });
    await prompt.locator('textarea').fill(`生成${label}测试`);
    await ctx.click(`立即生成（${label}）`, editor);
    await batch('新生成批次').getByText('等待生成', { exact: true }).waitFor();
    assert.equal(await batch('新生成批次').getByText('暂无图片', { exact: true }).count(), 0);
    assert.equal(await batch('新生成批次').locator('.ant-tag').first().textContent().then(text => text.trim()), '等待中', 'status zero is preserved');
    generated.status = 1;
    await batch('新生成批次').getByText('图片生成中', { exact: true }).waitFor();
    await batch('新生成批次').getByText(`AI 正在生成${label}，完成后将在这里展示。`, { exact: true }).waitFor();
    await batch('新生成批次').screenshot({ path: fileURLToPath(new URL(`./${source}-generating.png`, import.meta.url)) });
    const panel = batch('新生成批次').locator('.batch-status-panel');
    assert.ok(await panel.evaluate(el => el.scrollWidth <= el.clientWidth), 'status panel has no overflow');
    generated.list = [{ id: 901, isAiCreate: 1, ...image(`result-${source}-1`) }];
    await batch('新生成批次').getByRole('checkbox', { name: '选择结果 901', exact: true }).waitFor();
    await batch('新生成批次').getByRole('checkbox', { name: '选择结果 901', exact: true }).check();
    generated.status = 2;
    generated.list.push({ id: 902, isAiCreate: 1, ...image(`result-${source}-2`) });
    await batch('新生成批次').getByRole('checkbox', { name: '选择结果 902', exact: true }).waitFor();
    assert.equal(await batch('新生成批次').getByRole('checkbox', { name: '选择结果 901', exact: true }).isChecked(), true);
    assert.equal(await batch('新生成批次').locator('.batch-status-panel').count(), 0);
    const terminalCount = resultCount();
    await page.waitForTimeout(5500);
    assert.equal(resultCount(), terminalCount, 'terminal batches stop polling');
    generated.status = 1;
    await refresh();
    await batch('新生成批次').locator('.batch-progress').waitFor();
    failPoll = true;
    await page.getByText('自动更新已暂停，请点击刷新重试', { exact: true }).waitFor();
    assert.equal(await batch('新生成批次').getByRole('checkbox', { name: '选择结果 901', exact: true }).isChecked(), true);
    assert.equal(await batch('新生成批次').locator('.ant-image').count(), 2);
    failPoll = false; generated.status = 2;
    await refresh();
    await batch('新生成批次').locator('.ant-tag').filter({ hasText: /^成功$/ }).waitFor();
    assert.equal(await page.getByText('自动更新已暂停，请点击刷新重试', { exact: true }).count(), 0);
    verified.push(`${label}: real generation action refreshes queued batch; generating/partial/success transitions; all terminal and missing statuses; preserves selections; polling stops; failed poll retains results and manual refresh recovers`);
  }
  await ctx.finish();
  await fs.writeFile(new URL('./result.json', import.meta.url), JSON.stringify({ mode: 'mock-browser', verified, runtimeErrors: ctx.state.errors, calls }, null, 2));
  console.log('PASS model and action generation batch statuses, polling and selection preservation');
} catch (error) {
  console.error(ctx.state.errors);
  await ctx.browser.close();
  throw error;
}
