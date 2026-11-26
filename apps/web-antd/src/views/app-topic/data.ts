export const platformOptions = [
  { label: 'iPhoneOS', value: 101 },
  { label: 'iPadOS', value: 102 },
  { label: 'iPhone & iPad', value: 103 },
];
export const recommendationOptions = [
  { label: '首页精选', value: 1 },
  { label: '应用推荐', value: 2 },
  { label: '游戏推荐', value: 3 },
  { label: '搜索推荐', value: 4 },
  { label: '更新推荐', value: 5 },
  { label: '搜索默认', value: 6 },
];
export const nameOptions = [
  { label: '显示', value: 1 },
  { label: '不显示', value: 2 },
];
export const topicStatusOptions = [
  { label: '无效', value: 0 },
  { label: '有效', value: 1 },
  { label: '隐藏', value: 3 },
  { label: '未上线', value: 4 },
];
export function withAll(options: { label: string; value: number }[]) {
  return [{ label: '全部', value: -1 }, ...options];
}
export function validId(id: null | number | undefined): id is number {
  return typeof id === 'number' && Number.isInteger(id) && id > 0;
}
export function validOrder(_rule: unknown, value: unknown) {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 2_147_483_647
  )
    return Promise.resolve();
  return Promise.reject(new Error('请输入有效的非负整数排序号'));
}
