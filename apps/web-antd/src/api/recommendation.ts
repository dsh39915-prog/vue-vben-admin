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
  /** 应用分类 id，使用列表记录的 type，不是推荐栏目 column。 */
  type: number;
}

export function getRecommendationListApi(params: RecommendationQuery) {
  return configInfoRequestClient.post<RecommendationPage>(
    '/appInfo/getRemdList',
    params,
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
