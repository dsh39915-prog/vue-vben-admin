import type { LaunchTaskFilters } from '#/api';

export const flowStatusOptions = [
  { label: '草稿', value: 0 },
  { label: '未开始', value: 1 },
  { label: '进行中', value: 2 },
  { label: '已完成', value: 3 },
  { label: '冻结中', value: 4 },
  { label: '已终止', value: 5 },
];
export const visualLevelOptions = [
  { label: 'S', value: 0 },
  { label: 'SA', value: 1 },
  { label: '常规款', value: 2 },
];
export const overdueOptions = [
  { label: '未逾期', value: 0 },
  { label: '已逾期', value: 1 },
];
export const flowNodeOptions = [
  ['aiMatchingOutput', 'AI搭配方案输出'],
  ['aiMatchingAudit', 'AI搭配方案审核'],
  ['aiImageTaskDispatch', 'AI图片生成任务分配'],
  ['aiImageModelTask', 'AI图片生成（模特图）'],
  ['aiImageModelAudit', 'AI图片审核（模特图）'],
  ['aiImageActionTask', 'AI图片生成（动作图）'],
  ['aiImageActionAudit', 'AI图片审核（动作图）'],
  ['retouchTaskDispatch', '修图任务分配'],
  ['retouching', '修图制作'],
  ['retouchingAudit', '修图审核'],
  ['pageTaskDispatch', '页面制作任务分配'],
  ['pageProduction', '页面制作'],
  ['pageProductionAudit', '页面审核'],
  ['launchTaskDispatch', '上新任务分配'],
  ['launchMaterialPrepare', '上新材料准备'],
  ['launchAudit', '上新审核'],
].map(([value, label]) => ({ label, value: value! }));
export const rangeFields = [
  { key: 'launchTimes', label: '上新时间' },
  { key: 'flowStartTimes', label: '流程开始时间' },
  { key: 'productDeadlines', label: '商品要求货期' },
  { key: 'createTimes', label: '创建时间' },
  { key: 'flowNodePlanEndTimes', label: '节点计划完成时间' },
] as const;
export function optionLabel(
  options: { label: string; value: number }[],
  value?: number,
) {
  return (
    options.find((item) => item.value === value)?.label ??
    (value === undefined || value === null ? '-' : String(value))
  );
}
export function statusColor(status?: number) {
  return (
    (
      {
        0: 'default',
        1: 'blue',
        2: 'processing',
        3: 'success',
        4: 'warning',
        5: 'error',
      } as Record<number, string>
    )[status ?? -1] ?? 'default'
  );
}

export function normalizeTaskFilters(
  query: LaunchTaskFilters,
): LaunchTaskFilters {
  const filters = { ...query };
  for (const key of [
    'styleNo',
    'productSeason',
    'category',
    'mainPlatform',
    'currentAssigneeId',
  ] as const) {
    filters[key] = filters[key]?.trim() || undefined;
  }
  for (const { key } of rangeFields) {
    filters[key] = filters[key]?.length === 2 ? filters[key] : undefined;
  }
  return filters;
}
