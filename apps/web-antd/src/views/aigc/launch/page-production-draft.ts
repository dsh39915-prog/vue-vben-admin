import type { WorkflowImage, WorkflowRemark } from '#/api';

export interface PageProductionDraft {
  version: 1;
  formType: 'pageProduction';
  styles: {
    styleId: string;
    mainImageSlots: (null | WorkflowImage)[];
    productDetailImageUrls: WorkflowImage[];
  }[];
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
    ) &&
    (value.imageId === undefined || typeof value.imageId === 'string')
  );
}
function images(value: unknown): value is WorkflowImage[] {
  return Array.isArray(value) && value.every(image);
}

/** Preserve empty main-image slots so an incomplete draft keeps its order. */
export function readPageProductionDraft(
  raw: null | string,
): PageProductionDraft | undefined {
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
    value.formType !== 'pageProduction' ||
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
      !Array.isArray(style.mainImageSlots) ||
      style.mainImageSlots.length !== 5 ||
      !style.mainImageSlots.every((item) => item === null || image(item)) ||
      !images(style.productDetailImageUrls)
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
  return value as unknown as PageProductionDraft;
}
