import { requestClient } from '#/api/request';

import type { CommonStatus, SystemPageParam, SystemPageResult } from './types';

export interface PostRecord {
  code: string;
  createTime?: string;
  id?: number;
  name: string;
  remark?: string;
  sort: number;
  status: CommonStatus;
}

export interface PostPageParams extends SystemPageParam {
  code?: string;
  name?: string;
  status?: CommonStatus;
}

export const getPostPageApi = (params: PostPageParams) =>
  requestClient.get<SystemPageResult<PostRecord>>('/system/post/page', {
    params,
  });

export const getSimplePostListApi = () =>
  requestClient.get<PostRecord[]>('/system/post/simple-list');

export const getAllSimplePostListApi = () =>
  requestClient.get<PostRecord[]>('/system/post/list-all-simple');

export const getPostApi = (id: number) =>
  requestClient.get<PostRecord>('/system/post/get', { params: { id } });

export const createPostApi = (data: PostRecord) =>
  requestClient.post<number>('/system/post/create', data);

export const updatePostApi = (data: PostRecord) =>
  requestClient.put<boolean>('/system/post/update', data);

export const deletePostApi = (id: number) =>
  requestClient.delete<boolean>('/system/post/delete', { params: { id } });

export const deletePostListApi = (ids: number[]) =>
  requestClient.delete<boolean>('/system/post/delete-list', {
    params: { ids: ids.join(',') },
  });

export const exportPostApi = (
  params: Omit<PostPageParams, 'pageNo' | 'pageSize'>,
) => requestClient.download('/system/post/export-excel', { params });
