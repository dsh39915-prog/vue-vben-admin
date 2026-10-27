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
  coordStyleId?: WorkflowId;
}
export interface WorkflowContext {
  procInstId: string;
  nodeTaskId: string;
  nodeKey: string;
}
export interface FlowDraftSaveParams extends WorkflowContext {
  formDataJson: string;
}
export const saveFlowDraftApi = (data: FlowDraftSaveParams) =>
  requestClient.post<WorkflowId>('/flycowerp/flow/draft/save', data);
export const getFlowDraftApi = (
  params: Pick<WorkflowContext, 'nodeKey' | 'procInstId'>,
) => requestClient.get<null | string>('/flycowerp/flow/draft/get', { params });
export interface WorkflowRemark {
  contentText?: string;
  imageUrls?: WorkflowImage[];
}
export interface MatchingScheme {
  id?: WorkflowId;
  styleId?: WorkflowId;
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
  sceneImageUrls?: WorkflowImage[];
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
  | 'hasOtherStyle'
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
      'hasOtherStyle' | 'id' | 'styleId' | 'styleName' | 'styleNo'
    >
  ]?: MatchingScheme[K] | null | string;
} & {
  hasOtherStyle?: 0 | 1 | boolean | null;
};
export interface MatchingSchemeSaveParams extends WorkflowContext {
  schemes: (Omit<MatchingScheme, 'hasOtherStyle'> & {
    hasOtherStyle: 0 | 1;
  })[];
  remarkInfoVO?: WorkflowRemark;
}
export interface ProductStyle {
  id: WorkflowId;
  styleNo: string;
  styleName: string;
  clothingProductUrl?: WorkflowImage;
  aiMatchingScheme?: null | Omit<
    MatchingSchemeRecord,
    'id' | 'styleName' | 'styleNo'
  >;
  aiModelImageUrls?: WorkflowImage[];
  aiActionImageUrls?: WorkflowImage[];
  retouchedModelImageUrls?: WorkflowImage[];
  retouchedActionImageUrls?: WorkflowImage[];
  productMainImageUrls?: WorkflowImage[];
  productDetailImageUrls?: WorkflowImage[];
}
interface ProductStyleRecord extends Omit<
  ProductStyle,
  | 'aiActionImageUrls'
  | 'aiModelImageUrls'
  | 'clothingProductUrl'
  | 'productDetailImageUrls'
  | 'productMainImageUrls'
  | 'retouchedActionImageUrls'
  | 'retouchedModelImageUrls'
