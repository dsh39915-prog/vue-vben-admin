const downloadPrefixes = {
  path: 'https://d-app6.i4.cn/soft/',
  plist: 'https://dl.i4.cn/sslplist/',
} as const;

/** 按分享包资源字段拼接直连下载地址。 */
export function resourceDownloadUrl(
  path: string,
  field: 'path' | 'plist' = 'path',
) {
  try {
    const segments = path.trim().replace(/^\/+/, '').split('/');
    if (segments.length === 0) return '';
    const encoded: string[] = [];
    for (const segment of segments) {
      const value = decodeURIComponent(segment);
      if (
        !value ||
        value === '.' ||
        value === '..' ||
        /[\\/:]/.test(value) ||
        [...value].some((character) => (character.codePointAt(0) ?? 0) < 32)
      )
        return '';
      encoded.push(encodeURIComponent(value));
    }
    return `${downloadPrefixes[field]}${encoded.join('/')}`;
  } catch {
    return '';
  }
}
