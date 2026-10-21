import type { RequestResponse } from '@vben/request';

import { requestClient } from '#/api/request';

export type WorkflowId = number | string;
export interface WorkflowImage {
  originalUrl: string;
  previewUrl: string;
  thumbnailUrl: string;
  imageId?: string;
  styleNo?: string;
  isMain?: number;
}
export interface WorkflowContext {
  procInstId: string;
  nodeTaskId: string;
  nodeKey: string;
}
export interface WorkflowRemark {
  contentText?: string;
  imageUrls?: WorkflowImage[];
}
export interface MatchingScheme {
  id?: WorkflowId;
  styleNo: string;
  styleName: string;
  hasOtherStyle: boolean;
  aiMatchingImageUrl?: WorkflowImage;
  mainReferenceFrontUrl?: WorkflowImage;
  mainReferenceSideUrl?: WorkflowImage;
  mainReferenceBackUrl?: WorkflowImage;
  mainReferenceVisionUrl?: WorkflowImage;
  clothingProductUrls: WorkflowImage[];
  fullBodyReferenceUrls?: WorkflowImage[];
  propImageUrls?: WorkflowImage;
  modelImageUrls?: WorkflowImage;
  sceneImageUrls?: WorkflowImage;
  lightReferenceUrl?: WorkflowImage;
  versionReferenceUrl?: WorkflowImage;
  otherReferenceUrls?: WorkflowImage[];
  aiGeneratedImageUrls?: WorkflowImage[];
}
export type MatchingSchemeRecord = Omit<
  MatchingScheme,
  | 'aiGeneratedImageUrls'
  | 'aiMatchingImageUrl'
  | 'clothingProductUrls'
  | 'fullBodyReferenceUrls'
  | 'lightReferenceUrl'
  | 'mainReferenceBackUrl'
  | 'mainReferenceFrontUrl'
  | 'mainReferenceSideUrl'
  | 'mainReferenceVisionUrl'
  | 'modelImageUrls'
  | 'otherReferenceUrls'
  | 'propImageUrls'
  | 'sceneImageUrls'
  | 'versionReferenceUrl'
> & {
  [
    K in keyof Omit<
      MatchingScheme,
      'hasOtherStyle' | 'id' | 'styleName' | 'styleNo'
    >
  ]?: MatchingScheme[K] | null | string;
};
export interface MatchingSchemeSaveParams extends WorkflowContext {
  schemes: MatchingScheme[];
  status: 0 | 1;
  remarkInfoVO?: WorkflowRemark;
}
export interface ProductStyle {
  id: WorkflowId;
  styleNo: string;
  styleName: string;
  clothingProductUrl?: WorkflowImage;
}
export type StyleImageField =
  | 'aiActionImageUrls'
  | 'aiModelImageUrls'
  | 'productDetailImageUrls'
  | 'productMainImageUrls'
  | 'retouchedActionImageUrls'
  | 'retouchedModelImageUrls';
export type StyleImageItem = Partial<
  Record<StyleImageField, WorkflowImage[]>
> & { styleId: WorkflowId };
export interface StyleImagesSaveParams extends WorkflowContext {
  items: StyleImageItem[];
  remarkInfoVO?: WorkflowRemark;
}
export interface FlowAssignParams extends WorkflowContext {
  assignMode: 'style_split' | 'unified';
  unifiedAssigneeId?: string;
  unifiedAssigneeName?: string;
  styleAssignList?: {
    styleId: WorkflowId;
    assigneeId: string;
    assigneeName: string;
  }[];
  remarkInfoVO?: WorkflowRemark;
}
export interface FlowAssignBatchParams {
  nodeKey: string;
  tasks: Pick<WorkflowContext, 'nodeTaskId' | 'procInstId'>[];
  unifiedAssigneeId: string;
  unifiedAssigneeName: string;
}
export interface FlowAuditParams extends WorkflowContext {
  auditInfoVO: WorkflowRemark & { auditStatus: 1 | 2 };
}
export interface FlowFreezeParams extends WorkflowContext {
  remarkInfoVO?: WorkflowRemark;
}
export interface FlowTransferRecord {
  operateTime?: string;
  nodeName?: string;
  operateTypeName?: string;
  operatorName?: string;
  contentText?: string;
}
export interface FlowNodeDetail {
  nodeName?: string;
  nodeStatusText?: string;
  planStartTime?: string;
  planEndTime?: string;
  planDuration?: number;
  actualStartTime?: string;
  actualCompleteTime?: string;
  actualDuration?: number;
  dateOverdueDesc?: string;
  timeOverdueDesc?: string;
  assigneeName?: string;
}

export const getMatchingSchemesApi = (taskId: number) =>
  requestClient.get<MatchingSchemeRecord[]>(
    '/flycowerp/aiMatchingScheme/list',
    { params: { taskId } },
  );
export const saveMatchingSchemesApi = (data: MatchingSchemeSaveParams) =>
  requestClient.post<WorkflowId[]>('/flycowerp/aiMatchingScheme/save', data);
export const getProductStylesApi = (taskId: number) =>
  requestClient.get<ProductStyle[]>('/flycowerp/newProductStyle/list', {
    params: { taskId },
  });
export const saveStyleImagesApi = (data: StyleImagesSaveParams) =>
  requestClient.post<boolean>('/flycowerp/newProductStyle/saveImageData', data);
export const downloadStyleMaterialsApi = (params: WorkflowContext) =>
  requestClient.download<RequestResponse<Blob>>(
    '/flycowerp/newProductStyle/downloadMaterials',
    { params, responseReturn: 'raw', timeout: 120_000 },
  );
export const assignFlowTaskApi = (data: FlowAssignParams) =>
  requestClient.post<boolean>('/flycowerp/flow/assign', data);
export const assignFlowTasksBatchApi = (data: FlowAssignBatchParams) =>
  requestClient.post<boolean>('/flycowerp/flow/assign/batch', data);
export const auditFlowTaskApi = (data: FlowAuditParams) =>
  requestClient.post<boolean>('/flycowerp/flow/audit', data);
export const freezeFlowNodeApi = (data: FlowFreezeParams) =>
  requestClient.post<boolean>('/flycowerp/flow/freeze', data);
export const unfreezeFlowNodeApi = (data: FlowFreezeParams) =>
  requestClient.post<boolean>('/flycowerp/flow/unfreeze', data);
export const getFlowTransfersApi = async (procInstId: string) => {
  const data = await requestClient.get<'' | FlowTransferRecord[] | null>(
    '/flycowerp/flow/transferRecordList',
    { params: { procInstId } },
  );
  if (data === '' || data === null)
    throw new Error('流转记录接口未返回有效数据');
  if (!Array.isArray(data)) throw new Error('流转记录格式不正确');
  return data;
};
export const getFlowNodesApi = (businessKey: string, businessType: number) =>
  requestClient.get<FlowNodeDetail[]>('/flycowerp/flow/nodeDetailList', {
    params: { businessKey, businessType },
  });
export const uploadWorkflowImageApi = (file: File) =>
  requestClient.upload<WorkflowImage>(
    '/flycowerp/temp-image/upload',
    { file },
    { timeout: 60_000 },
  );
