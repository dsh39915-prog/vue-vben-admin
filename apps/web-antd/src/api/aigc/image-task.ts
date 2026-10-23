import type { AigcPageParams, AigcPageResult } from './types';

import { requestClient } from '#/api/request';

export type AiImageTaskStatus = 0 | 1 | 2 | 3 | 4 | 5;

export interface AiImageTaskRecord {
  aspectRatio?: string;
  beginTime?: string;
  celeryId?: string;
  createTime?: string;
  dealTime?: string;
  deleted?: number;
  duration?: number;
  errorDetail?: string;
  errorMessage?: string;
  generateType?: number;
  id: number;
  imageSize?: string;
  imgId: number;
  imgNum?: number;
  modelId?: number;
  originalImg?: string;
  pauseFlag?: 0 | 1;
  previewOriginalImg?: string;
  previewReferenceImg?: string;
  progress?: number;
  prompt?: string;
  quality?: string;
  referenceImg?: string;
  requestId?: string;
  resultCount?: number;
  smallOriginalImg?: string;
  smallReferenceImg?: string;
  sourcePage?: number;
  sourceResultId?: number;
  status: AiImageTaskStatus;
  statusDesc?: string;
  /** 款式 ID，使用字符串保留大整数精度。 */
  styleId?: string;
  /** 列表和详情返回的款号。 */
  styleNo?: null | string;
  taskType?: number;
  updateTime?: string;
  userId?: number;
  workerId?: string;
}

export interface AiImageTaskPageParams extends AigcPageParams {
  aiModelId?: number;
  styleNo?: string;
  sortKey?: string;
  sortVal?: 'asc' | 'desc';
  sourcePage?: number;
  status?: number;
  taskType?: number;
}

export interface AiImageTaskStatistics {
  /** Counts status 5 (暂存). */
  stagingCount: number;
  failCount: number;
  runningCount: number;
  successCount: number;
  totalCount: number;
  waitingCount: number;
}

const url = '/flycowerp/aiImageTask';
export const getAiImageTaskPageApi = (data: AiImageTaskPageParams) =>
  requestClient.post<AigcPageResult<AiImageTaskRecord>>(`${url}/page`, data);
export const getAiImageTaskApi = (id: number) =>
  requestClient.get<AiImageTaskRecord | null>(`${url}/detail/${id}`);
export const getAiImageTaskStatisticsApi = () =>
  requestClient.get<AiImageTaskStatistics>(`${url}/statistics`);
export const startAiImageTasksApi = (ids: number[]) =>
  requestClient.get<unknown>(`${url}/start/${ids.join(',')}`);
/** Omit modelId to keep each task's original model. */
export const retryAiImageTasksApi = (ids: number[], modelId?: number) => {
  if (!ids.length || ids.some((id) => !Number.isSafeInteger(id) || id <= 0))
    return Promise.reject(new Error('请选择有效的任务'));
  if (modelId !== undefined && (!Number.isSafeInteger(modelId) || modelId <= 0))
    return Promise.reject(new Error('请选择有效的模型'));
  return requestClient.get<unknown>(
    `${url}/retry/${ids.join(',')}${modelId === undefined ? '' : '/' + modelId}`,
  );
};
export const cancelAiImageTasksApi = (ids: number[]) =>
  requestClient.get<unknown>(`${url}/cancel/${ids.join(',')}`);
export const deleteAiImageTaskApi = (id: number) =>
  requestClient.delete<unknown>(`${url}/delete/${id}`);
