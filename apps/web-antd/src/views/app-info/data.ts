import type { AppInfoQuery } from '#/api';

export const sortOptions = [
  { label: '软件', value: 1 },
  { label: '游戏', value: 2 },
];
export const coopOptions = [
  { label: '默认', value: 0 },
  { label: 'CPT', value: 1 },
  { label: 'CPA', value: 2 },
  { label: 'CPS', value: 3 },
  { label: 'CPC', value: 4 },
  { label: '换量', value: 5 },
  { label: '联运', value: 6 },
];
export const platformOptions = [
  { label: 'iPhone', value: 101 },
  { label: 'iPad', value: 102 },
  { label: 'iPhone & iPad', value: 103 },
];
export const statusOptions = [
  { label: '可用', value: 1 },
  { label: '不可用', value: 0 },
  { label: '已隐藏', value: -2 },
];
export const packageOptions = [
  { label: '普通包', value: 1 },
  { label: '推广包', value: 2 },
  { label: '广告包', value: 3 },
];
export const priceOptions = [
  { label: '免费', value: '0' },
  { label: '收费', value: '1' },
  { label: '限免', value: '2' },
];
export const installOptions = [
  { label: '不推荐', value: 0 },
  { label: '推荐', value: 1 },
  { label: '禁止', value: 2 },
];
export const searchOptions = [
  { label: '应用名称模糊', value: 1 },
  { label: '应用 ID', value: 2 },
  { label: 'iTunes ID', value: 3 },
  { label: '包 ID', value: 4 },
  { label: '应用名称精确', value: 5 },
];

function allOptions(options: { label: string; value: number }[]) {
  return [
    { label: '全部', value: '-1' },
    ...options.map(({ label, value }) => ({ label, value: String(value) })),
  ];
}

export const selectFilters = [
  { key: 'sort1', label: '软件类型', options: allOptions(sortOptions) },
  { key: 'coopModel', label: '合作模式', options: allOptions(coopOptions) },
  { key: 'isRemd', label: '包类型', options: allOptions(packageOptions) },
  { key: 'platForm', label: '运行平台', options: allOptions(platformOptions) },
  { key: 'status', label: '应用状态', options: allOptions(statusOptions) },
  {
    key: 'isSharePage',
    label: '是否有共享包',
    options: allOptions([
      { label: '否', value: 0 },
      { label: '是', value: 1 },
    ]),
  },
  {
    key: 'appStoreStatus',
    label: '上架状态',
    options: allOptions([
      { label: '下架', value: 0 },
      { label: '上架', value: 1 },
    ]),
  },
  {
    key: 'statusOrShare',
    label: '应用/共享包状态',
    options: allOptions(statusOptions),
  },
] as const;

export function emptyQuery(): Omit<
  AppInfoQuery,
  'order' | 'page' | 'pageSize' | 'sort'
> {
  return {
    appName: '',
    appStoreStatus: '-1',
    coopModel: '-1',
    isFree: '',
    isRemd: '-1',
    isSharePage: '-1',
    platForm: '-1',
    searchType: 1,
    sort1: '-1',
    status: '-1',
    statusOrShare: '-1',
    timeEt: '',
    timeSt: '',
    type: '',
  };
}

export function optionLabel(
  options: { label: string; value: number | string }[],
  value: null | number | string | undefined,
) {
  return (
    options.find((option) => String(option.value) === String(value))?.label ??
    value ??
    '—'
  );
}