> {
  clothingProductUrl?: null | string | WorkflowImage;
  aiModelImageUrls?: null | string | WorkflowImage[];
  aiActionImageUrls?: null | string | WorkflowImage[];
  retouchedModelImageUrls?: null | string | WorkflowImage[];
  retouchedActionImageUrls?: null | string | WorkflowImage[];
  productMainImageUrls?: null | string | WorkflowImage[];
  productDetailImageUrls?: null | string | WorkflowImage[];
}
function productStyleModelImages(
  value: ProductStyleRecord['aiModelImageUrls'],
  label = '已提交模特图',
): WorkflowImage[] {
  if (!value || value === 'null') return [];
  if (typeof value === 'string') {
    if (!value.trim()) return [];
    return productStyleModelImages(JSON.parse(value), label);
  }
  if (!Array.isArray(value)) throw new Error(`${label}数据格式不正确`);
  return value.map((image) => {
    if (
      !image ||
      typeof image.originalUrl !== 'string' ||
      !image.originalUrl.trim()
    )
      throw new Error(`${label}数据格式不正确`);
    return {
      ...image,
      previewUrl: image.previewUrl || image.originalUrl,
      thumbnailUrl: image.thumbnailUrl || image.previewUrl || image.originalUrl,
    };
  });
}
function productStyleImage(
  value: ProductStyleRecord['clothingProductUrl'],
): undefined | WorkflowImage {
  if (!value || value === 'null') return;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return;
    if (/^https?:\/\//i.test(text) || /^\/(?!\/)/.test(text))
      return { originalUrl: text, previewUrl: text, thumbnailUrl: text };
    return productStyleImage(JSON.parse(text));
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return;
    if (value.length !== 1) throw new Error('每个款式只能有一张主服饰图');
    return productStyleImage(value[0]);
  }
  if (
    typeof value !== 'object' ||
    typeof value.originalUrl !== 'string' ||
    !value.originalUrl.trim()
  )
    throw new Error('服装商品图数据格式不正确');
  return {
    ...value,
    previewUrl: value.previewUrl || value.originalUrl,
    thumbnailUrl: value.thumbnailUrl || value.previewUrl || value.originalUrl,
  };
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
  id?: WorkflowId;
  nodeKey?: string;
  operateTime?: string;
  nodeName?: string;
  operateTypeName?: string;
  operatorName?: string;
  contentText?: string;
  imageUrls?: (string | WorkflowImage)[] | null | string;
}
export interface FlowNodeDetail {
  planId?: null | WorkflowId;
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
export interface FlowNodeRoundOperate {
  actualStartTime?: null | string;
  actualCompleteTime?: null | string;
  actualDuration?: null | number;
  operateTypeName: string;
  operatorName: string;
  contentText?: null | string;
  imageUrls?: FlowTransferRecord['imageUrls'];
}
export interface FlowNodeRoundRecord {
  roundNo: number;
  roundSource: string;
  operateList: FlowNodeRoundOperate[];
}
export interface FlowNodeDetailInfo {
  nodeName: string;
  nodeStatusText?: null | string;
  totalExecuteCount: number;
  totalRejectCount: number;
  planStartTime?: null | string;
  planEndTime?: null | string;
  firstActualStartTime?: null | string;
  lastActualCompleteTime?: null | string;
  planDuration?: null | number;
  actualDuration?: null | number;
  dateOverdueDesc?: null | string;
  timeOverdueDesc?: null | string;
  roundRecordList?: FlowNodeRoundRecord[] | null;
}

export const getMatchingSchemesApi = (taskId: number) =>
  requestClient.get<MatchingSchemeRecord[]>(
    '/flycowerp/aiMatchingScheme/list',
    { params: { taskId } },
  );
export const saveMatchingSchemesApi = (data: MatchingSchemeSaveParams) =>
  requestClient.post<WorkflowId[]>('/flycowerp/aiMatchingScheme/save', data);
function decodeProductStyle(style: ProductStyleRecord): ProductStyle {
  return {
    ...style,
    clothingProductUrl: productStyleImage(style.clothingProductUrl),
    retouchedModelImageUrls:
      style.retouchedModelImageUrls === undefined
        ? undefined
        : productStyleModelImages(style.retouchedModelImageUrls, '精修模特图'),
    retouchedActionImageUrls:
      style.retouchedActionImageUrls === undefined
        ? undefined
        : productStyleModelImages(style.retouchedActionImageUrls, '精修动作图'),
    productMainImageUrls:
      style.productMainImageUrls === undefined
        ? undefined
        : productStyleModelImages(style.productMainImageUrls, '商品主图'),
    productDetailImageUrls:
      style.productDetailImageUrls === undefined
        ? undefined
        : productStyleModelImages(style.productDetailImageUrls, '详情页图'),
    aiModelImageUrls: productStyleModelImages(style.aiModelImageUrls),
    aiActionImageUrls: productStyleModelImages(
      style.aiActionImageUrls,
      '已提交动作图',
    ),
  };
}
export const getProductStylesApi = async (
  taskId: number,
): Promise<ProductStyle[]> => {
  const data = await requestClient.get<ProductStyleRecord[]>(
    '/flycowerp/newProductStyle/list',
    { params: { taskId } },
  );
  if (!Array.isArray(data)) throw new Error('款式列表格式不正确');
  return data.map(decodeProductStyle);
};
export const queryMatchStylesApi = async (
  styleNo: string,
): Promise<ProductStyle[]> => {
  const data = await requestClient.get<ProductStyleRecord[]>(
    '/flycowerp/newProductStyle/queryMatchStyleList',
    { params: { styleNo: styleNo.trim() } },
  );
  if (!Array.isArray(data)) throw new Error('服饰款式列表格式不正确');
  return data.map(decodeProductStyle);
};
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
export const getFlowNodeDetailInfoApi = (planId: WorkflowId) =>
  requestClient.get<FlowNodeDetailInfo | null>(
    '/flycowerp/flow/nodeDetailInfo',
    { params: { planId } },
  );
export const uploadWorkflowImageApi = (file: File) =>
  requestClient.upload<WorkflowImage>(
    '/flycowerp/temp-image/upload',
    { file },
    { timeout: 60_000 },
  );
