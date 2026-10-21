import type { PageResult } from './types';

import { requestClient } from '#/api/request';

export interface LaunchTask {
  category?: string;
  createTime?: string;
  createUserId?: string;
  currentNodeAssigneeId?: string;
  currentNodeAssigneeName?: string;
  currentNodeCreateTime?: string;
  currentNodeKey?: string;
  currentNodeName?: string;
  currentNodePlanEndTime?: string;
  currentNodeStatus?: number;
  currentNodeTaskId?: string;
  dateOverdueDesc?: null | string;
  dateOverdueStatus?: number;
  flowStartTime?: string;
  flowStatus: number;
  id: number;
  launchTime?: string;
  mainPlatform?: string;
  processName?: string;
  procInstId?: string;
  productDeadline?: string;
  productSeason?: string;
  styleNo: string;
  timeOverdueDesc?: null | string;
  timeOverdueStatus?: number;
  visualLevel?: number;
}

export interface LaunchTaskFilters {
  category?: string;
  createTimes?: [string, string];
  currentAssigneeId?: string;
  dateOverdueStatus?: number;
  flowNodeKey?: string;
  flowNodePlanEndTimes?: [string, string];
  flowStartTimes?: [string, string];
  flowStatus?: number;
  launchTimes?: [string, string];
  mainPlatform?: string;
  productDeadlines?: [string, string];
  productSeason?: string;
  styleNo?: string;
  timeOverdueStatus?: string;
  visualLevel?: number;
}

export interface LaunchTaskPageParams extends LaunchTaskFilters {
  pageNo: number;
  pageSize: number;
}

export interface LaunchTaskUpdateParams {
  category?: string;
  dateOverdueDesc?: string;
  dateOverdueStatus?: number;
  extInfo?: string;
  flowStatus?: number;
  id: number;
  launchTime?: null | string;
  mainPlatform?: string;
  productDeadline?: null | string;
  productSeason?: string;
  timeOverdueDesc?: string;
  timeOverdueStatus?: number;
  visualLevel?: null | number;
}

const taskUrl = '/flycowerp/newProductTask';
export const importLaunchTasksApi = (file: File) =>
  requestClient.upload<string>(
    `${taskUrl}/import`,
    { file },
    { timeout: 120_000 },
  );
export const getLaunchTaskPageApi = (data: LaunchTaskPageParams) =>
  requestClient.post<PageResult<LaunchTask>>(`${taskUrl}/page`, data);
export const getLaunchTaskApi = (id: number) =>
  requestClient.get<LaunchTask | null>(`${taskUrl}/get/${id}`);
export const updateLaunchTaskApi = (data: LaunchTaskUpdateParams) =>
  requestClient.put<boolean>(`${taskUrl}/update`, data);
export const enableLaunchTaskApi = (id: number) =>
  requestClient.put<boolean>(`${taskUrl}/enable/${id}`);
export const terminateLaunchTaskApi = (id: number) =>
  requestClient.put<boolean>(`${taskUrl}/terminate/${id}`);
export const deleteLaunchTaskApi = (id: number) =>
  requestClient.delete<boolean>(`${taskUrl}/delete/${id}`);
