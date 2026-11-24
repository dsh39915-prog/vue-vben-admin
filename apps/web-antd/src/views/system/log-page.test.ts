import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LogPage from './log-page.vue';

const api = vi.hoisted(() => ({ getSystemLogsApi: vi.fn() }));
vi.mock('#/api', () => api);
vi.mock('#/composables/use-menu-title', () => ({
  useMenuTitle: () => '接口日志标题',
}));
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));
let app: App;
function button(label: string) {
  const result = [...document.querySelectorAll('button')].find(
    (element) => element.textContent?.replaceAll(/\s/g, '') === label,
  );
  if (!result) throw new Error(`找不到按钮：${label}`);
  return result;
}
async function mountPage() {
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp(LogPage, { kind: 'operation-logs' });
  app.mount(container);
  await vi.waitFor(() => expect(api.getSystemLogsApi).toHaveBeenCalled());
  await nextTick();
}
beforeEach(() => {
  vi.resetAllMocks();
  api.getSystemLogsApi.mockImplementation(async (_kind, params) => ({
    page: params.page,
    pageSize: params.pageSize,
    total: 21,
    records: [
      {
        id: 1,
        username: 'reader',
        succeeded: null,
        durationMs: 0,
        httpStatus: 200,
        createdAt: '2026-11-24T10:00:00',
      },
    ],
  }));
});
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe('日志页面', () => {
  it('默认读取 20 条，显示未知结果及零耗时，分页保留筛选快照', async () => {
    await mountPage();
    expect(api.getSystemLogsApi).toHaveBeenCalledWith('operation-logs', {
      page: 1,
      pageSize: 20,
    });
    await vi.waitFor(() =>
      expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
        '未知',
      ),
    );
    expect(
      [...document.querySelectorAll('td')].some(
        (cell) => cell.textContent === '0',
      ),
    ).toBe(true);
    const input = document.querySelector<HTMLInputElement>(
      '#system-log-filter_username',
    );
    if (!input) throw new Error('找不到登录名筛选框');
    input.value = ' reader ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    button('查询').click();
    await vi.waitFor(() =>
      expect(api.getSystemLogsApi).toHaveBeenLastCalledWith(
        'operation-logs',
        expect.objectContaining({ username: 'reader', page: 1 }),
      ),
    );
    input.value = 'unsent';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getSystemLogsApi).toHaveBeenLastCalledWith(
        'operation-logs',
        expect.objectContaining({ username: 'reader', page: 2 }),
      ),
    );
    button('重置').click();
    await vi.waitFor(() =>
      expect(api.getSystemLogsApi).toHaveBeenLastCalledWith(
        'operation-logs',
        expect.objectContaining({
          username: undefined,
          succeeded: undefined,
          page: 1,
        }),
      ),
    );
  });
  it('加载失败后允许重试', async () => {
    api.getSystemLogsApi.mockRejectedValueOnce(new Error('offline'));
    await mountPage();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('日志加载失败'),
    );
    button('刷新').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).not.toContain('日志加载失败'),
    );
    await vi.waitFor(() =>
      expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
        'reader',
      ),
    );
  });
});
