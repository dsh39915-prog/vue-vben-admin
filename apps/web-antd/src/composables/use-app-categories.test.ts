import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  invalidateAppCategories,
  resetAppCategoryCache,
  useAppCategories,
} from './use-app-categories';

const api = vi.hoisted(() => ({ getAppCategoryListApi: vi.fn() }));
vi.mock('#/api', () => api);
const disposers: (() => void)[] = [];
function setupPages(count = 1) {
  const states: ReturnType<typeof useAppCategories>[] = [];
  const app = createApp({
    setup() {
      for (let index = 0; index < count; index++)
        states.push(useAppCategories());
      return () => null;
    },
  });
  app.mount(document.createElement('div'));
  disposers.push(() => app.unmount());
  return states;
}
function setup() {
  const [state] = setupPages();
  if (!state) throw new Error('分类未初始化');
  return state;
}
beforeEach(() => {
  vi.resetAllMocks();
  api.getAppCategoryListApi.mockResolvedValue([
    { id: 119, name: '教育', sort: 1 },
  ]);
});
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  vi.restoreAllMocks();
});

describe('分类选项缓存', () => {
  it('合并并发请求，有效期内复用，过期后重新获取', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const state = setup();
    await Promise.all([state.load(1), state.load(1)]);
    await state.load(1);
    expect(api.getAppCategoryListApi).toHaveBeenCalledTimes(1);
    now.mockReturnValue(302_000);
    await state.load(1);
    expect(api.getAppCategoryListApi).toHaveBeenCalledTimes(2);
  });
  it('分类修改通知会刷新所有已打开页面，手动刷新也强制获取最新选项', async () => {
    const [first, second] = setupPages(2);
    if (!first || !second) throw new Error('页面未初始化');
    await Promise.all([first.load(1), second.load(1)]);
    expect(api.getAppCategoryListApi).toHaveBeenCalledTimes(1);
    api.getAppCategoryListApi.mockResolvedValue([
      { id: 119, name: '新分类', sort: 1 },
    ]);
    invalidateAppCategories();
    await nextTick();
    await vi.waitFor(() =>
      expect(first.categories[1]?.[0]?.name).toBe('新分类'),
    );
    expect(second.categories[1]?.[0]?.name).toBe('新分类');
    expect(api.getAppCategoryListApi).toHaveBeenCalledTimes(2);
    await first.refresh();
    expect(api.getAppCategoryListApi).toHaveBeenCalledTimes(3);
  });
  it('主动失效后忽略旧请求，刷新失败时保留数据并允许重试', async () => {
    let finish: ((data: unknown) => void) | undefined;
    api.getAppCategoryListApi.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const state = setup();
    const old = state.load(1);
    await state.refresh();
    finish?.([{ id: 88, name: '旧分类', sort: 1 }]);
    await old;
    expect(state.categories[1]?.[0]?.id).toBe(119);
    api.getAppCategoryListApi.mockRejectedValueOnce(new Error('offline'));
    await state.refresh();
    expect(state.failed[1]).toBe(true);
    await state.load(1, true);
    expect(state.failed[1]).toBe(false);
  });
  it('会话重置后清空共享数据，并忽略旧会话迟到的响应', async () => {
    let finish: ((data: unknown) => void) | undefined;
    api.getAppCategoryListApi.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const [first, second] = setupPages(2);
    if (!first || !second) throw new Error('页面未初始化');
    const old = first.load(1);
    resetAppCategoryCache();
    expect(first.categories[1]).toBeUndefined();
    await second.load(1);
    finish?.([{ id: 88, name: '旧账号分类', sort: 1 }]);
    await old;
    expect(first.categories[1]).toEqual([{ id: 119, name: '教育', sort: 1 }]);
    expect(second.categories[1]).toBe(first.categories[1]);
    expect(first.loading[1]).toBe(false);
  });
});
