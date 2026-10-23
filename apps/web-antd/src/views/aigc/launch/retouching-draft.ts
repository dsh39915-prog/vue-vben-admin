import type { WorkflowImage, WorkflowRemark } from '#/api';

export interface RetouchingDraft {
  version: 1;
  formType: 'retouching';
  styles: {
    styleId: string;
    retouchedModelImageUrls: WorkflowImage[];
    retouchedActionImageUrls: WorkflowImage[];
  }[];
  remarkInfoVO: WorkflowRemark;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function images(value: unknown): value is WorkflowImage[] {
  return (
    Array.isArray(value) &&
    value.every(
      (image) =>
        record(image) &&
        ['originalUrl', 'previewUrl', 'thumbnailUrl'].every(
          (key) => typeof image[key] === 'string',
        ) &&
        (image.imageId === undefined || typeof image.imageId === 'string'),
    )
  );
}

/** Validate stored structure while allowing incomplete forms. */
export function readRetouchingDraft(
  raw: null | string,
): RetouchingDraft | undefined {
  if (!raw?.trim()) return;
  const invalid = () =>
    new Error('草稿数据格式不正确，暂不能编辑或覆盖，请联系管理员检查');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw invalid();
  }
  if (
    !record(value) ||
    value.version !== 1 ||
    value.formType !== 'retouching' ||
    !Array.isArray(value.styles) ||
    !record(value.remarkInfoVO)
  )
    throw invalid();
  const seen = new Set<string>();
  for (const style of value.styles) {
    if (
      !record(style) ||
      typeof style.styleId !== 'string' ||
      !style.styleId.trim() ||
      seen.has(style.styleId) ||
      !images(style.retouchedModelImageUrls) ||
      !images(style.retouchedActionImageUrls)
    )
      throw invalid();
    seen.add(style.styleId);
  }
  const remark = value.remarkInfoVO;
  if (
    (remark.contentText !== undefined &&
      typeof remark.contentText !== 'string') ||
    (remark.imageUrls !== undefined && !images(remark.imageUrls))
  )
    throw invalid();
  return value as unknown as RetouchingDraft;
}
