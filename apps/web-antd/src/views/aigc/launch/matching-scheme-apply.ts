import type { MatchingScheme, ProductStyle } from '#/api';

import {
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

/** Combine only the confirmed model/action outputs; preserve occupied fields. */
export function applyStyleAiImages(
  target: MatchingScheme,
  source: ProductStyle,
) {
  const seen = new Set<string>();
  const images = [
    ...(source.aiModelImageUrls ?? []),
    ...(source.aiActionImageUrls ?? []),
  ].filter((image) => {
    if (!image.originalUrl || seen.has(image.originalUrl)) return false;
    seen.add(image.originalUrl);
    return true;
  });
  return fillEmptySchemeImages(target, {
    styleNo: target.styleNo,
    styleName: target.styleName,
    hasOtherStyle: target.hasOtherStyle,
    clothingProductUrls: [],
    aiGeneratedImageUrls: images.map((image) => ({
      originalUrl: image.originalUrl,
      previewUrl: image.previewUrl,
      thumbnailUrl: image.thumbnailUrl,
      styleNo: source.styleNo,
      isMain: 0,
    })),
  });
}
