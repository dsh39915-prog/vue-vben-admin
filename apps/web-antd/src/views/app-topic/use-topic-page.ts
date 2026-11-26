import type { TablePaginationConfig } from 'ant-design-vue';

import type { AppTopicPage } from '#/api';

import { onBeforeUnmount, reactive, ref, shallowRef } from 'vue';

/** 专题及其应用使用相同的分页、请求时序与选择清理规则。 */
export function useTopicPage<T>(
  fetcher: (page: number, size: number) => Promise<AppTopicPage<T>>,
  blocked: () => boolean,
) {
  const records = shallowRef<T[]>([]);
  const loading = ref(false);
  const failed = ref(false);
  const selectedIds = ref<number[]>([]);
  const pagination = reactive({ current: 1, pageSize: 20, total: 0 });
  let requestId = 0;
  function cancel() {
    ++requestId;
    loading.value = false;
    selectedIds.value = [];
  }
  async function load(
    page = pagination.current,
    pageSize = pagination.pageSize,
  ) {
    const request = ++requestId;
    loading.value = true;
    failed.value = false;
    selectedIds.value = [];
    try {
      const data = await fetcher(page, pageSize);
      if (request !== requestId) return;
      const lastPage = Math.max(
        1,
        Math.ceil(data.total / (data.size || pageSize)),
      );
      if (page > lastPage) {
        await load(lastPage, pageSize);
        return;
      }
      records.value = data.records;
      Object.assign(pagination, {
        current: data.current,
        pageSize: data.size,
        total: data.total,
      });
    } catch {
      if (request === requestId) failed.value = true;
    } finally {
      if (request === requestId) loading.value = false;
    }
  }
  function change(value: TablePaginationConfig) {
    if (loading.value || failed.value || blocked()) return;
    const size = value.pageSize ?? pagination.pageSize;
    void load(size === pagination.pageSize ? (value.current ?? 1) : 1, size);
  }
  onBeforeUnmount(cancel);
  return {
    cancel,
    change,
    failed,
    load,
    loading,
    pagination,
    records,
    selectedIds,
  };
}
