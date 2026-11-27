import { configInfoRequestClient } from '#/api/request';

export interface AppTopicPage<T> {
  current: number;
  pages: number;
  records: T[];
  size: number;
  total: number;
}
export interface AppTopicQuery {
  isShowName: number;
  name: string;
  page: number;
  pageSize: number;
  platform: number;
  remd: number;
  status: number;
}
export interface AppTopicInput {
  id?: number;
  isShowName: number;
  name: string;
  offLineTime: string;
  onLineTime: string;
  platform: number;
  remd: number;
  site: number;
  title: string;
}
export interface AppTopic extends Omit<AppTopicInput, 'id'> {
  appIdStr: null | string;
  appName: null | string;
  createTime: null | string;
  id: number;
  status: null | number;
  updateTime: null | string;
}
export interface AppTopicOption {
  id: number;
  name: string;
}
export interface AppTopicApp {
  appId: null | number;
  appName: null | string;
  id: number;
  remd: null | number;
  sid: number;
}
export interface AppTopicCandidate {
  appId: number;
  appName: null | string;
  appPriceFlag: null | number;
  appStorePrice: null | number | string;
  appStoreStatus: null | number;
  channelId: null | number;
  downloadBase: null | number;
  downloadCount: null | number;
  id: number;
  isAdded: null | number;
  sort: null | number;
  status: null | number;
  type: null | string;
  typeName: null | string;
  version: null | string;
}
export interface AppTopicCandidateQuery {
  order?: 'asc' | 'desc';
  page: number;
  pageSize: number;
  platform: number;
  searchKeyText: string;
  /** 此接口：1 应用 ID，2 应用名称。 */
  searchKeyType: 1 | 2;
  sid: number;
  sort: '1' | '2';
  /** 候选列表排序字段，与软件/游戏筛选 sort 分开。 */
  sort1?: 'appStorePrice' | 'downloadCount';
  type: number;
}
export function getAppTopicListApi(query: AppTopicQuery, signal?: AbortSignal) {
  return configInfoRequestClient.post<AppTopicPage<AppTopic>>(
    '/adAppspecial/findAppSpecialList',
    query,
    ...(signal ? ([{ signal }] as const) : ([] as const)),
  );
}
export function saveAppTopicApi(data: AppTopicInput) {
  return configInfoRequestClient.post<string>(
    '/adAppspecial/addOrModifyAppSpecial',
    data,
  );
}
export function getAppTopicOptionsApi(platform: number) {
  return configInfoRequestClient.get<AppTopicOption[]>(
    `/adAppspecial/findAppSpecialToNameList/${platform}`,
  );
}
export function getAppTopicAppsApi(
  query: {
    page: number;
    pageSize: number;
    sid: number;
  },
  signal?: AbortSignal,
) {
  return configInfoRequestClient.post<AppTopicPage<AppTopicApp>>(
    '/adAppspecial/findAppApecialInfoBySid',
    query,
    ...(signal ? ([{ signal }] as const) : ([] as const)),
  );
}
export function addAppTopicAppsApi(data: { ids: number[]; sid: number }) {
  return configInfoRequestClient.post<boolean>(
    '/adAppspecial/addAppToAppSpecialInfo',
    data,
  );
}
export function updateAppTopicAppApi(data: {
  appName: string;
  id: number;
  remd: number;
}) {
  return configInfoRequestClient.post<boolean>(
    '/adAppspecial/updateAppSpecialInfo',
    data,
  );
}
/** ids 为专题内应用关联记录 id。 */
export function removeAppTopicAppsApi(ids: number[]) {
  return configInfoRequestClient.post<boolean>(
    '/adAppspecial/removeAppSpecialInfo',
    { ids },
  );
}
export function getAppTopicCandidatesApi(
  query: AppTopicCandidateQuery,
  signal?: AbortSignal,
) {
  return configInfoRequestClient.post<AppTopicPage<AppTopicCandidate>>(
    '/adAppspecial/getAppDeInfoList',
    query,
    ...(signal ? ([{ signal }] as const) : ([] as const)),
  );
}
/** ids 为专题 id。 */
export function removeAppTopicsApi(ids: number[]) {
  return configInfoRequestClient.post<boolean>(
    '/adAppspecial/removeAppSpecialById',
    { ids },
  );
}
