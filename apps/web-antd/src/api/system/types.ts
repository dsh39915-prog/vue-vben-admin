export interface SystemPageParam {
  pageNo: number;
  pageSize: number;
}

export interface SystemPageResult<T> {
  list: T[];
  total: number;
}

export type CommonStatus = 0 | 1;
