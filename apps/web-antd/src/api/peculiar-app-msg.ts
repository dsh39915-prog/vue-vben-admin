import { configInfoRequestClient } from '#/api/request';

export type PeculiarAppPopupType = 1 | 2 | 3 | 4;

export interface PeculiarAppMsgInput {
  info: string;
  popupType: PeculiarAppPopupType;
  status: 0 | 1;
  title: string;
}

export interface PeculiarAppMsg {
  createTime: null | string;
  id: number;
  info: null | string;
  popupType: null | number;
  status: null | number;
  title: null | string;
  updateTime: null | string;
}

export interface PeculiarAppMsgQuery {
  page: number;
  pageSize: number;
  status: -1 | 0 | 1;
}

export interface PeculiarAppMsgPage {
  current: number;
  pages: number;
  records: PeculiarAppMsg[];
  size: number;
  total: number;
}

export function getPeculiarAppMsgListApi(params: PeculiarAppMsgQuery) {
  return configInfoRequestClient.post<PeculiarAppMsgPage>(
    '/peculiarAppMsg/findPeculiarAppMsgByParam',
    params,
  );
}

export function getPeculiarAppMsgDetailsApi(id: number) {
  return configInfoRequestClient.get<PeculiarAppMsg>(
    `/peculiarAppMsg/getPeculiarAppMsgById/${id}`,
  );
}

export function savePeculiarAppMsgApi(
  data: PeculiarAppMsgInput & { id?: number },
) {
  return configInfoRequestClient.post<boolean>(
    '/peculiarAppMsg/addOrModifyPeculiarAppMsg',
    data,
  );
}

/** 按文档使用 GET 逻辑删除，页面逐条确认删除。 */
export function removePeculiarAppMsgApi(id: number) {
  return configInfoRequestClient.get<boolean>(
    `/peculiarAppMsg/removePeculiarAppMsg/${id}`,
  );
}
