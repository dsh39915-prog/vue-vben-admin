import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

if (!process.argv.includes('--execute')) {
  throw new Error('Pass --execute to import the isolated QA row and then delete only that test task.');
}
const base = process.env.LAUNCH_IMPORT_BASE_URL || 'http://192.168.0.140:48080/admin-api';
const token = process.env.LAUNCH_IMPORT_TOKEN || 'test1';
const fixture = JSON.parse(await fs.readFile(new URL('./fixtures/fixture.json', import.meta.url), 'utf8'));
assert.match(fixture.styleNo, /^QAIMP261021[A-F\d]{6}$/);
const calls = [];
const staleDeletedListIds = new Set();
async function call(path, options = {}) {
  const response = await fetch(base + '/flycowerp/newProductTask' + path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'tenant-id': '1', ...options.headers },
    signal: AbortSignal.timeout(120_000),
  });
  const body = await response.json();
  calls.push({ path, method: options.method || 'GET', httpStatus: response.status, code: body.code, msg: body.msg, data: path === '/page' ? body.data?.list?.filter(row => row.styleNo === fixture.styleNo).map(({ id, styleNo, flowStatus, procInstId }) => ({ id, styleNo, flowStatus, procInstId })) : body.data });
  return body;
}
async function lookup() {
  const body = await call('/page', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageNo: 1, pageSize: 200, styleNo: fixture.styleNo }),
  });
  async function existingRows(rows) {
    const existing = [];
    for (const row of rows.filter(row => row.styleNo === fixture.styleNo)) {
      const detail = await call('/get/' + row.id);
      assert.equal(detail.code, 0);
      if (detail.data === null) staleDeletedListIds.add(row.id);
      else existing.push(row);
    }
    return existing;
  }
  if (body.code === 0 && Array.isArray(body.data?.list))
    return existingRows(body.data.list);
  // Record the backend style-filter failure; fall back to a read-only full scan
  // so QA cleanup never depends on that filter behaving correctly.
  const matches = [];
  for (let pageNo = 1; ; pageNo++) {
    const page = await call('/page', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageNo, pageSize: 200 }),
    });
    assert.equal(page.code, 0);
    assert.ok(Array.isArray(page.data?.list));
    matches.push(...await existingRows(page.data.list));
    if (!page.data.list.length || pageNo * 200 >= page.data.total) return matches;
  }
}
const cleanupOnly = process.argv.includes('--cleanup-only');
const existing = await lookup();
if (!cleanupOnly) assert.deepEqual(existing, [], 'QA style must not already exist');
let result;
let importAttempted = cleanupOnly;
try {
 if (!cleanupOnly) {
  const bytes = await fs.readFile(process.env.LAUNCH_IMPORT_FIXTURE || new URL('./fixtures/single-qa-task.xlsx', import.meta.url));
  const data = new FormData();
  data.append('file', new File([bytes], 'single-qa-task.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  importAttempted = true;
  result = await call('/import', { method: 'POST', body: data });
  await fs.writeFile(new URL('./live-import-response.json', import.meta.url), JSON.stringify({ styleNo: fixture.styleNo, response: result }, null, 2));
  const rows = await lookup();
  assert.equal(result.code, 0, 'import response must succeed');
  assert.equal(typeof result.data, 'string');
  assert.equal(rows.length, 1, 'success must correspond to one persisted QA task');
  console.log('PASS real multipart import and readback of one isolated QA row');
 }
} finally {
  if (importAttempted) {
    const rows = await lookup();
    for (const task of rows) {
      assert.equal(task.styleNo, fixture.styleNo);
      if ([1, 2, 4].includes(task.flowStatus)) {
        const stopped = await call('/terminate/' + task.id, { method: 'PUT' });
        assert.equal(stopped.code, 0, 'terminate only the QA task before deletion');
      }
      const deleted = await call('/delete/' + task.id, { method: 'DELETE' });
      assert.equal(deleted.code, 0, 'QA cleanup must succeed');
      assert.equal(deleted.data, true);
    }
    const remaining = await lookup();
    const evidenceFile = cleanupOnly ? './live-cleanup-result.json' : process.env.LAUNCH_IMPORT_EXACT_TEMPLATE ? './live-exact-template-result.json' : './live-result.json';
    await fs.writeFile(new URL(evidenceFile, import.meta.url), JSON.stringify({ mode: 'live-single-qa-row', fixture, exactTemplateStructure: Boolean(process.env.LAUNCH_IMPORT_EXACT_TEMPLATE), importResponse: result, remainingQaTasks: remaining.length, staleDeletedListIds: [...staleDeletedListIds], calls }, null, 2));
    assert.equal(remaining.length, 0, 'QA row must be removed');
    console.log('PASS QA details confirm deletion; original workbook and business rows were not imported; stale deleted list IDs: ' + [...staleDeletedListIds].join(','));
  }
}
