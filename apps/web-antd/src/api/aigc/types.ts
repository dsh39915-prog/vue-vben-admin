export interface PageResult<T> {
  list: T[];
  total: number;
}

export interface LaunchTask {
  assigneeName?: string;
  businessKey: string;
  currentNodeName?: string;
  id: number;
  processInstanceId?: string;
  productCode: string;
  status: number;
  title: string;
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

export interface WorkbenchTaskContext {
  businessData: Record<string, unknown>;
  formKey?: string;
  processInstanceId: string;
  taskDefinitionKey: string;
  taskId: string;
  taskName: string;
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
