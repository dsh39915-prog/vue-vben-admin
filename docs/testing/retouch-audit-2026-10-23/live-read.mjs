import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setup, assert } from '../drawing-2026-10-20/scripts/codex-drawing-common.mjs';

const backend = 'http://192.168.0.140:48080';
const headers = { Authorization: 'Bearer test1', 'tenant-id': '1', 'Content-Type': 'application/json' };
const pageAudit = process.env.DRAWING_AUDIT_KIND === 'page';
const nodeKey = pageAudit ? 'pageProductionAudit' : 'retouchingAudit';
const title = pageAudit ? '页面审核' : '修图审核';
const output = new URL(pageAudit ? '../page-audit-2026-10-23/' : './', import.meta.url);
await fs.mkdir(output, { recursive: true });
const ctx = await setup();
const { page } = ctx;
const evidence = { mode: 'live-read-only', backend, nodeKey, responses: [], runtimeErrors: ctx.state.errors };
await page.route('**/admin-api/system/user/simple-list', route => route.fulfill({ json: { code: 0, data: [] } }));
await page.route('**/admin-api/flycowerp/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const endpoint = url.pathname.split('/flycowerp/')[1];
  const readPage = endpoint === 'newProductTask/page' && request.method() === 'POST';
  const readStyles = endpoint === 'newProductStyle/list' && request.method() === 'GET';
  if (!readPage && !readStyles) {
    await route.abort();
    throw new Error(`Unexpected API in read-only verification: ${request.method()} ${endpoint}`);
  }
  const response = await fetch(`${backend}${url.pathname}${url.search}`, {
    method: request.method(), headers,
    body: readPage ? request.postData() : undefined,
    signal: AbortSignal.timeout(25000),
  });
  assert.equal(response.ok, true);
  const json = await response.json();
  assert.equal(json.code, 0);
  evidence.responses.push({ endpoint, query: Object.fromEntries(url.searchParams), json });
  await route.fulfill({ json });
});
try {
  await ctx.navigate(`/drawing/${nodeKey}`);
  await ctx.row('JJG64901').waitFor();
  await ctx.click('审核', ctx.row('JJG64901'));
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  const groups = pageAudit ? {
    productMainImageUrls: dialog.locator('.ant-collapse-item-active [data-audit-image-group="商品主图"]'),
    productDetailImageUrls: dialog.locator('.ant-collapse-item-active [data-audit-image-group="详情页图"]'),
  } : {
    retouchedModelImageUrls: dialog.locator('.ant-collapse-item-active [data-retouch-group="精修模特图"]'),
    retouchedActionImageUrls: dialog.locator('.ant-collapse-item-active [data-retouch-group="精修动作图"]'),
  };
  await Object.values(groups)[0].locator('img').first().waitFor();
  const styles = evidence.responses.findLast(response => response.endpoint === 'newProductStyle/list').json.data;
  assert.equal(styles[0].styleNo, 'JJG64901');
  for (const [field, group] of Object.entries(groups)) {
    assert.ok(styles[0][field].length > 0);
    assert.equal(await group.locator('img').count(), styles[0][field].length);
    for (const [index, image] of styles[0][field].entries()) {
      assert.equal(await group.locator('img').nth(index).getAttribute('src'), image.previewUrl);
      await group.locator('img').nth(index).evaluate(image => image.decode());
      assert.ok(await group.locator('img').nth(index).evaluate(image => image.naturalWidth > 0));
    }
  }
  assert.equal(evidence.responses.some(response => response.endpoint.includes('draft')), false);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.screenshot({ path: fileURLToPath(new URL('live-read.png', output)) });
  await ctx.click('取消', dialog);
  await dialog.waitFor({ state: 'hidden' });
  await ctx.finish();
  await fs.writeFile(new URL('live-read-result.json', output), JSON.stringify(evidence, null, 2));
  console.log(`PASS live-read ${title}: task 12, submitted images loaded and decoded; no workflow writes`);
} catch (error) {
  console.error(ctx.state.errors);
  await ctx.browser.close();
  throw error;
}
