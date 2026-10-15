import { requestClient } from '#/api/request';

import type { SystemPageParam, SystemPageResult } from './types';

export interface LoginLogRecord {
  createTime: string;
  id: number;
  logType: number;
  result: number;
  traceId?: string;
  userAgent?: string;
  userId?: number;
  userIp: string;
  username: string;
  userType: number;
}

export interface LoginLogPageParams extends SystemPageParam {
  createTime?: string[];
  status?: number;
  userIp?: string;
  username?: string;
}

export const getLoginLogPageApi = (params: LoginLogPageParams) =>
  requestClient.get<SystemPageResult<LoginLogRecord>>(
    '/system/login-log/page',
    { params },
  );

export const getLoginLogApi = (id: number) =>
  requestClient.get<LoginLogRecord>('/system/login-log/get', {
    params: { id },
  });

export const exportLoginLogApi = (
  params: Omit<LoginLogPageParams, 'pageNo' | 'pageSize'>,
) => requestClient.download('/system/login-log/export-excel', { params });
