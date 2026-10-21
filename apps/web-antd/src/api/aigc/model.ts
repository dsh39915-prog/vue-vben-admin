import type { AigcPageParams, AigcPageResult } from './types';

import { requestClient } from '#/api/request';

export type AiModelTestStatus = 0 | 1 | 2 | 3;

export interface AiModelProvider {
  id: number;
  name: string;
}

export interface AiModelSaveParams {
  ak?: string;
  apiKey?: string;
  apiUrl?: string;
  id?: number;
  modelCode: string;
  modelName: string;
  modelType: 0 | 1;
  providerId: number;
  sk?: string;
  status: 0 | 1;
}

export interface AiModelRecord extends AiModelSaveParams {
  createTime?: number | string;
  id: number;
  result?: null | string;
  testStatus?: AiModelTestStatus | null;
  updateTime?: number | string;
}

export interface AiModelPageParams extends AigcPageParams {
  modelName?: string;
  modelType?: number;
  providerId?: number;
  status?: number;
}

export interface AiModelSize {
  aspectRatio: string;
  size: string;
}

export interface AiModelSizeConfig {
  qualities: Array<{ quality: string; sizes: AiModelSize[] }>;
}

const url = '/flycowerp/aiModel';
export const getAiModelProvidersApi = () =>
  requestClient.get<AiModelProvider[]>(`${url}/providerList`);
export const getAiModelPageApi = (data: AiModelPageParams) =>
  requestClient.post<AigcPageResult<AiModelRecord>>(`${url}/page`, data);
export const getAiModelApi = (id: number) =>
  requestClient.get<AiModelRecord | null>(`${url}/detail/${id}`);
export const createAiModelApi = (data: AiModelSaveParams) =>
  requestClient.post<number>(`${url}/save`, data);
export const updateAiModelApi = (data: AiModelSaveParams & { id: number }) =>
  requestClient.post<boolean>(`${url}/update`, data);
export const deleteAiModelApi = (id: number) =>
  requestClient.get<boolean>(`${url}/delete/${id}`);
export const enableAiModelsApi = (ids: number[]) =>
  requestClient.get<boolean>(`${url}/enable/${ids.join(',')}`);
export const disableAiModelsApi = (ids: number[]) =>
  requestClient.get<boolean>(`${url}/disable/${ids.join(',')}`);
export const testAiModelConnectionApi = (id: number) =>
  requestClient.get<string>(`${url}/testConnection/${id}`);
export const getAiModelSizeConfigApi = (modelCode: string) =>
  requestClient.get<AiModelSizeConfig | null>(`${url}/sizeConfig`, {
    params: { modelCode },
  });

export async function getAllImageModelsApi() {
  const records: AiModelRecord[] = [];
  let page = 1;
  while (true) {
    const result = await getAiModelPageApi({
      page,
      pageSize: 100,
      modelType: 0,
    });
    records.push(...result.records);
    if (records.length >= result.total || result.records.length === 0)
      return records;
    page += 1;
  }
}
