import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { unzipSync } from 'fflate';

/** 在内存中检查 ZIP 文件内容，不向文件系统解压。 */
export function verifyArchive(archive, files) {
  let entries;
  try {
    entries = unzipSync(archive);
  } catch (error) {
    throw new Error('发布压缩包无法解析，请重新构建', { cause: error });
  }
  const paths = Object.keys(entries).filter((path) => !path.endsWith('/'));
  assert.deepEqual(
    paths.toSorted(),
    files.map((file) => file.path).toSorted(),
    '发布压缩包与 dist 文件列表不一致，请重新构建',
  );
  for (const file of files) {
    const data = entries[file.path];
    assert.equal(data.length, file.bytes, `压缩包文件大小不一致：${file.path}`);
    assert.equal(
      createHash('sha256').update(data).digest('hex'),
      file.sha256,
      `压缩包文件内容不一致：${file.path}`,
    );
  }
}
