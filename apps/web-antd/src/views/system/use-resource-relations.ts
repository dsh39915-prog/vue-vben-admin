import type { AdminRow } from './resource-types';

import type { SystemResource } from '#/api';

import { onBeforeUnmount, reactive, ref } from 'vue';

import { getSystemResourceListApi, getSystemRoleOptionsApi } from '#/api';

import { flattenResources } from './resource-types';

export function useResourceRelations(
  can: (resource: SystemResource, action: string) => boolean,
) {
  const relations = reactive<Partial<Record<SystemResource, AdminRow[]>>>({});
  const loading = ref(false);
  const failures = ref<SystemResource[]>([]);
  let requestId = 0;
  function cancel() {
    ++requestId;
    loading.value = false;
  }
  async function load(resources: SystemResource[]) {
    const request = ++requestId;
    loading.value = true;
    failures.value = [];
    await Promise.all(
      [...new Set(resources)].map(async (resource) => {
        if (!can(resource, 'read')) return;
        try {
          const data =
            resource === 'roles'
              ? await getSystemRoleOptionsApi()
              : await getSystemResourceListApi(resource);
          if (request === requestId)
            relations[resource] = flattenResources(
              Array.isArray(data) ? data : data.records,
            );
        } catch {
          if (request === requestId) failures.value.push(resource);
        }
      }),
    );
    if (request === requestId) loading.value = false;
  }
  function options(resource: SystemResource) {
    return (relations[resource] ?? []).map((row) => ({
      label: String(row.name || row.realName || row.username || row.id),
      value: row.id,
    }));
  }
  onBeforeUnmount(cancel);
  return { cancel, failures, load, loading, options, relations };
}
