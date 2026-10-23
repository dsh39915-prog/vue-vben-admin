export function imageUrls(value?: null | string) {
  return (value ?? '')
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** 预览图按原始图片顺序对应，缺少某张预览图时使用该张原始图片。 */
export function imagePreviewUrls(
  original?: null | string,
  preview?: null | string,
) {
  const originals = imageUrls(original);
  const previews = imageUrls(preview);
  return Array.from(
    { length: Math.max(originals.length, previews.length) },
    (_, index) => previews[index] || originals[index] || '',
  ).filter(Boolean);
}

export const sourcePageOptions = [
  { label: '单图生成', value: 0 },
  { label: '批量生成', value: 1 },
  { label: '线稿生图', value: 3 },
  { label: '材质增强', value: 4 },
  { label: '模特图', value: 5 },
  { label: '动作图', value: 6 },
];

export const taskStatusOptions = [
  { label: '等待中', value: 0 },
  { label: '生成中', value: 1 },
  { label: '成功', value: 2 },
  { label: '失败', value: 3 },
  { label: '已取消', value: 4 },
  { label: '暂存', value: 5 },
];

export const taskStatusColors: Record<number, string> = {
  0: 'default',
  1: 'processing',
  2: 'success',
  3: 'error',
  4: 'warning',
  5: 'default',
};
