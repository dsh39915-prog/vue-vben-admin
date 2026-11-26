import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assignSystemUserRolesApi,
  getSystemMenuTreeApi,
  getSystemRoleOptionsApi,
  updateSystemRoleGrantsApi,
  updateSystemStatusApi,
} from './system';
const client = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  request: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));
beforeEach(() => vi.resetAllMocks());
describe('系统管理接口契约', () => {
  it('组合菜单树使用独立tree接口，沿用系统客户端代理', async () => {
    await getSystemMenuTreeApi();
    expect(client.get).toHaveBeenCalledWith('/system/menus/tree');
  });
  it('启停使用 PATCH 和布尔值 false', async () => {
    await updateSystemStatusApi('users', 7, false);
    expect(client.request).toHaveBeenCalledWith('/system/users/7/status', {
      method: 'PATCH',
      data: { enabled: false },
    });
  });
  it('角色和授权允许以空集合明确移除全部配置', async () => {
    await assignSystemUserRolesApi(7, []);
    await updateSystemRoleGrantsApi(3, {
      menuIds: [],
      permissionIds: [],
      moduleIds: [],
    });
    expect(client.put).toHaveBeenCalledWith('/system/users/7/roles', {
      roleIds: [],
    });
    expect(client.put).toHaveBeenCalledWith('/system/roles/3/grants', {
      menuIds: [],
      permissionIds: [],
      moduleIds: [],
    });
  });
  it('角色选项超过 100 个时继续加载后续页', async () => {
    client.get
      .mockResolvedValueOnce({
        records: Array.from({ length: 100 }, (_, id) => ({ id })),
        total: 101,
      })
      .mockResolvedValueOnce({ records: [{ id: 100 }], total: 101 });
    expect(await getSystemRoleOptionsApi()).toHaveLength(101);
    expect(client.get).toHaveBeenLastCalledWith('/system/roles', {
      params: { page: 2, pageSize: 100 },
    });
  });
});
