/** 固定同源代理，下载域名和 attachment 响应头由服务器控制。 */
export function resourceDownloadUrl(path: string) {
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
    return `/resource-download/${encoded.join('/')}`;
  } catch {
    return '';
  }
}
