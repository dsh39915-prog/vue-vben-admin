import type { AiImageResultRecord } from './image-result';
import type { AigcPageParams, AigcPageResult } from './types';

import { requestClient } from '#/api/request';

export interface AiImageSaveParams {
  aiModelId?: number;
  aspectRatio?: string;
  styleId?: string;
  goodsCode?: string;
  id?: number;
  num: number;
  originalImg?: string;
  previewOriginalImg?: string;
  previewReferenceImg?: string;
  prompt: string;
  promptId?: number;
  promptType?: number;
  quality?: string;
  referenceImg?: string;
  size?: string;
  smallOriginalImg?: string;
  smallReferenceImg?: string;
  status: 0 | 1;
  type: 0 | 1;
}

export interface AiImageRecord extends Omit<AiImageSaveParams, 'type'> {
  approval?: number;
  createTime?: string;
  id: number;
  imgType?: number;
  operatorId?: number;
  results?: AiImageResultRecord[];
  styleNumber?: number | string;
}
/** Form values may be incomplete until generation is requested. */
export interface AiImageFormValues extends Omit<AiImageSaveParams, 'num'> {
  num: null | number;
}

export interface AiImagePageParams extends AigcPageParams {
  aiModelId?: number;
  approval?: number;
  beginTime?: string;
  endTime?: string;
  imgType?: number;
  isImg?: boolean;
  operatorId?: number;
  prompt?: string;
  size?: string;
  styleNumber?: string;
}

const url = '/flycowerp/aiImg';
export const getAiImagePageApi = (data: AiImagePageParams) =>
  requestClient.post<AigcPageResult<AiImageRecord>>(`${url}/page`, data);
export const getAiImageApi = (id: number) =>
  requestClient.get<AiImageRecord | null>(`${url}/details/${id}`);
export const createAiImageApi = (data: AiImageSaveParams) =>
  requestClient.post<unknown>(`${url}/save`, data);
export const updateAiImageApi = (data: AiImageSaveParams & { id: number }) =>
  requestClient.post<unknown>(`${url}/update`, data);
