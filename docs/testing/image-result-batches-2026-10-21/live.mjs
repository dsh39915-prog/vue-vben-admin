import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';

const base = 'http://192.168.0.140:48080';
const key = process.env.AIGC_BATCH_TEST_KEY || '88';
const token = process.env.AIGC_TEST_TOKEN || 'test1';
const read = endpoint => JSON.parse(execFileSync('curl.exe', ['--noproxy', '*', '-sS', '--connect-timeout', '8', '--max-time', '30', '-H', `Authorization: Bearer ${token}`, '-H', 'tenant-id: 1', base + endpoint], { encoding: 'utf8' }));
const results = [];
const prefix = '/admin-api/flycowerp/aiImageResult/';
const dropdown = read(prefix + 'dropdown/' + encodeURIComponent(key));
assert.equal(dropdown.code, 0);
assert.ok(Array.isArray(dropdown.data));
const batchId = dropdown.data[0]?.imgId ?? 1;
for (const endpoint of ['dropdown/' + encodeURIComponent(key), 'list/' + encodeURIComponent(key), 'list/' + encodeURIComponent(key) + '/' + batchId]) {
  const response = read(prefix + endpoint);
  assert.equal(response.code, 0);
  assert.ok(Array.isArray(response.data));
  results.push({ endpoint: prefix + endpoint, code: response.code, count: response.data.length, fields: Object.keys(response.data[0] ?? {}) });
}
await fs.writeFile(new URL('./live-result.json', import.meta.url), JSON.stringify({ base, mode: 'read-only', results }, null, 2));
console.log('PASS read-only dropdown, all batches and single batch queries');
