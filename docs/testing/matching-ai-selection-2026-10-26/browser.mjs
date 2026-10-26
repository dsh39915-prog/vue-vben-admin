import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';

const ctx = await setup();
const { page } = ctx;
const image = name => ({ originalUrl: `https://example.test/${name}.png`, previewUrl: `https://example.test/${name}-preview.png`, thumbnailUrl: `https://example.test/${name}-thumb.png`, imageId: name });
const task = { id: 88, styleNo: 'QA-AI', procInstId: 'qa-ai-proc', currentNodeKey: 'aiMatchingOutput', currentNodeName: 'AI搭配方案输出', currentNodeTaskId: 'qa-ai-node', currentNodeAssigneeId: '1', currentNodeStatus: 2, flowStatus: 2 };
const styles = ['QA-AI', 'QA-EMPTY'].map((styleNo, index) => ({ id: `style-${index}`, styleNo, styleName: '红色', clothingProductUrl: image(`clothing-${index}`) }));
const schemes = styles.map((style, index) => ({ id: `scheme-${index}`, styleNo: style.styleNo, styleName: style.styleName, hasOtherStyle: false, aiMatchingImageUrl: image('scheme'), mainReferenceFrontUrl: image('front'), mainReferenceSideUrl: image('side'), mainReferenceBackUrl: image('back'), modelImageUrls: image('model'), sceneImageUrls: [image('scene')], clothingProductUrls: [{ ...style.clothingProductUrl, styleNo: style.styleNo, isMain: 1 }] }));
const calls = [];
let draftJson = null;
let failEmpty = false;
let visible = true;
let submitted;
await page.route('**/admin-api/system/user/simple-list', route => route.fulfill({ json: { code: 0, data: [] } }));
await page.route('**/admin-api/flycowerp/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const endpoint = url.pathname.split('/flycowerp/')[1];
  const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null;
  calls.push({ endpoint, body, query: Object.fromEntries(url.searchParams) });
  let data;
  if (endpoint === 'newProductTask/page') data = { list: visible ? [task] : [], total: visible ? 1 : 0 };
  else if (endpoint === 'newProductTask/get/88') data = task;
  else if (endpoint === 'newProductStyle/list') data = styles;
  else if (endpoint === 'aiMatchingScheme/list') data = schemes;
  else if (endpoint === 'flow/draft/get') data = draftJson;
  else if (endpoint === 'flow/draft/save') {
    draftJson = body.formDataJson;
    data = 'draft-id';
  } else if (endpoint === 'aiMatchingScheme/save') {
    assert.equal(body.status, 1);
    submitted = body;
    visible = false;
    data = ['scheme-0', 'scheme-1'];
  } else if (endpoint === 'newProductStyle/queryMatchStyleList') {
    assert.equal(request.method(), 'GET');
    const styleNo = url.searchParams.get('styleNo');
    assert.deepEqual(Object.keys(Object.fromEntries(url.searchParams)), ['styleNo']);
    assert.ok(styles.some(style => style.styleNo === styleNo));
    if (styleNo === 'QA-EMPTY' && failEmpty) return route.fulfill({ json: { code: 500, msg: 'AI历史读取失败' } });
    data = styleNo === 'QA-EMPTY' ? [styles[1]] : [
      { ...styles[0], aiModelImageUrls: JSON.stringify([image('generated-model')]), aiActionImageUrls: [image('generated-model'), image('generated-action')] },
      { ...styles[0], styleNo: 'QA-AI-OTHER', aiModelImageUrls: [image('wrong-style')] },
    ];
  } else throw new Error(`Unexpected API: ${endpoint}`);
  await route.fulfill({ json: { code: 0, data } });
});
const modal = () => page.getByRole('dialog').filter({ has: page.getByText('任务款号：QA-AI', { exact: false }) });
const fields = () => modal().locator('[data-scheme-ai-images]');
const checkboxes = () => fields().first().getByRole('checkbox');
async function open() {
  await ctx.click(/^提\s*交$/, ctx.row(task.styleNo));
  await fields().first().locator('img[src*="generated-action-thumb"]').waitFor();
  await checkboxes().first().waitFor();
}
async function close() {
  await modal().getByRole('button', { name: 'Close', exact: true }).click();
  await modal().waitFor({ state: 'hidden' });
}
try {
  await ctx.navigate('/drawing/aiMatchingOutput');
  await open();
  await fields().nth(1).getByText('暂无ai生成内容', { exact: true }).waitFor();
  assert.equal(await fields().first().locator('img').count(), 2, 'deduplicate model/action outputs and exclude fuzzy matches');
  assert.equal(await fields().locator('input[type=file]').count(), 0);
  assert.equal(await fields().getByRole('button', { name: /上传|替换|移除/ }).count(), 0);
  assert.equal(await checkboxes().count(), 2);
  assert.equal(await checkboxes().first().isChecked(), false);
  assert.equal(await checkboxes().nth(1).isChecked(), false);
  assert.equal(await fields().first().getByRole('link', { name: '查看原图' }).first().getAttribute('href'), image('generated-model').originalUrl);
  await checkboxes().first().check();
  await checkboxes().nth(1).check();
  await checkboxes().first().uncheck();
  assert.equal(await checkboxes().count(), 2, 'unchecking keeps the candidate available');
  await ctx.click('保存方案', modal());
  await page.getByText('搭配方案已保存', { exact: true }).last().waitFor();
  const draft = JSON.parse(draftJson);
  const expected = name => ({ originalUrl: image(name).originalUrl, previewUrl: image(name).previewUrl, thumbnailUrl: image(name).thumbnailUrl, styleNo: 'QA-AI', isMain: 0 });
  assert.deepEqual(draft.schemes[0].aiGeneratedImageUrls, [expected('generated-action')]);
  assert.equal(draft.schemes[1].aiGeneratedImageUrls?.length ?? 0, 0);
  await close();
  failEmpty = true;
  await open();
  await fields().nth(1).getByText('AI生成内容加载失败，请重试', { exact: true }).waitFor();
  assert.equal(await fields().nth(1).getByText('暂无ai生成内容', { exact: true }).count(), 0, 'errors are not presented as empty history');
  assert.equal(await checkboxes().first().isChecked(), false);
  assert.equal(await checkboxes().nth(1).isChecked(), true, 'restore draft selections');
  failEmpty = false;
  await fields().nth(1).getByRole('button', { name: /^重\s*试$/, exact: true }).click();
  await fields().nth(1).getByText('暂无ai生成内容', { exact: true }).waitFor();
  await checkboxes().nth(1).uncheck();
  await checkboxes().first().check();
  await ctx.click('提交方案', modal());
  await ctx.confirm();
  await modal().waitFor({ state: 'hidden' });
  assert.deepEqual(submitted.schemes[0].aiGeneratedImageUrls, [expected('generated-model')]);
  assert.equal(submitted.schemes[1].aiGeneratedImageUrls?.length ?? 0, 0);
  assert.equal(calls.some(call => /upload/i.test(call.endpoint)), false);
  await ctx.finish();
  console.log('PASS: exact style AI history, deduplicated checkbox choices, empty/error/retry states, no upload, draft restoration, selected-only submission; zero real writes.');
} catch (error) {
  console.error(ctx.state.errors);
  console.error((await page.locator('body').innerText()).slice(-6000));
  await ctx.browser.close();
  throw error;
}
