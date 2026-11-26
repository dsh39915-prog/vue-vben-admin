import { configInfoRequestClient } from '#/api/request';

export type AppSort = 1 | 2;

export interface AppCategory {
  id: number;
  name: string;
  sort: AppSort | null;
}

export interface AppInfoQuery {
  appName: string;
  appStoreStatus: string;
  coopModel: string;
  isFree: string;
  isRemd: string;
  isSharePage: string;
  order?: 'asc' | 'desc';
  page: number;
  pageSize: number;
  platForm: string;
  searchType: number;
  /** 列表排序字段；软件/游戏类型仍由 sort1 筛选。 */
  sort?: 'appStorePrice' | 'downloadCount';
  sort1: string;
  status: string;
  /** -1 全部，1 上架或共享，2 可在前端显示应用。 */
  statusOrShare: -1 | 1 | 2;
  timeEt: string;
  timeSt: string;
  type: string;
}

export interface AppInfo {
  appName: string;
  appPriceFlag: number;
  appStorePrice: null | string;
  appStoreStatus: number;
  channel: null | string;
  coopModel: number;
  createTime: null | string;
  downloadBase: null | number;
  downloadCount: number;
  id: number;
  isRemd: number;
  isSharePage: number;
  itemId: number | string;
  platform: number;
  size: null | string;
  sort: number;
  sourceId: null | string;
  status: number;
  typeName: null | string;
  updateTime: null | string;
  version: null | string;
}

export interface AppInfoPage {
  current: number;
  pages: number;
  records: AppInfo[];
  size: number;
  total: number;
}

export interface AppInfoInput {
  id: number;
  peculiarPopId: number;
  remdAppstoreIns: 0 | 1 | 2;
  sort: AppSort;
  type: number;
}

export interface AppRecommendationInput {
  /** 1 首页精选，3 应用/游戏推荐，5 应用/游戏排行，42 应用/游戏最新。 */
  column: 1 | 3 | 5 | 42;
  id: number;
  iosVersion: -1 | 1;
  platform: 101 | 102;
  sort: AppSort;
  type: number;
}

export function addAppRecommendationApi(data: AppRecommendationInput) {
  return configInfoRequestClient.post<null>('/appInfo/addAppRemd', data);
}

export function getAppCategoryListApi(sort: AppSort) {
  return configInfoRequestClient.post<AppCategory[]>('/appType/typeList', {
    sort,
  });
}

export function getAppInfoListApi(params: AppInfoQuery) {
  return configInfoRequestClient.post<AppInfoPage>('/appInfo/list', params);
}

export function getAppInfoDetailsApi(id: number) {
  return configInfoRequestClient.get<AppInfoInput>(`/appInfo/details/${id}`);
}

export function updateAppInfoApi(data: AppInfoInput) {
  return configInfoRequestClient.post<null>('/appInfo/update', data);
}
