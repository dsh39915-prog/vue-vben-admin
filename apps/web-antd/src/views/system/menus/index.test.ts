import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { useUserStore } from '@vben/stores';

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MenuPage from './index.vue';

const api = vi.hoisted(() => ({
  getSystemResourceListApi: vi.fn(),
  getSystemResourceDetailsApi: vi.fn(),
  createSystemResourceApi: vi.fn(),
  updateSystemResourceApi: vi.fn(),
  deleteSystemResourceApi: vi.fn(),
}));
vi.mock('#/api', () => api);
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));
vi.mock('@vben/icons', () => ({
  IconifyIcon: { props: ['icon'], template: '<span :data-icon="icon" />' },
}));
vi.mock('vue-router', async (original) => ({
  ...(await original<typeof import('vue-router')>()),
  useRoute: () => ({
    meta: { title: '接口菜单管理', permissionCode: 'tenant:navigation:read' },
  }),
}));
const action = {
  id: 12,
  parentId: 11,
  moduleId: 1,
  name: '创建应用',
  menuType: 3,
  hidden: false,
  enabled: true,
  sortOrder: 1,
  permissionCode: 'tenant:app:create',
};
const child = {
  id: 11,
  parentId: 10,
  moduleId: 1,
  name: '应用列表',
  menuType: 2,
  path: '/app-info',
  hidden: false,
  enabled: true,
  sortOrder: 1,
  children: [action],
};
const tree = [
  {
    id: 10,
    parentId: null,
    moduleId: 1,
    name: '应用目录',
    menuType: 1,
    icon: 'lucide:box',
    hidden: false,
    enabled: true,
    sortOrder: 1,
    children: [
      child,
      {
        id: 13,
        parentId: 10,
        moduleId: 1,
        name: '隐藏菜单',
        menuType: 2,
        hidden: true,
        enabled: false,
        sortOrder: 2,
      },
    ],
  },
  {
    id: 20,
    parentId: null,
    moduleId: 2,
    name: '工具目录',
    menuType: 1,
    hidden: false,
    enabled: true,
    sortOrder: 2,
    children: [
      {
        id: 21,
        parentId: 20,
        moduleId: 2,
        name: '配置列表',
        menuType: 2,
        path: '/config-info',
        hidden: false,
        enabled: true,
        sortOrder: 1,
      },
    ],
  },
];
let app: App;
function button(label: string, root: ParentNode = document) {
  const result = [...root.querySelectorAll('button')].find(
    (item) => item.textContent?.replaceAll(/\s/g, '') === label,
  );
  if (!result) throw new Error(`找不到按钮：${label}`);
  return result;
}
function row(name: string) {
  const result = [...document.querySelectorAll('.ant-table-row')].find(
    (item) => item.querySelector('td')?.textContent?.trim() === name,
  );
  if (!result) throw new Error(`找不到菜单行：${name}`);
  return result;
}
async function mountPage() {
  const pinia = createPinia();
  setActivePinia(pinia);
  useUserStore().setUserInfo({
    userId: '1',
    username: 'tester',
    realName: '测试',
    avatar: '',
    superAdmin: true,
  });
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp(MenuPage);
  app.use(pinia);
  app.mount(container);
  await vi.waitFor(() =>
    expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
      '应用列表',
    ),
  );
  await vi.waitFor(() =>
    expect(document.body.textContent).toContain('应用模块'),
  );
}
async function selectModule(id: number) {
  document
    .querySelector<HTMLInputElement>(`.ant-radio-button-input[value="${id}"]`)
    ?.click();
  await nextTick();
}
beforeEach(() => {
  vi.resetAllMocks();
  api.getSystemResourceListApi.mockImplementation(async (resource) =>
    resource === 'menus'
      ? tree
      : [
          { id: 1, name: '应用模块', sortOrder: 1 },
          { id: 2, name: '工具模块', sortOrder: 2 },
        ],
  );
  api.getSystemResourceDetailsApi.mockResolvedValue(child);
  api.createSystemResourceApi.mockResolvedValue({ id: 30 });
});
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe('菜单树形管理', { timeout: 20_000 }, () => {
  it('默认展开一级，展示图标、类型及可见性，支持全部展开和收起且不分页', async () => {
    await mountPage();
    expect(
      document.querySelector('.ant-table-tbody')?.textContent,
    ).not.toContain('创建应用');
    expect(document.querySelector('[data-icon="lucide:box"]')).not.toBeNull();
    expect(row('应用目录').textContent).toContain('目录');
    expect(row('隐藏菜单').textContent).toContain('隐藏');
    expect(document.querySelector('.ant-pagination')).toBeNull();
    row('应用列表')
      .querySelector<HTMLButtonElement>('.ant-table-row-expand-icon')
      ?.click();
    await nextTick();
    expect(row('创建应用')).toBeDefined();
    row('应用列表')
      .querySelector<HTMLButtonElement>('.ant-table-row-expand-icon')
      ?.click();
    await nextTick();
    expect(
      document.querySelector('.ant-table-tbody')?.textContent,
    ).not.toContain('创建应用');
    button('展开全部').click();
    await nextTick();
    expect(row('创建应用').textContent).toContain('按钮/操作');
    button('收起全部').click();
    await nextTick();
    expect(
      document.querySelector('.ant-table-tbody')?.textContent,
    ).not.toContain('应用列表');
    expect(row('应用目录')).toBeDefined();
  });
  it('模块选项取自接口，切换模块和搜索子菜单保留祖先', async () => {
    await mountPage();
    await selectModule(2);
    expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
      '配置列表',
    );
    expect(
      document.querySelector('.ant-table-tbody')?.textContent,
    ).not.toContain('应用目录');
    button('重置').click();
    await nextTick();
    const input = document.querySelector<HTMLInputElement>(
      '.ant-input-search input',
    );
    if (!input) throw new Error('找不到菜单搜索框');
    input.value = '创建应用';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    button('查询').click();
    await nextTick();
    expect(row('应用目录')).toBeDefined();
    expect(row('应用列表')).toBeDefined();
    expect(row('创建应用')).toBeDefined();
    expect(
      document.querySelector('.ant-table-tbody')?.textContent,
    ).not.toContain('工具目录');
    expect(
      api.getSystemResourceListApi.mock.calls.filter(
        ([resource]) => resource === 'menus',
      ),
    ).toHaveLength(1);
  });
  it('新增子菜单继承父级和模块，编辑子菜单读取真实id', async () => {
    await mountPage();
    button('编辑', row('应用列表')).click();
    await vi.waitFor(() =>
      expect(api.getSystemResourceDetailsApi).toHaveBeenCalledWith('menus', 11),
    );
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    button('取消').click();
    await nextTick();
    button('新增子菜单', row('应用列表')).click();
    await nextTick();
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    const input = document.querySelector<HTMLInputElement>(
      '#system-editor_name',
    );
    if (!input) throw new Error('找不到菜单名称');
    input.value = '新操作';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.createSystemResourceApi).toHaveBeenCalledWith(
        'menus',
        expect.objectContaining({
          name: '新操作',
          parentId: 11,
          moduleId: 1,
          menuType: 3,
        }),
      ),
    );
  });
  it('新增根菜单预选当前接口模块，刷新保留手动收起状态', async () => {
    await mountPage();
    await selectModule(2);
    button('收起全部').click();
    button('刷新').click();
    await vi.waitFor(() =>
      expect(
        api.getSystemResourceListApi.mock.calls.filter(
          ([resource]) => resource === 'menus',
        ),
      ).toHaveLength(2),
    );
    await nextTick();
    expect(
      document.querySelector('.ant-table-tbody')?.textContent,
    ).not.toContain('配置列表');
    button('新增').click();
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    const input = document.querySelector<HTMLInputElement>(
      '#system-editor_name',
    );
    if (!input) throw new Error('找不到菜单名称');
    input.value = '工具菜单';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.createSystemResourceApi).toHaveBeenCalledWith(
        'menus',
        expect.objectContaining({
          name: '工具菜单',
          parentId: null,
          moduleId: 2,
          menuType: 1,
        }),
      ),
    );
  });
});
