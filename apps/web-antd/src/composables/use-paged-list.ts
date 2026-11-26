import type { TablePaginationConfig } from 'ant-design-vue';

import { onBeforeUnmount, reactive, ref, shallowRef } from 'vue';

export interface PageResult<T> {
  current?: number;
  page?: number;
  pageSize?: number;
  records: T[];
  size?: number;
  total: number;
}

/** 兼容业务和系统分页格式，统一末页回退、请求时序和批量选择清理。 */
export function usePagedList<T>(
  fetcher: (
    page: number,
    size: number,
    signal: AbortSignal,
  ) => Promise<PageResult<T>>,
  options: { blocked?: () => boolean; pageSize?: number } = {},
) {
  const records = shallowRef<T[]>([]);
  const loading = ref(false);
  const failed = ref(false);
  const selectedIds = ref<number[]>([]);
  const pagination = reactive({
    current: 1,
    pageSize: options.pageSize ?? 20,
    total: 0,
  });
  let requestId = 0;
  let controller: AbortController | undefined;
  function cancel() {
    ++requestId;
    controller?.abort();
    loading.value = false;
    selectedIds.value = [];
  }
  async function load(
    page = pagination.current,
    pageSize = pagination.pageSize,
  ): Promise<void> {
    controller?.abort();
    const currentController = new AbortController();
    controller = currentController;
    const request = ++requestId;
    loading.value = true;
    failed.value = false;
    selectedIds.value = [];
    try {
      const data = await fetcher(page, pageSize, currentController.signal);
      if (request !== requestId) return;
      const size = data.pageSize || data.size || pageSize;
      const lastPage = Math.max(1, Math.ceil(data.total / size));
      if (page > lastPage) {
        await load(lastPage, pageSize);
        return;
      }
      records.value = data.records;
      Object.assign(pagination, {
        current: data.current ?? data.page ?? page,
        pageSize: size,
        total: data.total,
      });
    } catch {
      if (request === requestId && !currentController.signal.aborted)
        failed.value = true;
    } finally {
      if (request === requestId) loading.value = false;
    }
  }
  function change(value: TablePaginationConfig) {
    if (loading.value || failed.value || options.blocked?.()) return;
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
