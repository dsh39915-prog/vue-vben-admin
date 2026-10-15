import type { AigcPageParams, AigcPageResult } from '#/api';

import { computed, onUnmounted, reactive, ref, shallowRef } from 'vue';

export function useAigcPage<T, Q extends object>(
  fetchPage: (params: AigcPageParams & Q) => Promise<AigcPageResult<T>>,
  initialFilters: Q,
) {
  const rows = shallowRef<T[]>([]);
  const loading = ref(false);
  const total = ref(0);
  const pager = reactive({ current: 1, pageSize: 10 });
  const filters = shallowRef<Q>({ ...initialFilters });
  let latestRequest = 0;
  const pagination = computed(() => ({
    ...pager,
    total: total.value,
    showSizeChanger: true,
    showTotal: (count: number) => `共 ${count} 条`,
  }));

  async function load() {
    const request = ++latestRequest;
    loading.value = true;
    try {
      const result = await fetchPage({
        ...filters.value,
        page: pager.current,
        pageSize: pager.pageSize,
      });
      if (request !== latestRequest) return;
      rows.value = result.records;
      total.value = result.total;
      if (pager.current > 1 && rows.value.length === 0) {
        const lastPage = Math.max(1, Math.ceil(total.value / pager.pageSize));
        if (pager.current > lastPage) {
          pager.current = lastPage;
          await load();
        }
      }
    } catch {
      if (request === latestRequest) {
        rows.value = [];
        total.value = 0;
      }
      // API errors are displayed by the shared request interceptor.
    } finally {
      if (request === latestRequest) loading.value = false;
    }
  }

  function search(nextFilters: Q) {
    filters.value = { ...nextFilters };
    pager.current = 1;
    return load();
  }

  function change(next: { current?: number; pageSize?: number }) {
    pager.current =
      next.pageSize !== undefined && next.pageSize !== pager.pageSize
        ? 1
        : (next.current ?? 1);
    pager.pageSize = next.pageSize ?? pager.pageSize;
    return load();
  }

  onUnmounted(() => {
    latestRequest += 1;
  });
  return {
    change,
    filters,
    load,
    loading,
    pager,
    pagination,
    rows,
    search,
    total,
  };
}
