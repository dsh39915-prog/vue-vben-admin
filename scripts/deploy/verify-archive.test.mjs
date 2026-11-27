import { createHash } from 'node:crypto';

import { zipSync } from 'fflate';
import { expect, it } from 'vitest';

import { verifyArchive } from './verify-archive.mjs';

const data = new TextEncoder().encode('release');
const files = [
  {
    path: 'js/app.js',
    bytes: data.length,
    sha256: createHash('sha256').update(data).digest('hex'),
  },
];
it('接受与 dist 内容一致的 ZIP', () => {
  expect(() =>
    verifyArchive(zipSync({ 'js/app.js': data }), files),
  ).not.toThrow();
});
it('拒绝无效或截断的 ZIP', () => {
  expect(() =>
    verifyArchive(new TextEncoder().encode('not-a-zip'), files),
  ).toThrow(/无法解析/);
  const archive = zipSync({ 'js/app.js': data });
  expect(() => verifyArchive(archive.subarray(0, -20), files)).toThrow(
    /无法解析/,
  );
});
it('拒绝缺失和多余文件', () => {
  expect(() => verifyArchive(zipSync({}), files)).toThrow(/文件列表不一致/);
  expect(() =>
    verifyArchive(zipSync({ 'js/app.js': data, 'old.js': data }), files),
  ).toThrow(/文件列表不一致/);
});
it('拒绝大小相同但内容不同的文件', () => {
  expect(() =>
    verifyArchive(
      zipSync({ 'js/app.js': new TextEncoder().encode('changed') }),
      files,
    ),
  ).toThrow(/内容不一致/);
});
