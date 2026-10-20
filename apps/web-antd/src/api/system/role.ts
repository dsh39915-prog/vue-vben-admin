import type { CommonStatus, SystemPageParam, SystemPageResult } from './types';

import { requestClient } from '#/api/request';

export interface RoleRecord {
  code: string;
  createTime?: string;
  dataScope?: number;
  dataScopeDeptIds?: number[];
  id?: number;
  name: string;
  remark?: string;
  sort: number;
  status: CommonStatus;
  type?: number;
}

export interface RolePageParams extends SystemPageParam {
  code?: string;
  createTime?: string[];
  name?: string;
  status?: CommonStatus;
}

export const getRolePageApi = (params: RolePageParams) =>
  requestClient.get<SystemPageResult<RoleRecord>>('/system/role/page', {
    params,
    paramsSerializer: 'repeat',
  });

export const getSimpleRoleListApi = () =>
  requestClient.get<RoleRecord[]>('/system/role/simple-list');

export const getAllSimpleRoleListApi = () =>
  requestClient.get<RoleRecord[]>('/system/role/list-all-simple');

export const getRoleApi = (id: number) =>
  requestClient.get<RoleRecord>('/system/role/get', { params: { id } });

export const createRoleApi = (data: RoleRecord) =>
  requestClient.post<number>('/system/role/create', data);

export const updateRoleApi = (data: RoleRecord) =>
  requestClient.put<boolean>('/system/role/update', data);

export const deleteRoleApi = (id: number) =>
  requestClient.delete<boolean>('/system/role/delete', { params: { id } });

export const deleteRoleListApi = (ids: number[]) =>
  requestClient.delete<boolean>('/system/role/delete-list', {
    params: { ids: ids.join(',') },
  });

export const exportRoleApi = (
  params: Omit<RolePageParams, 'pageNo' | 'pageSize'>,
) =>
  requestClient.download('/system/role/export-excel', {
    params,
    paramsSerializer: 'repeat',
  });
