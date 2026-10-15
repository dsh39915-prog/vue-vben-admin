import type { PageResult } from './types';

import { requestClient } from '#/api/request';

export type LibraryType = 0 | 1 | 2;

export interface LibraryCategorySaveParams {
  categoryName: string;
  id?: number;
  libraryType: LibraryType;
}

export interface LibraryCategoryRecord extends LibraryCategorySaveParams {
  id: number;
  parentId: number;
}

export interface LibraryCategoryFilters {
  categoryName?: string;
  libraryType?: LibraryType;
  status?: number;
}

export interface LibraryImageFilters {
  categoryId?: number;
  imageName?: string;
  libraryType?: LibraryType;
  status?: number;
}

export interface LibraryPageParams {
  pageNo: number;
  pageSize: number;
}

export interface LibraryImageRecord {
  categoryId: number;
  categoryName?: null | string;
  createTime?: string;
  id: number;
  imageName: string;
  libraryType: LibraryType;
  originalUrl: string;
  previewUrl?: null | string;
  status?: number;
  thumbnailUrl?: null | string;
}

export interface LibraryImageUploadParams {
  categoryId: number;
  imageName: string;
  libraryType: LibraryType;
}

const categoryUrl = '/flycowerp/library-category';
const imageUrl = '/flycowerp/library-image';

export const getLibraryCategoryPageApi = (
  params: LibraryCategoryFilters & LibraryPageParams,
) =>
  requestClient.get<PageResult<LibraryCategoryRecord>>(`${categoryUrl}/page`, {
    params,
  });
export const getLibraryCategoryTreeApi = (libraryType: LibraryType) =>
  requestClient.get<LibraryCategoryRecord[]>(`${categoryUrl}/tree`, {
    params: { libraryType },
  });
export const getLibraryCategoryApi = (id: number) =>
  requestClient.get<LibraryCategoryRecord | null>(`${categoryUrl}/get`, {
    params: { id },
  });
export const createLibraryCategoryApi = (data: LibraryCategorySaveParams) =>
  requestClient.post<number>(`${categoryUrl}/create`, data);
export const updateLibraryCategoryApi = (
  data: LibraryCategorySaveParams & { id: number },
) => requestClient.put<boolean>(`${categoryUrl}/update`, data);
export const deleteLibraryCategoryApi = (id: number) =>
  requestClient.delete<boolean>(`${categoryUrl}/delete`, { params: { id } });

export const getLibraryImagePageApi = (
  params: LibraryImageFilters & LibraryPageParams,
) =>
  requestClient.get<PageResult<LibraryImageRecord>>(`${imageUrl}/page`, {
    params,
  });
export const getLibraryImageApi = (id: number) =>
  requestClient.get<LibraryImageRecord | null>(`${imageUrl}/get`, {
    params: { id },
  });
export const deleteLibraryImageApi = (id: number) =>
  requestClient.delete<boolean>(`${imageUrl}/delete`, { params: { id } });
// Swagger specifies metadata as query parameters; the file uses multipart form data.
export const uploadLibraryImageApi = (
  file: File,
  params: LibraryImageUploadParams,
) =>
  requestClient.upload<number>(
    `${imageUrl}/upload`,
    { file },
    { params, timeout: 60_000 },
  );
