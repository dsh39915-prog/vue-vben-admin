import type { AppCategory, AppSort } from '#/api';

import { onActivated, onBeforeUnmount, reactive, ref, watch } from 'vue';

import { getAppCategoryListApi } from '#/api';

const revision = ref(0);
const cacheLifetime = 5 * 60 * 1000;

export function invalidateAppCategories() {
  revision.value += 1;
}

/** 每个页面保留自己的加载状态；分类修改通知所有已打开页面失效。 */
export function useAppCategories() {
  const categories = reactive<Partial<Record<AppSort, AppCategory[]>>>({});
  const loading = reactive({ 1: false, 2: false });
  const failed = reactive({ 1: false, 2: false });
  const timestamps = new Map<AppSort, number>();
  const pending = new Map<AppSort, Promise<void>>();
  const requests = new Map<AppSort, number>();
  const requested = new Set<AppSort>();
  let disposed = false;
  function load(sort: AppSort, force = false): Promise<void> {
    requested.add(sort);
    if (
      !force &&
      !failed[sort] &&
      categories[sort] &&
      Date.now() - (timestamps.get(sort) ?? 0) < cacheLifetime
    )
      return Promise.resolve();
    const current = pending.get(sort);
    if (current && !force) return current;
    const id = (requests.get(sort) ?? 0) + 1;
    requests.set(sort, id);
    loading[sort] = true;
    failed[sort] = false;
    const request = (async () => {
      try {
        const data = await getAppCategoryListApi(sort);
        if (disposed || requests.get(sort) !== id) return;
        categories[sort] = data.filter((item) => item.id > 0);
        timestamps.set(sort, Date.now());
      } catch {
        if (!disposed && requests.get(sort) === id) failed[sort] = true;
      } finally {
        if (!disposed && requests.get(sort) === id) {
          loading[sort] = false;
          pending.delete(sort);
        }
      }
    })();
    pending.set(sort, request);
    return request;
  }
  async function refresh() {
    await Promise.all([...requested].map((sort) => load(sort, true)));
  }
  watch(revision, () => {
    timestamps.clear();
    void refresh();
  });
  onActivated(() => {
    for (const sort of requested) void load(sort);
  });
  onBeforeUnmount(() => {
    disposed = true;
  });
  return { categories, failed, load, loading, refresh };
}
