import { configInfoRequestClient } from '#/api/request';

export interface ClientSwitchInput {
  clientVersion: string;
  createTime: string;
  createUser: string;
  status: 0 | 1;
  switchType: 0 | 1;
  updateTime: string;
}

export interface ClientSwitch extends ClientSwitchInput {
  id: number;
}

export interface ClientSwitchPage {
  current: number;
  pages: number;
  records: ClientSwitch[];
  size: number;
  total: number;
}

export function getClientSwitchListApi(
  params: {
    page: number;
    pageSize: number;
  },
  signal?: AbortSignal,
) {
  return configInfoRequestClient.post<ClientSwitchPage>(
    '/clientswitch/list',
    params,
    ...(signal ? ([{ signal }] as const) : ([] as const)),
  );
}

export function getClientSwitchDetailsApi(id: number) {
  return configInfoRequestClient.get<ClientSwitch>(
    `/clientswitch/details/${id}`,
  );
}

export function addClientSwitchApi(data: ClientSwitchInput) {
  return configInfoRequestClient.post<null>('/clientswitch/add', data);
}

export function updateClientSwitchApi(
  data: ClientSwitchInput & { id: number },
) {
  return configInfoRequestClient.post<null>('/clientswitch/update', data);
}

export function deleteClientSwitchApi(id: number) {
  // 服务端文档约定使用 GET 删除。
  return configInfoRequestClient.get<null>(`/clientswitch/delete/${id}`);
}
