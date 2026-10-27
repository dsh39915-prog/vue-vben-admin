import type { MatchingSchemeOrigin } from './matching-scheme-sources';

import type { MatchingScheme, WorkflowImage, WorkflowRemark } from '#/api';

import { schemeImageFields } from './workflow-helpers';

export interface MatchingSchemeDraft {
  version: 1;
  formType: 'aiMatchingOutput';
  schemes: MatchingScheme[];
  origins?: MatchingSchemeOrigin[];
  remarkInfoVO: WorkflowRemark;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function image(value: unknown): value is WorkflowImage {
  return (
    record(value) &&
    ['originalUrl', 'previewUrl', 'thumbnailUrl'].every(
      (key) => typeof value[key] === 'string',
    )
  );
}
function images(value: unknown): value is WorkflowImage[] {
  return Array.isArray(value) && value.every(image);
}

/** Validate stored types only; incomplete business fields are valid drafts. */
export function readMatchingSchemeDraft(
  raw: null | string,
): MatchingSchemeDraft | undefined {
  if (!raw?.trim()) return;
  const invalid = () =>
    new Error('方案草稿数据格式不正确，暂不能编辑或覆盖，请联系管理员检查');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw invalid();
  }
  if (
    !record(value) ||
    value.version !== 1 ||
    value.formType !== 'aiMatchingOutput' ||
    !Array.isArray(value.schemes) ||
    !record(value.remarkInfoVO)
  )
    throw invalid();
  for (const scheme of value.schemes) {
    if (
      !record(scheme) ||
      typeof scheme.styleNo !== 'string' ||
      typeof scheme.styleName !== 'string' ||
      typeof scheme.hasOtherStyle !== 'boolean' ||
      !images(scheme.clothingProductUrls) ||
      !schemeImageFields.every((field) => {
        const stored = scheme[field.key];
        return (
          stored === undefined ||
          ('multiple' in field ? images(stored) : image(stored))
        );
      })
    )
      throw invalid();
  }
  const remark = value.remarkInfoVO;
  if (value.origins !== undefined) {
    if (
      !Array.isArray(value.origins) ||
      value.origins.length !== value.schemes.length ||
      !value.origins.every(
        (origin) =>
          record(origin) &&
          typeof origin.key === 'string' &&
          Boolean(origin.key.trim()) &&
          typeof origin.manuallyAdded === 'boolean' &&
          (typeof origin.sourceStyleId === 'string'
            ? Boolean(origin.sourceStyleId.trim())
            : Number.isSafeInteger(origin.sourceStyleId)),
      ) ||
      new Set(value.origins.map((origin) => origin.key)).size !==
        value.origins.length
    )
      throw invalid();
  }
  if (
    (remark.contentText !== undefined &&
      typeof remark.contentText !== 'string') ||
    (remark.imageUrls !== undefined && !images(remark.imageUrls))
  )
    throw invalid();
  return value as unknown as MatchingSchemeDraft;
}
