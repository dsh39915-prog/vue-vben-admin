import type { App } from 'vue';

import type { AppCategory, AppSort } from '#/api';

import { getCurrentInstance, onActivated, reactive, ref, watch } from 'vue';

import { getAppCategoryListApi } from '#/api';

const revision = ref(0);
const sessionRevision = ref(0);
const cacheLifetime = 5 * 60 * 1000;
function createCache() {
  return {
    categories: reactive<Partial<Record<AppSort, AppCategory[]>>>({}),
    loading: reactive({ 1: false, 2: false }),
    failed: reactive({ 1: false, 2: false }),
    timestamps: new Map<AppSort, number>(),
    pending: new Map<AppSort, Promise<void>>(),
    requests: new Map<AppSort, number>(),
    revision: revision.value,
    sessionRevision: sessionRevision.value,
  };
}
const caches = new WeakMap<App, ReturnType<typeof createCache>>();

export function invalidateAppCategories() {
  revision.value += 1;
}

/** 登录或退出时清空分类，旧会话的迟到响应不能进入新会话缓存。 */
export function resetAppCategoryCache() {
  sessionRevision.value += 1;
}

/** 同一应用的页面共享分类与进行中的请求，按软件/游戏分别缓存五分钟。 */
export function useAppCategories() {
  const app = getCurrentInstance()?.appContext.app;
  if (!app) throw new Error('分类缓存必须在组件 setup 中使用');
  let cache = caches.get(app);
  if (!cache) {
    cache = createCache();
    caches.set(app, cache);
  }
  const state = cache;
  const { categories, loading, failed, timestamps, pending, requests } = state;
  const requested = new Set<AppSort>();
  function synchronize() {
    if (state.sessionRevision !== sessionRevision.value) {
      for (const sort of [1, 2] as const) {
        categories[sort] = undefined;
        failed[sort] = false;
        loading[sort] = false;
      }
      state.sessionRevision = sessionRevision.value;
    } else if (state.revision === revision.value) return;
    state.revision = revision.value;
    timestamps.clear();
    pending.clear();
    for (const sort of [1, 2] as const)
      requests.set(sort, (requests.get(sort) ?? 0) + 1);
  }
  function load(sort: AppSort, force = false): Promise<void> {
    synchronize();
    requested.add(sort);
    const timestamp = timestamps.get(sort);
    if (
      !force &&
      !failed[sort] &&
      categories[sort] &&
      timestamp !== undefined &&
      Date.now() - timestamp < cacheLifetime
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
        if (requests.get(sort) !== id) return;
        categories[sort] = data.filter((item) => item.id > 0);
        timestamps.set(sort, Date.now());
      } catch {
        if (requests.get(sort) === id) failed[sort] = true;
      } finally {
        if (requests.get(sort) === id) {
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
    synchronize();
    for (const sort of requested) void load(sort);
  });
  watch(sessionRevision, synchronize, { flush: 'sync' });
  onActivated(() => {
    for (const sort of requested) void load(sort);
  });
  synchronize();
  return { categories, failed, load, loading, refresh };
}
