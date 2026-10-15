import { requestClient } from '#/api/request';

import type { CommonStatus, SystemPageParam, SystemPageResult } from './types';

export interface UserRecord {
  avatar?: string;
  createTime?: string;
  deptId?: number;
  deptName?: string;
  email?: string;
  id?: number;
  loginDate?: string;
  loginIp?: string;
  mobile?: string;
  nickname: string;
  password?: string;
  postIds?: number[];
  remark?: string;
  sex?: number;
  status?: CommonStatus;
  username: string;
}

export interface UserPageParams extends SystemPageParam {
  createTime?: string[];
  deptId?: number;
  mobile?: string;
  roleId?: number;
  status?: CommonStatus;
  username?: string;
}

export interface UserImportResult {
  createUsernames: string[];
  failureUsernames: Record<string, string>;
  updateUsernames: string[];
}

export const getUserPageApi = (params: UserPageParams) =>
  requestClient.get<SystemPageResult<UserRecord>>('/system/user/page', {
    params,
  });

export const getUserListApi = (ids: number[]) =>
  requestClient.get<UserRecord[]>('/system/user/list', {
    params: { ids: ids.join(',') },
  });

export const getSimpleUserListApi = () =>
  requestClient.get<UserRecord[]>('/system/user/simple-list');

export const getAllSimpleUserListApi = () =>
  requestClient.get<UserRecord[]>('/system/user/list-all-simple');

export const getSimpleUserApi = (id: number) =>
  requestClient.get<UserRecord>('/system/user/get-simple', { params: { id } });

export const searchSimpleUsersApi = (nickname: string) =>
  requestClient.get<UserRecord[]>('/system/user/list-by-nickname', {
    params: { nickname },
  });

export const getUserApi = (id: number) =>
  requestClient.get<UserRecord>('/system/user/get', { params: { id } });

export const createUserApi = (data: UserRecord) =>
  requestClient.post<number>('/system/user/create', data);

export const updateUserApi = (data: UserRecord) =>
  requestClient.put<boolean>('/system/user/update', data);

export const updateUserStatusApi = (id: number, status: CommonStatus) =>
  requestClient.put<boolean>('/system/user/update-status', { id, status });

export const resetUserPasswordApi = (id: number, password: string) =>
  requestClient.put<boolean>('/system/user/update-password', { id, password });

export const deleteUserApi = (id: number) =>
  requestClient.delete<boolean>('/system/user/delete', { params: { id } });

export const deleteUserListApi = (ids: number[]) =>
  requestClient.delete<boolean>('/system/user/delete-list', {
    params: { ids: ids.join(',') },
  });

export const exportUserApi = (
  params: Omit<UserPageParams, 'pageNo' | 'pageSize'>,
) => requestClient.download('/system/user/export-excel', { params });

export const getUserImportTemplateApi = () =>
  requestClient.download('/system/user/get-import-template');

export const importUserApi = (file: File, updateSupport: boolean) =>
  requestClient.upload<UserImportResult>('/system/user/import', {
    file,
    updateSupport,
  });
