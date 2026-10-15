import { requestClient } from '#/api/request';

import type { LaunchTask, PageResult, WorkbenchTaskContext } from './types';

export interface LaunchTaskPageParams {
  pageNo: number;
  pageSize: number;
  productCode?: string;
  status?: number;
}

export function createAndStartLaunchApi(data: Record<string, unknown>) {
  return requestClient.post<number>('/aigc/launch/create-and-start', data);
}

export function getLaunchTaskPageApi(params: LaunchTaskPageParams) {
  return requestClient.get<PageResult<LaunchTask>>('/aigc/launch/page', {
    params,
  });
}

export function getWorkbenchTaskContextApi(taskId: string) {
  return requestClient.get<WorkbenchTaskContext>(
    '/aigc/workbench/task-context',
    { params: { taskId } },
  );
}

export function completeWorkbenchTaskApi(data: Record<string, unknown>) {
  return requestClient.post<boolean>('/aigc/workbench/task/complete', data);
}
