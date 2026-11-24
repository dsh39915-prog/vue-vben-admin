import type { App } from 'vue';

import type { SystemResource } from '#/api';

import { createApp, nextTick } from 'vue';

import { useAccessStore, useUserStore } from '@vben/stores';

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ResourcePage from './resource-page.vue';

const api = vi.hoisted(() => ({
  getSystemResourceListApi: vi.fn(),
  getSystemRoleOptionsApi: vi.fn(),
  getSystemResourceDetailsApi: vi.fn(),
  createSystemResourceApi: vi.fn(),
  updateSystemResourceApi: vi.fn(),
  deleteSystemResourceApi: vi.fn(),
  updateSystemStatusApi: vi.fn(),
  assignSystemUserRolesApi: vi.fn(),
  resetSystemUserPasswordApi: vi.fn(),
  getSystemRoleGrantsApi: vi.fn(),
  updateSystemRoleGrantsApi: vi.fn(),
}));
const routeMeta = vi.hoisted(() => ({
  title: '接口页面标题',
  permissionCode: 'tenant:people:browse',
}));
vi.mock('#/api', () => api);
vi.mock('vue-router', async (original) => ({
  ...(await original<typeof import('vue-router')>()),
  useRoute: () => ({ meta: routeMeta }),
}));
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));
const user = {
  id: 7,
  username: 'tester',
  realName: '测试用户',
  nickname: '',
  mobile: '',
  departmentId: null,
  enabled: false,
  roleIds: [5],
  avatarUrl: '',
  platform: 1,
  namePinyin: '',
  nameInitials: '',
};
const role = {
  id: 5,
  name: '编辑角色',
  code: 'editor',
  enabled: true,
  sortOrder: 0,
  remark: '',
};
let app: App;
function button(label: string) {
  const result = [...document.querySelectorAll('button')].find(
    (element) => element.textContent?.replaceAll(/\s/g, '') === label,
  );
  if (!result) throw new Error(`找不到按钮：${label}`);
  return result;
}
async function input(name: string, value: string) {
  const element = document.querySelector<HTMLInputElement>(
    `#system-editor_${name}`,
  );
  if (!element) throw new Error(`找不到表单字段：${name}`);
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}
async function mountPage(resource: SystemResource = 'users') {
  const pinia = createPinia();
  setActivePinia(pinia);
  useUserStore().setUserInfo({
    userId: '1',
    username: 'admin-test',
    realName: '测试管理员',
    avatar: '',
    superAdmin: true,
  });
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp(ResourcePage, { resource });
  app.use(pinia);
  app.mount(container);
  await vi.waitFor(() =>
    expect(document.querySelector('.ant-table-tbody')?.textContent).toContain(
      resource === 'users' ? user.realName : role.name,
    ),
  );
}
async function open(label: string) {
  button(label).click();
  await vi.waitFor(() =>
    expect(document.querySelector('.ant-modal-body')).not.toBeNull(),
  );
  await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
}
beforeEach(() => {
  vi.resetAllMocks();
  api.getSystemResourceListApi.mockImplementation(async (resource, params) =>
    resource === 'users' || resource === 'roles'
      ? {
          page: params?.page ?? 1,
          pageSize: params?.pageSize ?? 20,
          total: 21,
          records: resource === 'users' ? [user] : [role],
        }
      : [],
  );
  api.getSystemRoleOptionsApi.mockResolvedValue([role]);
  api.getSystemResourceDetailsApi.mockImplementation(async (resource) =>
    resource === 'users' ? user : role,
  );
  api.createSystemResourceApi.mockResolvedValue({ id: 8 });
  api.updateSystemResourceApi.mockResolvedValue({ id: 7 });
  api.getSystemRoleGrantsApi.mockResolvedValue({
    menuIds: [],
    permissionIds: [],
    moduleIds: [],
  });
  api.updateSystemRoleGrantsApi.mockResolvedValue(null);
  api.assignSystemUserRolesApi.mockResolvedValue(null);
});
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

