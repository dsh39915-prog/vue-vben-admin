import { requestClient } from '#/api/request';

export interface AiImageResultUrls {
  originalUrl: string;
  previewUrl?: null | string;
  thumbnailUrl?: null | string;
}

export interface AiImageResultBatch {
  imgId: number;
  name?: string;
}

export interface AiBusinessKeyImageGroup extends AiImageResultBatch {
  createTime?: string;
  list?: AiImageResultUrls[];
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

export const getAiImageResultBatchesApi = (businessKey: string) =>
  requestClient.get<AiImageResultBatch[]>(
    `/flycowerp/aiImageResult/dropdown/${encodeURIComponent(businessKey)}`,
  );

export const getAiImageResultsByBusinessKeyApi = (
  businessKey: string,
  imgId: number,
) =>
  requestClient.get<AiBusinessKeyImageGroup[]>(
    `/flycowerp/aiImageResult/list/${encodeURIComponent(businessKey)}/${imgId}`,
  );

export const getAiImageHistoryApi = (imgId: number, slotNo?: number) =>
  requestClient.get<AiImageResultRecord[]>(
    `/flycowerp/aiImageResult/history/${imgId}${slotNo === undefined ? '' : `/${slotNo}`}`,
  );
export const regenerateAiImageResultApi = (resultId: number) =>
  requestClient.post<unknown>(
    `/flycowerp/aiImageTask/result/regenerate/${resultId}`,
  );
export const enhanceAiImageResultApi = (resultId: number) =>
  requestClient.post<unknown>(
    `/flycowerp/aiImageTask/result/material-enhance/${resultId}`,
  );
