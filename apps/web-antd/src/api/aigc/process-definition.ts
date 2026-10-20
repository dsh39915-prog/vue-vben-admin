import { requestClient } from '#/api/request';

export interface ProcessDeployParams {
  processKey: string;
  processName: string;
}
export interface ProcessDeployment {
  id: string;
  name?: string;
  key?: string;
  category?: string;
  tenantId?: string;
  deploymentTime?: string;
}
// nodeList returns maps with backend-defined fields, rather than a fixed node DTO.
export type ProcessDefinitionNode = Record<string, string>;

export const getProcessDefinitionNodesApi = (processDefinitionKey: string) =>
  requestClient.get<ProcessDefinitionNode[]>('/flycowerp/bpmnTest/nodeList', {
    params: { processDefinitionKey },
  });
export const deployProcessDefinitionApi = (data: ProcessDeployParams) =>
  requestClient.post<ProcessDeployment>('/flycowerp/bpmnTest/deploy', data);