describe('系统管理页面', { timeout: 20_000 }, () => {
  it('默认每页 20 条并请求用户分页', async () => {
    await mountPage();
    expect(api.getSystemResourceListApi).toHaveBeenCalledWith('users', {
      page: 1,
      pageSize: 20,
    });
    document.querySelector<HTMLElement>('.ant-pagination-item-2')?.click();
    await vi.waitFor(() =>
      expect(api.getSystemResourceListApi).toHaveBeenCalledWith('users', {
        page: 2,
        pageSize: 20,
      }),
    );
  });
  it('新增用户保留原始密码，提交角色空集合，不带状态和服务器字段', async () => {
    await mountPage();
    await open('新增');
    await input('username', ' new_user ');
    await input('realName', ' 新用户 ');
    await input('password', ' password-with-spaces ');
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.createSystemResourceApi).toHaveBeenCalledWith('users', {
        username: 'new_user',
        password: ' password-with-spaces ',
        realName: '新用户',
        nickname: '',
        mobile: '',
        departmentId: null,
        roleIds: [],
      }),
    );
  });
  it('编辑用户只保存资料，角色、状态、密码分开处理', async () => {
    await mountPage();
    await open('编辑');
    await input('realName', '已更新');
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.updateSystemResourceApi).toHaveBeenCalledWith('users', 7, {
        username: 'tester',
        realName: '已更新',
        nickname: '',
        mobile: '',
        departmentId: null,
        avatarUrl: '',
        platform: 1,
        namePinyin: '',
        nameInitials: '',
      }),
    );
    expect(api.assignSystemUserRolesApi).not.toHaveBeenCalled();
    expect(api.updateSystemStatusApi).not.toHaveBeenCalled();
  });
  it('角色授权读取独立矩阵，并允许保存空集合', async () => {
    await mountPage('roles');
    await open('授权');
    expect(api.getSystemRoleGrantsApi).toHaveBeenCalledWith(5);
    button('保存').click();
    await vi.waitFor(() =>
      expect(api.updateSystemRoleGrantsApi).toHaveBeenCalledWith(5, {
        menuIds: [],
        permissionIds: [],
        moduleIds: [],
      }),
    );
    expect(api.updateSystemResourceApi).not.toHaveBeenCalled();
  });
  it('按照服务端权限码控制新增、编辑、删除和授权按钮', async () => {
    await mountPage();
    useUserStore().setUserInfo({
      userId: '9',
      username: 'reader',
      realName: '只读用户',
      avatar: '',
      superAdmin: false,
    });
    useAccessStore().setAccessCodes([
      'tenant:people:browse',
      'tenant:people:update',
    ]);
    await nextTick();
    const labels = [...document.querySelectorAll('button')].map((item) =>
      item.textContent?.replaceAll(/\s/g, ''),
    );
    expect(labels).toContain('详情');
    expect(labels).toContain('编辑');
    for (const label of ['新增', '删除', '角色', '重置密码', '停用', '启用'])
      expect(labels).not.toContain(label);
  });
  it('详情失败阻止提交，重试后恢复编辑', async () => {
    api.getSystemResourceDetailsApi.mockRejectedValueOnce(
      new Error('详情失败'),
    );
    await mountPage();
    button('编辑').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('详情加载失败'),
    );
    expect(button('保存').disabled).toBe(true);
    button('重试详情').click();
    await vi.waitFor(() => expect(button('保存').disabled).toBe(false));
    expect(api.getSystemResourceDetailsApi).toHaveBeenCalledTimes(2);
  });
  it('详情中的输入框和选择框均只读，不提供保存按钮', async () => {
    await mountPage();
    button('详情').click();
    await vi.waitFor(() =>
      expect(
        document.querySelector<HTMLInputElement>('#system-editor_username')
          ?.value,
      ).toBe('tester'),
    );
    expect(
      document.querySelector<HTMLInputElement>('#system-editor_username')
        ?.disabled,
    ).toBe(true);
    expect(
      document.querySelector<HTMLInputElement>('#system-editor_departmentId')
        ?.disabled,
    ).toBe(true);
    expect(
      document.querySelector<HTMLInputElement>('#system-editor_platform')
        ?.disabled,
    ).toBe(true);
    expect(
      [...document.querySelectorAll('.ant-modal-footer button')].some(
        (item) => item.textContent?.replaceAll(/\s/g, '') === '保存',
      ),
    ).toBe(false);
  });
  it('重置密码检查 UTF-8 字节长度，不依赖无关的部门选项', async () => {
    await mountPage();
    api.getSystemResourceListApi.mockRejectedValue(new Error('部门选项失败'));
    await open('重置密码');
    await input('newPassword', '密'.repeat(30));
    button('保存').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain(
        '密码 UTF-8 长度不能超过 72 字节',
      ),
    );
    expect(api.resetSystemUserPasswordApi).not.toHaveBeenCalled();
  });
});
