import { configInfoRequestClient } from '#/api/request';

export interface ShareAppInfoQuery {
  appName: string;
  page: number;
  pageSize: number;
  platform: number;
  searchType: 1 | 2 | 3 | 4;
  sort: number;
  status: number;
  type: number;
}

export interface ShareAppInfo {
  appId: number;
  appName: string;
  createTime: null | string;
  downloadBase: number;
  downloadCount: number;
  id: number;
  ipaUpdateTime: null | string;
  keywords: null | string;
  longVersion: null | string;
  minVersion: null | string;
  orderNum: number;
  path: null | string;
  platform: number;
  plist: null | string;
  shortShortNote: null | string;
  shortVersion: null | string;
  size: null | string;
  sort: number;
  status: number;
  typeName: null | string;
  updateTime: null | string;
  version: null | string;
}

export interface ShareAppInfoPage {
  current: number;
  pages: number;
  records: ShareAppInfo[];
  size: number;
  total: number;
}

export function getShareAppInfoListApi(params: ShareAppInfoQuery) {
  return configInfoRequestClient.post<ShareAppInfoPage>(
    '/shareappinfolist/list',
    params,
  );
}

export function updateShareAppInfoVisibilityApi(data: {
  id: number;
  type: 1 | 3;
}) {
  return configInfoRequestClient.post<null>('/shareappinfolist/update', data);
}
