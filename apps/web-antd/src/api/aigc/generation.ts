import { requestClient } from '#/api/request';

import type { GenerationJob } from './types';

export function createGenerationJobApi(data: Record<string, unknown>) {
  return requestClient.post<number>('/aigc/generation/job/create', data);
}

export function getGenerationJobApi(id: number) {
  return requestClient.get<GenerationJob>('/aigc/generation/job/get', {
    params: { id },
  });
}

export function cancelGenerationJobApi(id: number) {
  return requestClient.put<boolean>('/aigc/generation/job/cancel', { id });
}
