import type { CommonStatus } from './types';

import { requestClient } from '#/api/request';

export interface MenuRecord {
  alwaysShow?: boolean;
  component?: string;
  componentName?: string;
  createTime?: string;
  icon?: string;
  id?: number;
  keepAlive?: boolean;
  name: string;
  parentId: number;
  path?: string;
  permission?: string;
  sort: number;
  status: CommonStatus;
  type: number;
  visible?: boolean;
}

export type SimpleMenuRecord = Required<
  Pick<MenuRecord, 'id' | 'name' | 'parentId' | 'type'>
>;

export interface MenuListParams {
  name?: string;
  status?: CommonStatus;
}

export const getMenuListApi = (params?: MenuListParams) =>
  requestClient.get<MenuRecord[]>('/system/menu/list', { params });

export const getSimpleMenuListApi = () =>
  requestClient.get<SimpleMenuRecord[]>('/system/menu/simple-list');

export const getAllSimpleMenuListApi = () =>
  requestClient.get<SimpleMenuRecord[]>('/system/menu/list-all-simple');

export const getMenuApi = (id: number) =>
  requestClient.get<MenuRecord>('/system/menu/get', { params: { id } });

export const createMenuApi = (data: MenuRecord) =>
  requestClient.post<number>('/system/menu/create', data);

export const updateMenuApi = (data: MenuRecord) =>
  requestClient.put<boolean>('/system/menu/update', data);

export const deleteMenuApi = (id: number) =>
  requestClient.delete<boolean>('/system/menu/delete', { params: { id } });

export const deleteMenuListApi = (ids: number[]) =>
  requestClient.delete<boolean>('/system/menu/delete-list', {
    params: { ids: ids.join(',') },
  });
