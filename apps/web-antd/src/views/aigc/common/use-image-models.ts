import type { AiModelRecord } from '#/api';

import { computed, ref, shallowRef } from 'vue';

import { getAllImageModelsApi } from '#/api';

export function useImageModels() {
  const models = shallowRef<AiModelRecord[]>([]);
  const modelsLoading = ref(false);
  const modelOptions = computed(() =>
    models.value.map((item) => ({ label: item.modelName, value: item.id })),
  );
  async function loadModels() {
    modelsLoading.value = true;
    try {
      models.value = await getAllImageModelsApi();
    } catch {
      // API errors are displayed by the shared request interceptor.
    } finally {
      modelsLoading.value = false;
    }
  }
  function modelName(id?: number) {
    return (
      models.value.find((item) => item.id === id)?.modelName ??
      (id === undefined ? '-' : `模型 #${id}`)
    );
  }
  return { loadModels, modelName, modelOptions, models, modelsLoading };
}
