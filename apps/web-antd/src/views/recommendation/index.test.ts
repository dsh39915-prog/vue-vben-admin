import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import IpuaPage from '../recommendation-ipua/index.vue';
import RecommendationPage from './index.vue';

const api = vi.hoisted(() => ({
  getAppCategoryListApi: vi.fn(),
  getRecommendationListApi: vi.fn(),
  updateRecommendationOrderApi: vi.fn(),
  updateRecommendationSlotApi: vi.fn(),
}));
vi.mock('#/api', () => api);
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));
vi.mock('#/composables/use-menu-title', () => ({
  useMenuTitle: () => '接口推荐菜单',
}));
const record = {
  id: 275_743,
  appName: '推荐测试应用',
  type: 111,
  typeName: '图书',
  sort: 1,
  platform: 103,
  remdId: 5,
  downloadBase: 0,
  downloadCount: 0,
  status: 1,
};
const defaultContext = {
  column: 1,
  sort: 1,
  type: 0,
  platform: '101',
  iosVersion: -1,
};
let app: App;
function button(label: string, root: ParentNode = document) {
  const found = [...root.querySelectorAll('button')].find(
    (item) => item.textContent?.replaceAll(/\s/g, '') === label,
  );
  if (!found) throw new Error(`找不到按钮：${label}`);
  return found;
}
async function mountPage(ipua = false) {
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp(ipua ? IpuaPage : RecommendationPage);
  app.mount(container);
  await vi.waitFor(() =>
    expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
      record.appName,
    ),
  );
}
async function select(level: string, value: number | string) {
  const query = `[data-filter-level="${level}"] input[value="${value}"]`;
  await vi.waitFor(() =>
    expect(document.querySelector<HTMLInputElement>(query)?.disabled).toBe(
      false,
    ),
  );
  document.querySelector<HTMLInputElement>(query)?.click();
  await nextTick();
}
async function openEditor(label: string) {
  button(label).click();
  await vi.waitFor(() =>
    expect(document.querySelector('.ant-modal-body')).not.toBeNull(),
  );
}
async function input(name: string, value: string) {
  const field = document.querySelector<HTMLInputElement>(
    `#recommendation-editor_${name}`,
  );
  if (!field) throw new Error(`找不到编辑字段：${name}`);
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}
beforeEach(() => {
  vi.resetAllMocks();
  api.getRecommendationListApi.mockImplementation(
    async ({ page, pageSize }) => ({
      current: page,
      size: pageSize,
      total: 51,
      pages: 2,
      records: [record],
    }),
  );
  api.getAppCategoryListApi.mockImplementation(async (sort) => [
    { id: -1, name: '全部', sort: null },
    { id: sort === 1 ? 111 : 203, name: sort === 1 ? '图书' : '动作', sort },
  ]);
  api.updateRecommendationOrderApi.mockResolvedValue(null);
  api.updateRecommendationSlotApi.mockResolvedValue(null);
});
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe('推荐管理', { timeout: 20_000 }, () => {
  it.each([false, true])(
    '两个菜单分别固定普通/217IPUA版本，默认每页50条（IPUA=%s）',
    async (ipua) => {
      await mountPage(ipua);
      expect(api.getRecommendationListApi).toHaveBeenCalledWith({
        ...defaultContext,
        iosVersion: ipua ? 1 : -1,
        page: 1,
        pageSize: 50,
      });
      expect(
        [...document.querySelectorAll('td')].some(
          (cell) => cell.textContent === '0(0)',
        ),
      ).toBe(true);
    },
  );
  it('四级筛选点击立即请求，切换筛选回到第一页，分页沿用当前筛选', async () => {
    await mountPage();
    expect(api.getAppCategoryListApi).not.toHaveBeenCalled();
    await select('platform', '102');
    expect(api.getRecommendationListApi).toHaveBeenLastCalledWith({
      ...defaultContext,
      platform: '102',
      page: 1,
      pageSize: 50,
    });
    await select('audience', 'games');
    expect(api.getRecommendationListApi).toHaveBeenLastCalledWith({
      ...defaultContext,
      platform: '102',
      column: 2,
      sort: 2,
      page: 1,
      pageSize: 50,
    });
    await select('section', 'category');
    await vi.waitFor(() =>
      expect(api.getAppCategoryListApi).toHaveBeenCalledWith(2),
    );
    await select('category', 203);
    const context = {
      column: 72,
      sort: 2,
      type: 203,
      platform: '102',
      iosVersion: -1,
    };
    await vi.waitFor(() =>
      expect(api.getRecommendationListApi).toHaveBeenLastCalledWith({
        ...context,
        page: 1,
        pageSize: 50,
      }),
    );
    await vi.waitFor(() => expect(button('添加空位').disabled).toBe(false));
    document.querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getRecommendationListApi).toHaveBeenLastCalledWith({
        ...context,
        page: 2,
        pageSize: 50,
      }),
    );
    await select('section', 'ranking');
    await vi.waitFor(() =>
      expect(api.getRecommendationListApi).toHaveBeenLastCalledWith({
        ...context,
        column: 42,
        type: 0,
        page: 1,
        pageSize: 50,
      }),
    );
    await select('audience', 'apps');
    await vi.waitFor(() =>
      expect(api.getRecommendationListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ column: 2, sort: 1, type: 0, page: 1 }),
      ),
    );
    await select('platform', '101');
    await vi.waitFor(() =>
      expect(api.getRecommendationListApi).toHaveBeenLastCalledWith({
        ...defaultContext,
        page: 1,
        pageSize: 50,
      }),
    );
  });
  it.each([false, true])(
    '进入分类自动选择接口第一个有效分类并直接查询，不发送type=0（IPUA=%s）',
    async (ipua) => {
      api.getAppCategoryListApi.mockResolvedValueOnce([
        { id: -1, name: '全部', sort: null },
        { id: 115, name: '第一分类', sort: 1 },
        { id: 111, name: '第二分类', sort: 1 },
      ]);
      await mountPage(ipua);
      await select('audience', 'apps');
      await select('section', 'category');
      await vi.waitFor(() =>
        expect(api.getRecommendationListApi).toHaveBeenLastCalledWith({
          ...defaultContext,
          column: 72,
          type: 115,
          iosVersion: ipua ? 1 : -1,
          page: 1,
          pageSize: 50,
        }),
      );
      expect(
        document.querySelector<HTMLInputElement>(
          '[data-filter-level="category"] input[value="115"]',
        )?.checked,
      ).toBe(true);
      expect(
        document.querySelector(
          '[data-filter-level="category"] input[value="0"]',
        ),
      ).toBeNull();
      expect(
        api.getRecommendationListApi.mock.calls.some(
          ([query]) => query.column === 72 && query.type === 0,
        ),
      ).toBe(false);
      await select('section', 'latest');
      await select('section', 'category');
      await vi.waitFor(() =>
        expect(api.getRecommendationListApi).toHaveBeenLastCalledWith(
          expect.objectContaining({ column: 72, type: 115 }),
        ),
      );
      expect(api.getAppCategoryListApi).toHaveBeenCalledOnce();
    },
  );
  it('分类加载期间切换应用类型，迟到结果不会恢复旧分类或查询type=0', async () => {
    let resolveCategories: ((value: unknown) => void) | undefined;
    api.getAppCategoryListApi.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCategories = resolve;
        }),
    );
    await mountPage();
    await select('audience', 'apps');
    await select('section', 'category');
    await vi.waitFor(() =>
      expect(api.getAppCategoryListApi).toHaveBeenCalledWith(1),
    );
    expect(api.getRecommendationListApi).toHaveBeenCalledTimes(2);
    expect(button('刷新').disabled).toBe(true);
    expect(button('添加空位').disabled).toBe(true);
    await select('audience', 'games');
    await vi.waitFor(() =>
      expect(api.getRecommendationListApi).toHaveBeenLastCalledWith({
        ...defaultContext,
        column: 2,
        sort: 2,
        page: 1,
        pageSize: 50,
      }),
    );
    resolveCategories?.([{ id: 111, name: '旧分类', sort: 1 }]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(api.getRecommendationListApi).toHaveBeenCalledTimes(3);
    expect(document.querySelector('[data-filter-level="category"]')).toBeNull();
  });
  it('没有有效分类时展示空状态并禁用请求和写入，不退回全部分类', async () => {
    api.getAppCategoryListApi.mockResolvedValueOnce([
      { id: -1, name: '全部', sort: null },
    ]);
    await mountPage();
    await select('audience', 'apps');
    await select('section', 'category');
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('暂无可用分类'),
    );
    await vi.waitFor(() =>
      expect(
        document.querySelector('.ant-table-tbody')?.textContent,
      ).not.toContain(record.appName),
    );
    expect(
      api.getRecommendationListApi.mock.calls.some(
        ([query]) => query.column === 72,
      ),
    ).toBe(false);
    expect(button('刷新').disabled).toBe(true);
    expect(button('添加空位').disabled).toBe(true);
    await select('section', 'ranking');
    await vi.waitFor(() =>
      expect(api.getRecommendationListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ column: 42, type: 0 }),
      ),
    );
  });
  it.each([
    ['添加空位', 1],
    ['删除空位', -1],
  ] as const)('%s提交当前联动筛选和正整数位置', async (label, operType) => {
    await mountPage(true);
    await select('audience', 'games');
    await select('section', 'category');
    await select('category', 203);
    await vi.waitFor(() =>
      expect(api.getRecommendationListApi).toHaveBeenLastCalledWith(
        expect.objectContaining({ column: 72, sort: 2, type: 203 }),
      ),
    );
    await vi.waitFor(() => expect(button(label).disabled).toBe(false));
    await openEditor(label);
    button(operType === 1 ? '保存' : '删除').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('请输入有效的正整数推荐位置'),
    );
    expect(api.updateRecommendationSlotApi).not.toHaveBeenCalled();
    await input('position', '12');
    button(operType === 1 ? '保存' : '删除').click();
    await vi.waitFor(() =>
      expect(api.updateRecommendationSlotApi).toHaveBeenCalledWith({
        ...defaultContext,
        column: 72,
        sort: 2,
        type: 203,
        iosVersion: 1,
        operType,
        remdNum: 12,
      }),
    );
  });
  it('调整位置使用当前筛选column，保留说明，失败后可重试', async () => {
    api.updateRecommendationOrderApi.mockRejectedValueOnce(
      new Error('保存失败'),
    );
    await mountPage();
    await select('audience', 'apps');
    await select('section', 'ranking');
    await vi.waitFor(() => expect(button('调整位置').disabled).toBe(false));
    await openEditor('调整位置');
    await input('position', '8');
    await input('info', ' 调整位置说明 ');
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.updateRecommendationOrderApi).toHaveBeenCalledWith({
        id: record.id,
        type: 42,
        platform: '101',
        iosVersion: -1,
        order: 8,
        info: '调整位置说明',
      }),
    );
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    expect(document.querySelector('.ant-modal-body')).not.toBeNull();
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.updateRecommendationOrderApi).toHaveBeenCalledTimes(2),
    );
    await vi.waitFor(() =>
      expect(api.getRecommendationListApi).toHaveBeenCalledTimes(4),
    );
    await vi.waitFor(() =>
      expect(api.getRecommendationListApi).toHaveBeenLastCalledWith({
        ...defaultContext,
        column: 42,
        page: 1,
        pageSize: 50,
      }),
    );
  });
  it('取消推荐必须确认并以当前筛选column及order=0提交，末页删除后回退', async () => {
    await mountPage(true);
    await select('audience', 'apps');
    await select('section', 'ranking');
    await vi.waitFor(() => expect(button('取消推荐').disabled).toBe(false));
    document.querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getRecommendationListApi).toHaveBeenLastCalledWith({
        ...defaultContext,
        column: 42,
        iosVersion: 1,
        page: 2,
        pageSize: 50,
      }),
    );
    await vi.waitFor(() => expect(button('取消推荐').disabled).toBe(false));
    button('取消推荐').click();
    const query = '.ant-popover:not(.ant-popover-hidden)';
    await vi.waitFor(() =>
      expect(document.querySelector(query)).not.toBeNull(),
    );
    expect(api.updateRecommendationOrderApi).not.toHaveBeenCalled();
    api.getRecommendationListApi.mockResolvedValueOnce({
      records: [],
      current: 2,
      size: 50,
      total: 50,
      pages: 1,
    });
    const prompt = document.querySelector(query);
    if (!prompt) throw new Error('确认框未打开');
    button('取消推荐', prompt).click();
    await vi.waitFor(() =>
      expect(api.updateRecommendationOrderApi).toHaveBeenCalledWith({
        id: record.id,
        type: 42,
        platform: '101',
        iosVersion: 1,
        order: 0,
        info: '',
      }),
    );
    await vi.waitFor(() =>
      expect(api.getRecommendationListApi).toHaveBeenLastCalledWith({
        ...defaultContext,
        column: 42,
        iosVersion: 1,
        page: 1,
        pageSize: 50,
      }),
    );
  });
  it('分类和列表加载失败均可重试，列表失败时禁用写入', async () => {
    api.getAppCategoryListApi.mockRejectedValueOnce(new Error('分类失败'));
    await mountPage();
    await select('audience', 'apps');
    await select('section', 'category');
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('应用分类加载失败'),
    );
    button('重试分类').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).not.toContain('应用分类加载失败'),
    );
    await vi.waitFor(() =>
      expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
        record.appName,
      ),
    );
    await vi.waitFor(() => expect(button('添加空位').disabled).toBe(false));
    api.getRecommendationListApi.mockRejectedValueOnce(new Error('列表失败'));
    button('刷新').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('推荐列表加载失败'),
    );
    expect(button('添加空位').disabled).toBe(true);
    expect(button('调整位置').disabled).toBe(true);
    button('刷新').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).not.toContain('推荐列表加载失败'),
    );
  });
  it('空位记录显示推荐位置，不提供应用排序和取消推荐操作', async () => {
    api.getRecommendationListApi.mockResolvedValueOnce({
      current: 1,
      size: 50,
      total: 2,
      pages: 1,
      records: [record, { id: null, type: null, appName: null, remdId: 12 }],
    });
    await mountPage();
    const rows = [...document.querySelectorAll('.ant-table-row')];
    const slot = rows.find((row) => row.textContent?.includes('推荐空位'));
    expect(slot?.textContent).toContain('12');
    expect(slot?.querySelector('button')).toBeNull();
  });
  it('连续点击筛选时即时发起请求，较早返回结果不覆盖最后选择', async () => {
    await mountPage();
    let resolveOld: ((value: unknown) => void) | undefined;
    api.getRecommendationListApi.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    await select('audience', 'apps');
    await vi.waitFor(() =>
      expect(api.getRecommendationListApi).toHaveBeenCalledTimes(2),
    );
    await select('audience', 'games');
    await vi.waitFor(() =>
      expect(api.getRecommendationListApi).toHaveBeenCalledTimes(3),
    );
    expect(api.getRecommendationListApi).toHaveBeenLastCalledWith({
      ...defaultContext,
      column: 2,
      sort: 2,
      page: 1,
      pageSize: 50,
    });
    resolveOld?.({
      current: 1,
      size: 50,
      total: 1,
      pages: 1,
      records: [{ ...record, appName: '旧请求内容' }],
    });
    await nextTick();
    await nextTick();
    expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
      record.appName,
    );
    expect(
      document.querySelector('.ant-table-tbody')?.textContent,
    ).not.toContain('旧请求内容');
  });
});
