import type { AppSort } from './app-info';

import { configInfoRequestClient } from '#/api/request';

export type RecommendationVersion = -1 | 1;
export type RecommendationPlatform = '101' | '102';

export interface RecommendationContext {
  column: number;
  iosVersion: RecommendationVersion;
  platform: RecommendationPlatform;
  sort: AppSort;
  type: number;
}

export interface RecommendationQuery extends RecommendationContext {
  page: number;
  pageSize: number;
}

export interface Recommendation {
  appName: null | string;
  channel: null | string;
  channelId: null | number;
  coopModel: null | number;
  downloadBase: null | number;
  downloadCount: null | number;
  id: null | number;
  isRemd: null | number;
  platform: null | number;
  remdId: number;
  scolor: null | string;
  shortShortNote: null | string;
  size: null | string;
  sort: null | number;
  sourceId: null | string;
  status: null | number;
  type: null | number;
  typeName: null | string;
  updateTime: null | string;
}

export interface RecommendationPage {
  current: number;
  pages: number;
  records: Recommendation[];
  size: number;
  total: number;
}

export interface RecommendationSlotInput extends RecommendationContext {
  operType: -1 | 1;
  remdNum: number;
}

export interface RecommendationOrderInput {
  id: number;
  info: string;
  iosVersion: RecommendationVersion;
  order: number;
  platform: RecommendationPlatform;
  /** 调整位置和取消推荐均传当前筛选的 column。 */
  type: number;
}

export function getRecommendationListApi(
  params: RecommendationQuery,
  signal?: AbortSignal,
) {
  return configInfoRequestClient.post<RecommendationPage>(
    '/appInfo/getRemdList',
    params,
    ...(signal ? ([{ signal }] as const) : ([] as const)),
  );
}

export function updateRecommendationSlotApi(data: RecommendationSlotInput) {
  return configInfoRequestClient.post<null>(
    '/appInfo/addOrDelNoneRemdNum',
    data,
  );
}

export function updateRecommendationOrderApi(data: RecommendationOrderInput) {
  return configInfoRequestClient.post<null>('/appInfo/updateAppRemd', data);
}
