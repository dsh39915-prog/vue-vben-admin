import { requestClient } from '#/api/request';

import type { CommonStatus } from './types';

export interface DeptRecord {
  createTime?: string;
  email?: string;
  id?: number;
  leaderUserId?: number;
  name: string;
  parentId?: number;
  phone?: string;
  sort: number;
  status: CommonStatus;
}

export interface DeptListParams {
  name?: string;
  status?: CommonStatus;
}

export const getDeptListApi = (params?: DeptListParams) =>
  requestClient.get<DeptRecord[]>('/system/dept/list', { params });

export const getSimpleDeptListApi = () =>
  requestClient.get<DeptRecord[]>('/system/dept/simple-list');

export const getAllSimpleDeptListApi = () =>
  requestClient.get<DeptRecord[]>('/system/dept/list-all-simple');

export const getDeptApi = (id: number) =>
  requestClient.get<DeptRecord>('/system/dept/get', { params: { id } });

export const createDeptApi = (data: DeptRecord) =>
  requestClient.post<number>('/system/dept/create', data);

export const updateDeptApi = (data: DeptRecord) =>
  requestClient.put<boolean>('/system/dept/update', data);

export const deleteDeptApi = (id: number) =>
  requestClient.delete<boolean>('/system/dept/delete', { params: { id } });

export const deleteDeptListApi = (ids: number[]) =>
  requestClient.delete<boolean>('/system/dept/delete-list', {
    params: { ids: ids.join(',') },
  });
