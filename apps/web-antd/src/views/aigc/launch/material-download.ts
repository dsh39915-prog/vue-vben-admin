import type { RequestResponse } from '@vben/request';

import { downloadFileFromBlob } from '@vben/utils';

export class MaterialDownloadError extends Error {
  override name = 'MaterialDownloadError';
}

function responseFileName(disposition: string): string | undefined {
  const encoded = /filename\*\s*=\s*(?:"([^"]*)"|([^;]*))/i.exec(disposition);
  const value = encoded?.[1] ?? encoded?.[2];
  const extended = value && /^UTF-8'[^']*'(.*)$/i.exec(value.trim());
  if (extended?.[1]) {
    try {
      return decodeURIComponent(extended[1]);
    } catch {
      // Fall back to the ordinary filename when extended encoding is invalid.
    }
  }
  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]*))/i.exec(disposition);
  return (plain?.[1] ?? plain?.[2])?.trim();
}

export async function saveStyleMaterialFile(
  response: RequestResponse<Blob>,
  fallbackName: string,
) {
  const blob = response.data;
  if (!(blob instanceof Blob) || !blob.size) {
    throw new MaterialDownloadError('未收到有效素材文件，请稍后重试');
  }
  const prefix = await blob.slice(0, 64).text();
  if (
    /json|text\/|html|xml/i.test(blob.type) ||
    /^[\s\uFEFF]*[<{[]/.test(prefix)
  ) {
    throw new MaterialDownloadError('接口未返回素材文件，请稍后重试');
  }
  const disposition = String(response.headers['content-disposition'] ?? '');
  const suppliedName = responseFileName(disposition)?.split(/[/\\]/).at(-1);
  const signature = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  const isZip =
    signature[0] === 0x50 &&
    signature[1] === 0x4b &&
    ((signature[2] === 3 && signature[3] === 4) ||
      (signature[2] === 5 && signature[3] === 6) ||
      (signature[2] === 7 && signature[3] === 8));
  const fileName =
    suppliedName && !['.', '..'].includes(suppliedName)
      ? suppliedName
      : fallbackName + (isZip ? '.zip' : '');
  downloadFileFromBlob({ source: blob, fileName });
}
