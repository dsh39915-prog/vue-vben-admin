import type { MatchingScheme, ProductStyle } from '#/api';

import {
  decodeScheme,
  schemeImageFields,
  schemeImages,
  setSchemeImages,
} from './workflow-helpers';

/** Reuse only empty image fields; retain task identity and selected clothing. */
export function fillEmptySchemeImages(
  target: MatchingScheme,
  source: MatchingScheme,
) {
  let filled = 0;
  for (const field of schemeImageFields) {
    if (field.key === 'clothingProductUrls') continue;
    const current = schemeImages(target, field.key);
    if (
      current.some(
        (image) => image.originalUrl || image.previewUrl || image.thumbnailUrl,
      )
    )
      continue;
    const images = schemeImages(source, field.key);
    if (!images.length) continue;
    setSchemeImages(
      target,
      field.key,
      images.map((image) => ({ ...image })),
    );
    filled += 1;
  }
  return filled;
}

/** Fill missing materials and append AI selections, retaining existing images. */
export function applyStyleAiImages(
  target: MatchingScheme,
  source: ProductStyle,
) {
  // Decode every source field before mutating the target, so malformed data cannot
  // leave a partially applied scheme behind.
  const scheme = source.aiMatchingScheme
    ? decodeScheme({
        ...source.aiMatchingScheme,
        styleNo: source.styleNo,
        styleName: source.styleName,
      })
    : undefined;
  let filled = scheme
    ? fillEmptySchemeImages(target, { ...scheme, aiGeneratedImageUrls: [] })
    : 0;
  const current = target.aiGeneratedImageUrls ?? [];
  const seen = new Set(current.map((image) => image.originalUrl));
  // Prefer the source scheme's selected images; use raw outputs only when that
  // scheme has no AI selections. Existing target selections must not block reuse.
  const selected = scheme?.aiGeneratedImageUrls ?? [];
  const images = (
    selected.length
      ? selected
      : [
          ...(source.aiModelImageUrls ?? []),
          ...(source.aiActionImageUrls ?? []),
        ].map((image) => ({
          originalUrl: image.originalUrl,
          previewUrl: image.previewUrl,
          thumbnailUrl: image.thumbnailUrl,
          styleNo: source.styleNo,
          isMain: 0,
        }))
  ).filter((image) => {
    if (!image.originalUrl || seen.has(image.originalUrl)) return false;
    seen.add(image.originalUrl);
    return true;
  });
  if (images.length) {
    target.aiGeneratedImageUrls = [
      ...current,
      ...images.map((image) => ({ ...image })),
    ];
    filled += 1;
  }
  return filled;
}
