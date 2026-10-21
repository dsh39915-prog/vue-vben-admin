import type {
  LaunchTask,
  MatchingScheme,
  MatchingSchemeRecord,
  StyleImageField,
  WorkflowContext,
  WorkflowImage,
} from '#/api';

export const schemeImageFields = [
  {
    key: 'aiMatchingImageUrl',
    label: '搭配方案图',
    kind: 'temp',
    required: true,
  },
  {
    key: 'mainReferenceFrontUrl',
    label: '主参考图（正面）',
    kind: 'temp',
    required: true,
  },
  {
    key: 'mainReferenceSideUrl',
    label: '主参考图（侧面）',
    kind: 'temp',
    required: true,
  },
  {
    key: 'mainReferenceBackUrl',
    label: '主参考图（背面）',
    kind: 'temp',
    required: true,
  },
  { key: 'mainReferenceVisionUrl', label: '主参考图（展现力）', kind: 'temp' },
  {
    key: 'clothingProductUrls',
    label: '服装商品图',
    kind: 'style',
    multiple: true,
    required: true,
  },
  {
    key: 'fullBodyReferenceUrls',
    label: '全身参考图',
    kind: 'style',
    multiple: true,
  },
  { key: 'propImageUrls', label: '道具图', kind: 'base' },
  { key: 'modelImageUrls', label: '模特图', kind: 'base', required: true },
  {
    key: 'sceneImageUrls',
    label: '场景图',
    kind: 'base',
    multiple: true,
    required: true,
  },
  { key: 'lightReferenceUrl', label: '光线参考图', kind: 'temp' },
  { key: 'versionReferenceUrl', label: '版型参考图', kind: 'temp' },
  {
    key: 'otherReferenceUrls',
    label: '其他参考图',
    kind: 'temp',
    multiple: true,
  },
  {
    key: 'aiGeneratedImageUrls',
    label: 'AI生成图片',
    kind: 'style',
    multiple: true,
  },
] as const;
export type SchemeImageKey = (typeof schemeImageFields)[number]['key'];
export function getWorkflowContext(
  task?: LaunchTask,
): undefined | WorkflowContext {
  if (!task?.procInstId || !task.currentNodeTaskId || !task.currentNodeKey)
    return;
  return {
    procInstId: task.procInstId,
    nodeTaskId: task.currentNodeTaskId,
    nodeKey: task.currentNodeKey,
  };
}
export function canHandleTask(task?: LaunchTask) {
  return (
    Boolean(getWorkflowContext(task)) &&
    [1, 2].includes(task?.flowStatus ?? -1) &&
    ![3, 4, 5].includes(task?.currentNodeStatus ?? -1)
  );
}
export const auditNodeKeys = [
  'aiMatchingAudit',
  'aiImageModelAudit',
  'aiImageActionAudit',
  'retouchingAudit',
  'pageProductionAudit',
  'launchAudit',
];
export const assignNodeKeys = [
  'aiImageTaskDispatch',
  'retouchTaskDispatch',
  'pageTaskDispatch',
  'launchTaskDispatch',
];
export const styleFieldsByNode: Record<
  string,
  { key: StyleImageField; label: string; kind: 'base' | 'temp' }[]
> = {
  aiImageModelTask: [
    { key: 'aiModelImageUrls', label: 'AI模特图', kind: 'base' },
  ],
  aiImageActionTask: [
    { key: 'aiActionImageUrls', label: 'AI动作图', kind: 'temp' },
  ],
  retouching: [
    { key: 'retouchedModelImageUrls', label: '精修模特图', kind: 'temp' },
    { key: 'retouchedActionImageUrls', label: '精修动作图', kind: 'temp' },
  ],
  pageProduction: [
    { key: 'productMainImageUrls', label: '商品主图', kind: 'temp' },
    { key: 'productDetailImageUrls', label: '详情页图', kind: 'temp' },
  ],
};
function decodeImages(value: unknown): WorkflowImage[] {
  if (value === null || value === undefined || value === '' || value === 'null')
    return [];
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value))
      return [{ originalUrl: value, previewUrl: value, thumbnailUrl: value }];
    return decodeImages(JSON.parse(value));
  }
  const items = Array.isArray(value) ? value : [value];
  return items.map((item) => {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.originalUrl !== 'string'
    )
      throw new Error('图片数据格式不正确');
    return {
      ...item,
      previewUrl: item.previewUrl || item.originalUrl,
      thumbnailUrl: item.thumbnailUrl || item.previewUrl || item.originalUrl,
    } as WorkflowImage;
  });
}
export function decodeScheme(record: MatchingSchemeRecord): MatchingScheme {
  const result: MatchingScheme = {
    id: record.id,
    styleNo: record.styleNo,
    styleName: record.styleName,
    hasOtherStyle: Boolean(record.hasOtherStyle),
    clothingProductUrls: [],
  };
  for (const field of schemeImageFields) {
    try {
      const images = decodeImages(record[field.key]);
      if ('multiple' in field) {
        result[field.key] = images.map((image) => ({
          ...image,
          ...('styleNo' in image
            ? {}
            : field.kind === 'style'
              ? { styleNo: record.styleNo, isMain: 0 }
              : {}),
        }));
      } else result[field.key] = images[0];
    } catch {
      throw new Error(
        '方案 ' +
          (record.styleName || record.id || '') +
          '的' +
          field.label +
          '格式不正确，暂不能编辑',
      );
    }
  }
  return result;
}
export function schemeImages(
  scheme: MatchingScheme,
  key: SchemeImageKey,
): WorkflowImage[] {
  const value = scheme[key];
  return Array.isArray(value) ? value : value ? [value] : [];
}
export function setSchemeImages(
  scheme: MatchingScheme,
  key: SchemeImageKey,
  images: WorkflowImage[],
) {
  const field = schemeImageFields.find((item) => item.key === key)!;
  if ('multiple' in field)
    (scheme[key] as undefined | WorkflowImage[]) = images;
  else (scheme[key] as undefined | WorkflowImage) = images[0];
}
export function validateWorkflowImages(
  images: WorkflowImage[],
  kind: 'base' | 'style' | 'temp',
) {
  for (const image of images) {
    if (!image.originalUrl || !image.previewUrl || !image.thumbnailUrl)
      throw new Error('请重新上传地址不完整的图片');
    if (kind === 'temp' && !image.imageId)
      throw new Error('图片缺少标识，请重新上传');
    if (
      kind === 'style' &&
      (!image.styleNo?.trim() || ![0, 1].includes(image.isMain ?? -1))
    )
      throw new Error('请填写图片款号及主服饰标记');
  }
}
export function imageUrl(image?: WorkflowImage, original = false) {
  const value = original
    ? image?.originalUrl
    : image?.thumbnailUrl || image?.previewUrl || image?.originalUrl;
  return value && (/^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value))
    ? value
    : '';
}
