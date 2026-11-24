import { configInfoRequestClient } from '#/api/request';

export interface ConfigInfoInput {
  configClientVersion: string;
  configCode: string;
  configCondition: string;
  configInfo: string;
  configInfoFormat: string;
  configName: string;
  configNote: string;
  status: 0 | 1;
  userName: null | string;
}

export interface ConfigInfo extends ConfigInfoInput {
  CreateTime?: null | string;
  createTime?: null | string;
  id: number;
  UpdateTime?: null | string;
  updateTime?: null | string;
}

export interface ConfigInfoPage {
  current: number;
  pages: number;
  records: ConfigInfo[];
  size: number;
  total: number;
}

export function getConfigInfoListApi(params: {
  page: number;
  pageSize: number;
}) {
  return configInfoRequestClient.post<ConfigInfoPage>(
    '/configinfo/list',
    params,
  );
}

export function getConfigInfoDetailsApi(id: number) {
  return configInfoRequestClient.get<ConfigInfo>(`/configinfo/details/${id}`);
}

export function addConfigInfoApi(data: ConfigInfoInput) {
  return configInfoRequestClient.post<null>('/configinfo/add', data);
}

export function updateConfigInfoApi(data: ConfigInfoInput & { id: number }) {
  return configInfoRequestClient.post<null>('/configinfo/update', data);
}
