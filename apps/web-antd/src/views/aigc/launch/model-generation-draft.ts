import type { AiImageFormValues, WorkflowImage, WorkflowRemark } from '#/api';

export type ImageGenerationNodeKey = 'aiImageActionTask' | 'aiImageModelTask';

export interface ModelGenerationDraft {
  version: 1;
  formType: ImageGenerationNodeKey;
  activeStyleId?: string;
  styles: {
    styleId: string;
    generation: Partial<AiImageFormValues>;
    selectedImages: WorkflowImage[];
    historyBatchId?: 'all' | number;
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
        ),
    )
  );
}
function generation(value: unknown): value is Partial<AiImageFormValues> {
  if (!record(value)) return false;
  const strings = [
    'aspectRatio',
    'styleNo',
    'styleId',
    'prompt',
    'originalImg',
    'previewOriginalImg',
    'smallOriginalImg',
    'referenceImg',
    'previewReferenceImg',
    'smallReferenceImg',
    'quality',
    'size',
  ];
  const numbers = ['id', 'aiModelId', 'promptId', 'promptType'];
  return (
    strings.every(
      (key) => value[key] === undefined || typeof value[key] === 'string',
    ) &&
    numbers.every(
      (key) =>
        value[key] === undefined ||
        (typeof value[key] === 'number' && Number.isFinite(value[key])),
    ) &&
    (value.num === undefined ||
      value.num === null ||
      (typeof value.num === 'number' && Number.isFinite(value.num))) &&
    ['status', 'type'].every(
      (key) => value[key] === undefined || value[key] === 0 || value[key] === 1,
    )
  );
}

/** Check stored structure, without requiring any business fields to be filled. */
export function readModelGenerationDraft(
  raw: null | string,
  nodeKey: ImageGenerationNodeKey = 'aiImageModelTask',
): ModelGenerationDraft | undefined {
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
    value.formType !== nodeKey ||
    !Array.isArray(value.styles) ||
    !record(value.remarkInfoVO) ||
    (value.activeStyleId !== undefined &&
      typeof value.activeStyleId !== 'string')
  )
    throw invalid();
  const seen = new Set<string>();
  for (const style of value.styles) {
    if (
      !record(style) ||
      typeof style.styleId !== 'string' ||
      !style.styleId.trim() ||
      seen.has(style.styleId) ||
      !generation(style.generation) ||
      !images(style.selectedImages) ||
      (style.historyBatchId !== undefined &&
        style.historyBatchId !== 'all' &&
        !(
          typeof style.historyBatchId === 'number' &&
          Number.isSafeInteger(style.historyBatchId) &&
          style.historyBatchId > 0
        ))
    )
      throw invalid();
    // Legacy drafts used goodsCode; the editor restores styleNo from the style.
    Reflect.deleteProperty(style.generation, 'goodsCode');
    seen.add(style.styleId);
  }
  const remark = value.remarkInfoVO;
  if (
    (remark.contentText !== undefined &&
      typeof remark.contentText !== 'string') ||
    (remark.imageUrls !== undefined && !images(remark.imageUrls))
  )
    throw invalid();
  return value as unknown as ModelGenerationDraft;
}
