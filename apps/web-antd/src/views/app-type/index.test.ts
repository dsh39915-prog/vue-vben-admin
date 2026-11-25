import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AppTypePage from './index.vue';

const api = vi.hoisted(() => ({
  getAppTypeListApi: vi.fn(),
  updateAppTypeOrderApi: vi.fn(),
}));
vi.mock('#/api', () => api);
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));
vi.mock('#/composables/use-menu-title', () => ({
  useMenuTitle: () => '接口应用分类标题',
}));
const record = {
  id: 137,
  name: '角色扮演',
  newName: '新角色扮演',
  sort: 2,
  status: 0,
  orderNum: 1,
  contentCount: 0,
  contentCountIpad: null,
  description: '分类说明',
  icon: null,
  iconIpad: null,
  newIcon: '137.png',
};
const defaults = {
  sort1: '-1',
  appName: '',
  status: '-1',
  page: 1,
  pageSize: 20,
  sort: 'Sort',
  order: 'asc',
};
let app: App;
function button(label: string) {
  const result = [...document.querySelectorAll('button')].find(
    (item) => item.textContent?.replaceAll(/\s/g, '') === label,
  );
  if (!result) throw new Error(`找不到按钮：${label}`);
  return result;
}
async function mountPage() {
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp(AppTypePage);
  app.mount(container);
  await vi.waitFor(() =>
    expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
      record.name,
    ),
  );
  await vi.waitFor(() => expect(button('修改排序').disabled).toBe(false));
}
async function select(name: string, label: string) {
  const selector = document
    .querySelector(`#app-type-filters_${name}`)
    ?.closest('.ant-select')
    ?.querySelector('.ant-select-selector');
  if (!selector) throw new Error(`找不到筛选项：${name}`);
  selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await nextTick();
  const query = `.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="${label}"]`;
  await vi.waitFor(() => expect(document.querySelector(query)).not.toBeNull());
  document.querySelector<HTMLElement>(query)?.click();
  await nextTick();
}
async function input(id: string, value: string) {
  const field = document.querySelector<HTMLInputElement>(`#${id}`);
  if (!field) throw new Error(`找不到字段：${id}`);
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}
async function openEditor() {
  button('修改排序').click();
  await vi.waitFor(() =>
    expect(document.querySelector('#app-type-editor_newOrder')).not.toBeNull(),
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  api.getAppTypeListApi.mockImplementation(async ({ page, pageSize }) => ({
    current: page,
    size: pageSize,
    total: 41,
    pages: Math.ceil(41 / pageSize),
    records: [record],
  }));
  api.updateAppTypeOrderApi.mockResolvedValue(null);
});
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe('应用分类管理', { timeout: 20_000 }, () => {
  it('默认20条，展示分类字段、无效状态、零数量，并只提供修改排序操作', async () => {
    await mountPage();
    expect(api.getAppTypeListApi).toHaveBeenCalledWith(defaults);
    const body = document.querySelector('.ant-table-tbody');
    expect(body?.textContent).toContain('无效');
    expect(body?.textContent).toContain('137.png');
    expect(
      [...document.querySelectorAll('td')].some(
        (cell) => cell.textContent === '0',
      ),
    ).toBe(true);
    const labels = [...document.querySelectorAll('button')].map((item) =>
      item.textContent?.trim(),
    );
    expect(labels).not.toContain('新增');
    expect(labels).not.toContain('删除');
  });
  it('提交筛选保留字符串0，分页使用已提交条件，重置恢复默认并回到第一页', async () => {
    await mountPage();
    await select('sort1', '游戏');
    await select('status', '无效');
    await input('app-type-filters_appName', ' 角色 ');
    button('查询').click();
    const query = { ...defaults, sort1: '2', status: '0', appName: '角色' };
    await vi.waitFor(() =>
      expect(api.getAppTypeListApi).toHaveBeenLastCalledWith(query),
    );
    await vi.waitFor(() => expect(button('修改排序').disabled).toBe(false));
    await input('app-type-filters_appName', '未提交');
    document.querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getAppTypeListApi).toHaveBeenLastCalledWith({
        ...query,
        page: 2,
      }),
    );
    button('重置').click();
    await vi.waitFor(() =>
      expect(api.getAppTypeListApi).toHaveBeenLastCalledWith(defaults),
    );
  });
  it('按应用类型切换服务端降序，固定传Sort并回到第一页', async () => {
    await mountPage();
    document.querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getAppTypeListApi).toHaveBeenLastCalledWith({
        ...defaults,
        page: 2,
      }),
    );
    const header = [...document.querySelectorAll('th')].find((item) =>
      item.textContent?.includes('应用类型'),
    );
    header?.click();
    await vi.waitFor(() =>
      expect(api.getAppTypeListApi).toHaveBeenLastCalledWith({
        ...defaults,
        order: 'desc',
      }),
    );
  });
  it('排序为空时阻止请求，保存0时使用记录sort和oldOrder且避免重复提交', async () => {
    await mountPage();
    await openEditor();
    await input('app-type-editor_newOrder', '');
    button('保存').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('请输入有效的非负整数排序号'),
    );
    expect(api.updateAppTypeOrderApi).not.toHaveBeenCalled();
    await input('app-type-editor_newOrder', '0');
    button('保存').click();
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.updateAppTypeOrderApi).toHaveBeenCalledWith({
        id: 137,
        sort: 2,
        oldOrder: 1,
        newOrder: 0,
      }),
    );
    expect(api.updateAppTypeOrderApi).toHaveBeenCalledTimes(1);
    await vi.waitFor(() =>
      expect(api.getAppTypeListApi).toHaveBeenCalledTimes(2),
    );
  });
  it('修改失败保留输入和原排序号，重试成功后刷新列表', async () => {
    api.updateAppTypeOrderApi.mockRejectedValueOnce(new Error('保存失败'));
    await mountPage();
    await openEditor();
    await input('app-type-editor_newOrder', '8');
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.updateAppTypeOrderApi).toHaveBeenCalledTimes(1),
    );
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    expect(
      document.querySelector<HTMLInputElement>('#app-type-editor_newOrder')
        ?.value,
    ).toBe('8');
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.updateAppTypeOrderApi).toHaveBeenLastCalledWith({
        id: 137,
        sort: 2,
        oldOrder: 1,
        newOrder: 8,
      }),
    );
    await vi.waitFor(() =>
      expect(api.getAppTypeListApi).toHaveBeenCalledTimes(2),
    );
  });
  it('列表失败时禁用排序并可刷新重试，缺少原序号时也不允许写入', async () => {
    await mountPage();
    api.getAppTypeListApi.mockRejectedValueOnce(new Error('列表失败'));
    button('刷新').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('应用分类加载失败'),
    );
    expect(button('修改排序').disabled).toBe(true);
    api.getAppTypeListApi.mockResolvedValueOnce({
      current: 1,
      size: 20,
      total: 1,
      pages: 1,
      records: [{ ...record, orderNum: null }],
    });
    button('刷新').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).not.toContain('应用分类加载失败'),
    );
    expect(button('修改排序').disabled).toBe(true);
    expect(api.updateAppTypeOrderApi).not.toHaveBeenCalled();
  });
});
