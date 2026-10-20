export interface PageResult<T> {
  list: T[];
  total: number;
}

export interface GenerationJob {
  completedCount: number;
  createdAt: string;
  failedCount: number;
  id: number;
  progress: number;
  provider: string;
  status:
    | 'CANCELED'
    | 'FAILED'
    | 'PARTIAL_SUCCESS'
    | 'QUEUED'
    | 'RUNNING'
    | 'SUCCESS';
  totalCount: number;
  type: 'IMAGE' | 'VIDEO';
}

export interface AigcPageParams {
  page: number;
  pageSize: number;
}

export interface AigcPageResult<T> {
  current: number;
  records: T[];
  size: number;
  total: number;
}
