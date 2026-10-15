import type { AigcPageParams, AigcPageResult } from './types';

import { requestClient } from '#/api/request';

export type AiImageTaskStatus = 0 | 1 | 2 | 3 | 4 | 5;

export interface AiImageTaskRecord {
  aspectRatio?: string;
  beginTime?: string;
  celeryId?: string;
  createTime?: string;
  dealTime?: string;
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
  previewOriginalImg?: string;
  previewReferenceImg?: string;
  progress?: number;
  prompt?: string;
  quality?: string;
  referenceImg?: string;
  requestId?: string;
  resultCount?: number;
  sourcePage?: number;
  sourceResultId?: number;
  status: AiImageTaskStatus;
  statusDesc?: string;
  taskType?: number;
  updateTime?: string;
  userId?: number;
  workerId?: string;
}

export interface AiImageTaskPageParams extends AigcPageParams {
  aiModelId?: number;
  sortKey?: string;
  sortVal?: 'asc' | 'desc';
  sourcePage?: number;
  status?: number;
  taskType?: number;
}

export interface AiImageTaskStatistics {
  cancelCount: number;
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
export const retryAiImageTasksApi = (ids: number[]) =>
  requestClient.get<unknown>(`${url}/retry/${ids.join(',')}`);
export const cancelAiImageTasksApi = (ids: number[]) =>
  requestClient.get<unknown>(`${url}/cancel/${ids.join(',')}`);
export const deleteAiImageTaskApi = (id: number) =>
  requestClient.delete<unknown>(`${url}/delete/${id}`);
