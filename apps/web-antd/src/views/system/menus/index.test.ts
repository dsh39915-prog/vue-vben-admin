import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { useAccessStore, useUserStore } from '@vben/stores';

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MenuPage from './index.vue';

const api = vi.hoisted(() => ({
  getSystemResourceListApi: vi.fn(),
  getSystemMenuTreeApi: vi.fn(),
  getSystemResourceDetailsApi: vi.fn(),
  createSystemResourceApi: vi.fn(),
  updateSystemResourceApi: vi.fn(),
  deleteSystemResourceApi: vi.fn(),
}));
vi.mock('#/api', () => api);
const refreshAccess = vi.hoisted(() => vi.fn());
vi.mock('#/store', () => ({ useAuthStore: () => ({ refreshAccess }) }));
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
  id: 10,
  key: 'permission:10',
  parentKey: 'menu:11',
  nodeType: 'PERMISSION',
  parentId: null,
  menuId: 11,
  moduleId: 1,
  name: '创建应用',
  type: 3,
  hidden: false,
  enabled: true,
  sortOrder: 1,
  permissionCode: 'tenant:app:create',
};
const permissionDetail = {
  id: 10,
  parentId: null,
  menuId: 11,
  moduleId: 1,
  name: '创建应用',
  code: 'tenant:app:create',
  permissionType: 3,
  path: '',
  icon: '',
  hidden: false,
  enabled: true,
  sortOrder: 1,
  remark: '',
};
const child = {
  id: 11,
  key: 'menu:11',
  parentKey: 'menu:10',
  nodeType: 'MENU',
  parentId: 10,
  moduleId: 1,
  name: '应用列表',
  type: 2,
  path: '/app-info',
  hidden: false,
  enabled: true,
  sortOrder: 1,
  children: [action],
};
const tree = [
  {
    id: 10,
    key: 'menu:10',
    parentKey: null,
    nodeType: 'MENU',
    parentId: null,
    moduleId: 1,
    name: '应用目录',
    type: 1,
    icon: 'lucide:box',
    hidden: false,
    enabled: true,
    sortOrder: 1,
    children: [
      child,
      {
        id: 13,
        key: 'menu:13',
        parentKey: 'menu:10',
        nodeType: 'MENU',
        parentId: 10,
        moduleId: 1,
        name: '隐藏菜单',
        type: 2,
        hidden: true,
        enabled: false,
        sortOrder: 2,
      },
    ],
  },
  {
    id: 20,
    key: 'menu:20',
    parentKey: null,
    nodeType: 'MENU',
    parentId: null,
    moduleId: 2,
    name: '工具目录',
    type: 1,
    hidden: false,
    enabled: true,
    sortOrder: 2,
    children: [
      {
        id: 21,
        key: 'menu:21',
        parentKey: 'menu:20',
        nodeType: 'MENU',
        parentId: 20,
        moduleId: 2,
        name: '配置列表',
        type: 2,
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
  const result = [
    ...document.querySelectorAll<HTMLTableRowElement>('.ant-table-row'),
  ].find((item) => item.querySelector('td')?.textContent?.trim() === name);
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
      '应用目录',
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
  api.getSystemMenuTreeApi.mockResolvedValue(tree);
  api.getSystemResourceListApi.mockImplementation(async (resource) => {
    if (resource === 'menus')
      return [
        { id: 10, name: '应用目录', parentId: null },
        { ...child, menuType: child.type, children: undefined },
        { id: 20, name: '工具目录', parentId: null },
      ];
    if (resource === 'permissions') return [permissionDetail];
    return [
      { id: 1, name: '应用模块', sortOrder: 1 },
      { id: 2, name: '工具模块', sortOrder: 2 },
    ];
  });
  api.getSystemResourceDetailsApi.mockImplementation(async (resource) =>
    resource === 'permissions'
      ? permissionDetail
      : { ...child, menuType: child.type },
  );
  api.updateSystemResourceApi.mockResolvedValue({ id: 10 });
  api.deleteSystemResourceApi.mockResolvedValue(null);
  api.createSystemResourceApi.mockResolvedValue({ id: 30 });
});
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe('菜单树形管理', { timeout: 20_000 }, () => {
  it('组合树同id菜单和权限均展示，使用接口key作为行标识', async () => {
    await mountPage();
    expect(
      document.querySelector<HTMLInputElement>(
        'input.ant-radio-button-input[value="1"]',
      )?.checked,
    ).toBe(true);
    expect(
      document.querySelector('input.ant-radio-button-input[value="0"]'),
    ).toBeNull();
    expect(api.getSystemMenuTreeApi).toHaveBeenCalledTimes(1);
    expect(api.getSystemResourceListApi).not.toHaveBeenCalledWith('menus', {});
    button('展开全部').click();
    await nextTick();
    expect(row('应用目录').dataset.rowKey).toBe('menu:10');
    expect(row('创建应用').dataset.rowKey).toBe('permission:10');
    expect(row('创建应用').textContent).toContain('权限');
    expect(row('创建应用').textContent).toContain('tenant:app:create');
  });
  it('权限节点编辑通过权限详情及更新接口，使用code和permissionType保存', async () => {
    await mountPage();
    button('展开全部').click();
    await nextTick();
    button('编辑', row('创建应用')).click();
    await vi.waitFor(() =>
      expect(api.getSystemResourceDetailsApi).toHaveBeenCalledWith(
        'permissions',
        10,
      ),
    );
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    expect(document.querySelector('.ant-modal-title')?.textContent).toContain(
      '创建应用',
    );
    const code = document.querySelector<HTMLInputElement>(
      '#system-editor_code',
    );
    if (!code) throw new Error('权限标识字段未显示');
    expect(code.value).toBe('tenant:app:create');
    code.value = 'tenant:app:publish';
    code.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.updateSystemResourceApi).toHaveBeenCalledWith(
        'permissions',
        10,
        expect.objectContaining({
          code: 'tenant:app:publish',
          menuId: 11,
          permissionType: 3,
        }),
      ),
    );
    expect(api.updateSystemResourceApi).not.toHaveBeenCalledWith(
      'menus',
      10,
      expect.anything(),
    );
    await vi.waitFor(() =>
      expect(api.getSystemMenuTreeApi).toHaveBeenCalledTimes(2),
    );
  });
  it('菜单下新增权限关联菜单和模块，不把菜单id当作上级权限id', async () => {
    await mountPage();
    button('新增权限', row('应用列表')).click();
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    expect(document.querySelector('#system-editor_moduleId')).toBeNull();
    for (const [key, value] of [
      ['name', '发布应用'],
      ['code', 'tenant:app:publish'],
    ]) {
      const field = document.querySelector<HTMLInputElement>(
        `#system-editor_${key}`,
      );
      if (!field) throw new Error(`找不到字段：${key}`);
      field.value = value ?? '';
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await nextTick();
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.createSystemResourceApi).toHaveBeenCalledWith(
        'permissions',
        expect.objectContaining({
          name: '发布应用',
          code: 'tenant:app:publish',
          menuId: 11,
          parentId: null,
          moduleId: 1,
          permissionType: 3,
        }),
      ),
    );
    expect(api.createSystemResourceApi).not.toHaveBeenCalledWith(
      'menus',
      expect.anything(),
    );
  });
  it.each([
    { name: '创建应用', resource: 'permissions' },
    { name: '应用目录', resource: 'menus' },
  ])(
    '同id的$name删除发送到$resource，成功后刷新组合树',
    async ({ name, resource }) => {
      await mountPage();
      button('展开全部').click();
      await nextTick();
      button('删除', row(name)).click();
      const query = '.ant-popover:not(.ant-popover-hidden)';
      await vi.waitFor(() =>
        expect(document.querySelector(query)).not.toBeNull(),
      );
      document
        .querySelector<HTMLButtonElement>(`${query} button.ant-btn-primary`)
        ?.click();
      await vi.waitFor(() =>
        expect(api.deleteSystemResourceApi).toHaveBeenCalledExactlyOnceWith(
          resource,
          10,
        ),
      );
      await vi.waitFor(() =>
        expect(api.getSystemMenuTreeApi).toHaveBeenCalledTimes(2),
      );
    },
  );
  it('权限详情加载失败后重试仍使用权限接口', async () => {
    api.getSystemResourceDetailsApi.mockRejectedValueOnce(
      new Error('详情失败'),
    );
    await mountPage();
    button('展开全部').click();
    await nextTick();
    button('详情', row('创建应用')).click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('详情加载失败'),
    );
    button('重试详情').click();
    await vi.waitFor(() =>
      expect(api.getSystemResourceDetailsApi).toHaveBeenCalledTimes(2),
    );
    expect(api.getSystemResourceDetailsApi).toHaveBeenLastCalledWith(
      'permissions',
      10,
    );
    await vi.waitFor(() =>
      expect(document.body.textContent).not.toContain('详情加载失败'),
    );
  });
  it('菜单操作授权不会授予权限节点编辑或删除权限', async () => {
    await mountPage();
    const users = useUserStore();
    if (!users.userInfo) throw new Error('测试用户未初始化');
    users.setUserInfo({ ...users.userInfo, superAdmin: false });
    useAccessStore().setAccessCodes([
      'tenant:navigation:read',
      'tenant:navigation:update',
      'tenant:navigation:create',
      'tenant:navigation:delete',
    ]);
    button('展开全部').click();
    await nextTick();
    expect(button('编辑', row('应用目录'))).toBeDefined();
    expect(
      [...row('创建应用').querySelectorAll('button')].some((item) =>
        ['删除', '编辑', '详情'].includes(item.textContent?.trim() ?? ''),
      ),
    ).toBe(false);
  });
  it('组合树请求失败显示重试提示，不回退旧菜单列表接口', async () => {
    await mountPage();
    api.getSystemMenuTreeApi.mockRejectedValueOnce(new Error('组合树失败'));
    button('刷新').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('列表加载失败'),
    );
    button('刷新').click();
    await vi.waitFor(() =>
      expect(api.getSystemMenuTreeApi).toHaveBeenCalledTimes(3),
    );
    await vi.waitFor(() =>
      expect(document.body.textContent).not.toContain('列表加载失败'),
    );
    expect(
      api.getSystemResourceListApi.mock.calls.some(
        ([resource]) => resource === 'menus',
      ),
    ).toBe(false);
  });
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
    button('展开全部').click();
    await nextTick();
    expect(row('创建应用')).toBeDefined();
    await selectModule(2);
    expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
      '配置列表',
    );
    expect(
      document.querySelector('.ant-table-tbody')?.textContent,
    ).not.toContain('应用目录');
    button('重置').click();
    await nextTick();
    expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
      '配置列表',
    );
    expect(
      document.querySelector('input.ant-radio-button-input[value="0"]'),
    ).toBeNull();
    await selectModule(1);
    expect(row('应用目录')).toBeDefined();
    expect(row('应用列表')).toBeDefined();
    expect(
      document.querySelector('.ant-table-tbody')?.textContent,
    ).not.toContain('创建应用');
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
    expect(api.getSystemMenuTreeApi.mock.calls).toHaveLength(1);
  });
  it('新增子菜单继承父级和模块，编辑子菜单读取真实id', async () => {
    await mountPage();
    button('编辑', row('应用列表')).click();
    await vi.waitFor(() =>
      expect(api.getSystemResourceDetailsApi).toHaveBeenCalledWith('menus', 11),
    );
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    expect(document.querySelector('#system-editor_parentId')).not.toBeNull();
    button('取消').click();
    await nextTick();
    button('新增子菜单', row('应用列表')).click();
    await nextTick();
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    expect(document.querySelector('#system-editor_parentId')).toBeNull();
    expect(document.querySelector('#system-editor_moduleId')).toBeNull();
    expect(document.querySelector('.ant-modal-title')?.textContent).toBe(
      '新增子菜单',
    );
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
  it('跨模块祖先下新增子菜单时固定继承点击行模块，不使用当前筛选模块', async () => {
    api.getSystemMenuTreeApi.mockResolvedValue([
      { ...tree[0], children: [{ ...child, moduleId: 2 }] },
      tree[1],
    ]);
    await mountPage();
    await selectModule(2);
    button('新增子菜单', row('应用目录')).click();
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    expect(document.querySelector('#system-editor_moduleId')).toBeNull();
    const name = document.querySelector<HTMLInputElement>(
      '#system-editor_name',
    );
    if (!name) throw new Error('找不到菜单名称');
    name.value = '固定模块子菜单';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.createSystemResourceApi).toHaveBeenCalledWith(
        'menus',
        expect.objectContaining({ parentId: 10, moduleId: 1, menuType: 2 }),
      ),
    );
  });
  it('新增根菜单固定当前接口模块，刷新保留手动收起状态', async () => {
    await mountPage();
    button('新增子菜单', row('应用列表')).click();
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    button('取消').click();
    await nextTick();
    await selectModule(2);
    button('收起全部').click();
    button('刷新').click();
    await vi.waitFor(() =>
      expect(api.getSystemMenuTreeApi.mock.calls).toHaveLength(2),
    );
    await nextTick();
    expect(
      document.querySelector('.ant-table-tbody')?.textContent,
    ).not.toContain('配置列表');
    button('新增主菜单').click();
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    expect(document.querySelector('#system-editor_parentId')).toBeNull();
    expect(document.querySelector('#system-editor_moduleId')).toBeNull();
    expect(document.querySelector('.ant-modal-title')?.textContent).toBe(
      '新增主菜单',
    );
    const input = document.querySelector<HTMLInputElement>(
      '#system-editor_name',
    );
    if (!input) throw new Error('找不到菜单名称');
    input.value = '工具菜单';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
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
