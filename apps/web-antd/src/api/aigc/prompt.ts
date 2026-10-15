import type { AigcPageResult } from './types';

import { requestClient } from '#/api/request';

export interface PromptCategorySaveParams {
  description?: string;
  id?: number;
  name: string;
}

export interface PromptCategoryRecord extends PromptCategorySaveParams {
  id: number;
}

export interface PromptSaveParams {
  categoryId?: number;
  description?: string;
  id?: number;
  name: string;
  referenceImg?: string;
  systemPrompt?: string;
  userPrompt?: string;
}

export interface PromptRecord extends PromptSaveParams {
  categoryName?: string;
  createTime?: string;
  id: number;
}

export interface PromptPageParams {
  beginTime?: string;
  categoryId?: number;
  endTime?: string;
  page: number;
  pageSize: number;
  userPrompt?: string;
}

const categoryUrl = '/flycowerp/aiPromptCategory';
const promptUrl = '/flycowerp/aiPrompt';

// Categories return an array; prompts return a page containing records and total.
export const getPromptCategoryListApi = () =>
  requestClient.post<PromptCategoryRecord[]>(`${categoryUrl}/page`);

export const getPromptCategoryApi = (id: number) =>
  requestClient.get<null | PromptCategoryRecord>(
    `${categoryUrl}/details/${id}`,
  );

export const createPromptCategoryApi = (data: PromptCategorySaveParams) =>
  requestClient.post<unknown>(`${categoryUrl}/save`, data);

export const updatePromptCategoryApi = (
  data: PromptCategorySaveParams & { id: number },
) => requestClient.post<unknown>(`${categoryUrl}/update`, data);

// GET is the deletion method defined by the backend Swagger contract.
export const deletePromptCategoryApi = (id: number) =>
  requestClient.get<unknown>(`${categoryUrl}/delete/${id}`);

export const getPromptPageApi = (params: PromptPageParams) =>
  requestClient.post<AigcPageResult<PromptRecord>>(`${promptUrl}/page`, params);

export const getPromptApi = (id: number) =>
  requestClient.get<null | PromptRecord>(`${promptUrl}/details/${id}`);

export const createPromptApi = (data: PromptSaveParams) =>
  requestClient.post<unknown>(`${promptUrl}/save`, data);

export const updatePromptApi = (data: PromptSaveParams & { id: number }) =>
  requestClient.post<unknown>(`${promptUrl}/update`, data);

export const deletePromptApi = (id: number) =>
  requestClient.get<unknown>(`${promptUrl}/delete/${id}`);
