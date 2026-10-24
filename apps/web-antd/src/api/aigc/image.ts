import type { AiImageResultRecord } from './image-result';
import type { AigcPageParams, AigcPageResult } from './types';

import { requestClient } from '#/api/request';

/** 来源页面：单图、批量、线稿、材质增强、模特图、动作图。 */
export type AiImageSourcePage = 0 | 1 | 3 | 4 | 5 | 6;

export interface AiImageSaveParams {
  aiModelId?: number;
  aspectRatio?: string;
  styleId?: string;
  styleNo: string;
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
  sourcePage?: AiImageSourcePage;
  status: 0 | 1;
  type: 0 | 1;
}

export interface AiImageRecord extends Omit<AiImageSaveParams, 'type'> {
  approval?: number;
  createTime?: string;
  id: number;
  operatorId?: number | string;
  operator?: null | string;
  createUserId?: number | string;
  results?: AiImageResultRecord[];
}
/** Form values may be incomplete until generation is requested. */
export interface AiImageFormValues
  extends Omit<AiImageSaveParams, 'num' | 'styleNo'> {
  num: null | number;
  styleNo?: string;
}

export interface AiImagePageParams extends AigcPageParams {
  aiModelId?: number;
  approval?: number;
  beginTime?: string;
  endTime?: string;
  sourcePage?: AiImageSourcePage;
  isImg?: boolean;
  operatorId?: number;
  prompt?: string;
  size?: string;
  styleNo?: string;
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
