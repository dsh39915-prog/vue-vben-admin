import { configInfoRequestClient } from '#/api/request';

export interface AppTypeQuery {
  appName: string;
  order: 'asc' | 'desc';
  page: number;
  pageSize: number;
  sort: 'Sort';
  sort1: '1' | '2' | '-1';
  status: '0' | '1' | '-1';
}

export interface AppType {
  contentCount: null | number;
  contentCountIpad: null | number;
  description: null | string;
  icon: null | string;
  iconIpad: null | string;
  id: number;
  name: null | string;
  newIcon: null | string;
  newName: null | string;
  orderNum: null | number;
  sort: null | number;
  status: null | number;
}

export interface AppTypePage {
  current: number;
  pages: number;
  records: AppType[];
  size: number;
  total: number;
}

export interface AppTypeOrderInput {
  id: number;
  newOrder: number;
  oldOrder: number;
  sort: number;
}

export function getAppTypeListApi(params: AppTypeQuery) {
  return configInfoRequestClient.post<AppTypePage>(
    '/appType/getAppType',
    params,
  );
}

export function updateAppTypeOrderApi(data: AppTypeOrderInput) {
  return configInfoRequestClient.post<null>(
    '/appType/modifyAppTypeOrderNum',
    data,
  );
}
