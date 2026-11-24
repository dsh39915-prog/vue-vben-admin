import type { RouteRecordRaw } from 'vue-router';

import { useAccessStore, useUserStore } from '@vben/stores';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSystemAccess } from './access';

beforeEach(() => {
  setActivePinia(createPinia());
  useUserStore().setUserInfo({
    userId: '7',
    username: 'reader',
    realName: '测试',
    avatar: '',
    superAdmin: false,
  });
});

describe('接口驱动的按钮授权', () => {
  it('权限分组来自当前接口菜单，支持不同命名空间及资源名称', () => {
    useAccessStore().setAccessCodes([
      'custom:people:inspect',
      'custom:people:create',
      'custom:other:delete',
    ]);
    const { can } = useSystemAccess(
      () => 'users',
      () => 'custom:people:inspect',
    );
    expect(can('users', 'read')).toBe(true);
    expect(can('users', 'create')).toBe(true);
    expect(can('users', 'delete')).toBe(false);
    expect(can('users', 'update')).toBe(false);
  });
  it('只有接口实际返回的完整权限码才能授权，不按后缀跨分组放行', () => {
    useAccessStore().setAccessCodes([
      'different:people:update',
      'custom:peoples:update',
    ]);
    const { can } = useSystemAccess(
      () => 'users',
      () => 'custom:people:read',
    );
    expect(can('users', 'update')).toBe(false);
    expect(can('users', 'read')).toBe(false);
  });
  it('关联列表读取权限取自接口生成的菜单，兼容 index.vue 组件标识', () => {
    useAccessStore().setAccessRoutes([
      {
        path: '/configuration',
        children: [
          {
            path: '/configuration/roles/index.vue',
            component: {},
            meta: { title: '接口角色', permissionCode: 'tenant:groups:browse' },
          },
        ],
      },
    ] as RouteRecordRaw[]);
    useAccessStore().setAccessCodes(['tenant:groups:browse']);
    const { can } = useSystemAccess();
    expect(can('roles', 'read')).toBe(true);
    expect(can('departments', 'read')).toBe(false);
  });
  it('缺少菜单授权信息时不猜测权限码，不从角色编码推断管理员权限', () => {
    useUserStore().setUserRoles(['super_admin']);
    useAccessStore().setAccessCodes(['arbitrary:users:create']);
    expect(useSystemAccess().can('users', 'create')).toBe(false);
    expect(
      useSystemAccess(
        () => 'users',
        () => 'opaque-read',
      ).can('users', 'create'),
    ).toBe(false);
  });
  it('只采用接口返回的 superAdmin 布尔标识', () => {
    useUserStore().setUserInfo({
      userId: '7',
      username: 'admin',
      realName: '测试',
      avatar: '',
      superAdmin: true,
    });
    expect(useSystemAccess().can('users', 'create')).toBe(true);
  });
});
