import type { SystemPage } from './system';

import { requestClient } from '#/api/request';

export type SystemLogKind = 'login-logs' | 'operation-logs';
export interface SystemLogQuery {
  endTime?: string;
  page: number;
  pageSize: number;
  startTime?: string;
  succeeded?: boolean;
  username?: string;
}
export interface SystemLog {
  createdAt: null | string;
  id: number;
  ipAddress: null | string;
  succeeded: boolean | null;
  userId: null | number;
  username: null | string;
}
export interface SystemLoginLog extends SystemLog {
  browser: null | string;
  message: null | string;
  mobile: null | string;
  operatingSystem: null | string;
  realName: null | string;
  userAgent: null | string;
}
export interface SystemOperationLog extends SystemLog {
  action: null | string;
  durationMs: null | number;
  failureType: null | string;
  httpStatus: null | number;
  remark: null | string;
  requestMethod: null | string;
  requestPath: null | string;
}
export function getSystemLogsApi(kind: SystemLogKind, params: SystemLogQuery) {
  return requestClient.get<SystemPage<SystemLoginLog | SystemOperationLog>>(
    `/system/${kind}`,
    { params },
  );
}
