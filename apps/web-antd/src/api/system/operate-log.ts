import { requestClient } from '#/api/request';

import type { SystemPageParam, SystemPageResult } from './types';

export interface OperateLogRecord {
  action?: string;
  bizId: number;
  createTime: string;
  extra?: string;
  id: number;
  requestMethod: string;
  requestUrl: string;
  subType: string;
  traceId: string;
  type: string;
  userAgent: string;
  userId: number;
  userIp: string;
  userName: string;
  userType: number;
}

export interface OperateLogPageParams extends SystemPageParam {
  action?: string;
  bizId?: number;
  createTime?: string[];
  subType?: string;
  type?: string;
  userId?: number;
}

export const getOperateLogPageApi = (params: OperateLogPageParams) =>
  requestClient.get<SystemPageResult<OperateLogRecord>>(
    '/system/operate-log/page',
    { params },
  );

export const getOperateLogApi = (id: number) =>
  requestClient.get<OperateLogRecord>('/system/operate-log/get', {
    params: { id },
  });

export const exportOperateLogApi = (
  params: Omit<OperateLogPageParams, 'pageNo' | 'pageSize'>,
) => requestClient.download('/system/operate-log/export-excel', { params });
