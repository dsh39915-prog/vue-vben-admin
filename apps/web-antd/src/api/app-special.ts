import { configInfoRequestClient } from '#/api/request';

export interface AppSpecialPageQuery {
  page: number;
  pageSize: number;
}

export interface AppSpecialPage<T> {
  current: number;
  pages: number;
  records: T[];
  size: number;
  total: number;
}

export interface AppSpecial {
  appId: null | number;
  appName: null | string;
  appPriceFlag: null | number;
  appStorePrice: null | number | string;
  appStoreStatus: null | number;
  id: number;
  menuId: null | number;
  orderNum: null | number;
  sort: null | number;
  status: null | number;
}

export interface AppSpecialCandidate {
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
}

export interface AppSpecialCandidateQuery extends AppSpecialPageQuery {
  isFree: string;
  order?: 'asc' | 'desc';
  searchKeyText: string;
  searchKeyType: '1' | '2' | '';
  sort?:
    | 'appId'
    | 'category'
    | 'channelId'
    | 'downloadCount'
    | 'mainId'
    | 'price';
  type: number;
}

export interface AppSpecialCategory {
  id: number;
  name: string;
}

export function getAppSpecialListApi(params: AppSpecialPageQuery) {
  return configInfoRequestClient.post<AppSpecialPage<AppSpecial>>(
    '/appSpecialList/getAppOrGameListPage',
    params,
  );
}

export function getAppSpecialCandidateListApi(
  params: AppSpecialCandidateQuery,
) {
  return configInfoRequestClient.post<AppSpecialPage<AppSpecialCandidate>>(
    '/appSpecialList/getAllAppOrGameListPage',
    params,
  );
}

export function getAppSpecialCategoriesApi() {
  return configInfoRequestClient.post<AppSpecialCategory[]>(
    '/appType/typeList',
    { sort: 0 },
  );
}

/** 添加使用应用 appId，多个 ID 按逗号分隔。 */
export function addAppSpecialAppsApi(appIds: number[]) {
  return configInfoRequestClient.get<null>(
    `/appSpecialList/addSpecialAppOrGame/${appIds.join(',')}`,
  );
}

/** 移除使用专题记录 id，与添加所用的 appId 不同。 */
export function removeAppSpecialAppsApi(ids: number[]) {
  return configInfoRequestClient.get<null>(
    `/appSpecialList/removeSpecialAppOrGame/${ids.join(',')}`,
  );
}

export function updateAppSpecialOrderApi(data: { id: number; order: number }) {
  return configInfoRequestClient.post<null>(
    '/appSpecialList/updateSpecialAppOrGameOrder',
    data,
  );
}
