import type { AiImageSourcePage } from './image';

import { requestClient } from '#/api/request';

export interface AiImageResultUrls {
  originalUrl: string;
  previewUrl?: null | string;
  thumbnailUrl?: null | string;
}

export interface AiImageResultBatch {
  imgId: number;
  name?: string;
  sourcePage?: AiImageSourcePage;
}

export interface AiStyleImageGroup extends AiImageResultBatch {
  createTime?: string;
  list?: AiStyleImageResult[];
}

export interface AiStyleImageResult extends AiImageResultUrls {
  id: number;
  isAiCreate?: 0 | 1;
}

export interface AiImageResultSaveParams extends AiImageResultUrls {
  styleId: string;
  imgId: number;
  creator?: number;
  updater?: number;
}

export interface AiImageResultRecord extends AiImageResultUrls {
  createTime?: string;
  height?: number;
  id: number;
  imgId: number;
  isCurrent?: number;
  parentResultId?: number;
  slotNo: number;
  taskId: number;
  updateTime?: string;
  width?: number;
}

export const getAiImageResultBatchesApi = (
  styleId: string,
  sourcePage: AiImageSourcePage,
) =>
  requestClient.get<AiImageResultBatch[]>(
    `/flycowerp/aiImageResult/dropdown/${encodeURIComponent(styleId)}`,
    { params: { sourcePage } },
  );

export const getAiImageResultsByStyleIdApi = (
  styleId: string,
  params: { sourcePage: AiImageSourcePage; imgId?: number },
) =>
  requestClient.get<AiStyleImageGroup[]>(
    `/flycowerp/aiImageResult/list/${encodeURIComponent(styleId)}`,
    { params },
  );

export const getAiImageHistoryApi = (imgId: number, slotNo?: number) =>
  requestClient.get<AiImageResultRecord[]>(
    `/flycowerp/aiImageResult/history/${imgId}${slotNo === undefined ? '' : `/${slotNo}`}`,
  );
export const saveAiImageResultApi = (data: AiImageResultSaveParams) =>
  requestClient.post<unknown>('/flycowerp/aiImageResult/save', data);
export const deleteAiImageResultApi = (id: number) =>
  requestClient.get<unknown>(`/flycowerp/aiImageResult/delete/${id}`);
export const regenerateAiImageResultApi = (resultId: number) =>
  requestClient.post<unknown>(
    `/flycowerp/aiImageTask/result/regenerate/${resultId}`,
  );
export const enhanceAiImageResultApi = (resultId: number) =>
  requestClient.post<unknown>(
    `/flycowerp/aiImageTask/result/material-enhance/${resultId}`,
  );
