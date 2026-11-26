import { describe, expect, it } from 'vitest';

import { resourceDownloadUrl } from './resource-download';

describe('资源下载地址', () => {
  it('只生成固定同源代理路径，保留中文、空格和扩展名', () => {
    expect(resourceDownloadUrl('/ipa/测试 1.ipa')).toBe(
      '/resource-download/ipa/%E6%B5%8B%E8%AF%95%201.ipa',
    );
    expect(resourceDownloadUrl('plist/app.plist')).toBe(
      '/resource-download/plist/app.plist',
    );
  });
  it.each([
    '',
    '../secret',
    'app/%2e%2e/secret',
    'https://example.com/app.ipa',
    'app/%2fsecret',
    String.raw`app\secret`,
    'bad%XX',
    'file%00.ipa',
  ])('拒绝无效或越界资源路径：%s', (path) => {
    expect(resourceDownloadUrl(path)).toBe('');
  });
});
