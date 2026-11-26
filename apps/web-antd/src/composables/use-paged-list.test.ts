import type { PageResult } from './use-paged-list';

import { createApp } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { usePagedList } from './use-paged-list';

const disposers: (() => void)[] = [];
function setup(
  fetcher: (
    page: number,
    size: number,
    signal: AbortSignal,
  ) => Promise<PageResult<number>>,
) {
  let state: ReturnType<typeof usePagedList<number>> | undefined;
  const app = createApp({
    setup() {
      state = usePagedList(fetcher);
      return () => null;
    },
  });
  app.mount(document.createElement('div'));
  disposers.push(() => app.unmount());
  if (!state) throw new Error('分页未初始化');
  return state;
}
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
});

describe('公共分页请求', () => {
  it('末页数据减少后回退到有效页，兼容两种分页响应并保留外部筛选', async () => {
    const filter = { type: 119, sort: 'downloadCount' };
    const fetcher = vi.fn(async (page: number, size: number) => {
      expect(filter).toEqual({ type: 119, sort: 'downloadCount' });
      return {
        records: page === 2 ? [7] : [],
        page,
        pageSize: size,
        total: 21,
      };
    });
    const state = setup(fetcher);
    await state.load(3);
    expect(fetcher.mock.calls.map(([page]) => page)).toEqual([3, 2]);
    expect(state.pagination).toEqual({ current: 2, pageSize: 20, total: 21 });
    expect(state.records.value).toEqual([7]);
    expect(state.failed.value).toBe(false);
  });
  it('后请求先返回时忽略旧结果，并使旧请求信号失效', async () => {
    let finish: ((value: PageResult<number>) => void) | undefined;
    const fetcher = vi.fn(
      (
        _page: number,
        _size: number,
        _signal: AbortSignal,
      ): Promise<PageResult<number>> =>
        Promise.resolve({ records: [2], current: 2, size: 20, total: 40 }),
    );
    fetcher.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const state = setup(fetcher);
    const pending = state.load(1);
    await state.load(2);
    expect(fetcher.mock.calls[0]?.[2].aborted).toBe(true);
    finish?.({ records: [1], current: 1, size: 20, total: 40 });
    await pending;
    expect(state.records.value).toEqual([2]);
    expect(state.pagination.current).toBe(2);
  });
  it('空列表回到第一页，失败后可重试，卸载会取消当前请求', async () => {
    const fetcher = vi.fn(
      async (_page: number, size: number, _signal: AbortSignal) => ({
        records: [],
        current: 1,
        size,
        total: 0,
      }),
    );
    fetcher.mockRejectedValueOnce(new Error('offline'));
    const state = setup(fetcher);
    await state.load();
    expect(state.failed.value).toBe(true);
    await state.load(2);
    expect(state.pagination.current).toBe(1);
    expect(state.failed.value).toBe(false);
    const lastCall = fetcher.mock.lastCall;
    disposers.pop()?.();
    expect(lastCall?.[2].aborted).toBe(true);
  });
});
