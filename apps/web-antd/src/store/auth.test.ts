import { createApp } from 'vue';

import { initStores, useAccessStore, useUserStore } from '@vben/stores';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from './auth';

const api = vi.hoisted(() => ({
  loginApi: vi.fn(),
  verifyLoginSmsApi: vi.fn(),
  getUserInfoApi: vi.fn(),
  getCurrentAccessApi: vi.fn(),
  getAllMenusApi: vi.fn(),
  logoutApi: vi.fn(),
}));
const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  currentRoute: { value: { fullPath: '/system/users' } },
}));
const resetRoutes = vi.hoisted(() => vi.fn());
vi.mock('#/api', () => api);
vi.mock('#/router', () => ({ resetRoutes }));
vi.mock('vue-router', async (original) => ({
  ...(await original<typeof import('vue-router')>()),
  useRouter: () => router,
}));
vi.mock('ant-design-vue', () => ({ notification: { success: vi.fn() } }));

beforeEach(async () => {
  vi.resetAllMocks();
  localStorage.clear();
  await initStores(createApp({}), { namespace: 'auth-tests' });
  api.loginApi.mockResolvedValue({
    status: 'AUTHENTICATED',
    accessToken: 'test-session',
  });
  api.verifyLoginSmsApi.mockResolvedValue({
    status: 'AUTHENTICATED',
    accessToken: 'sms-session',
  });
  api.getUserInfoApi.mockResolvedValue({
    id: 7,
    username: 'tester',
    realName: '测试用户',
    nickname: '',
    avatarUrl: '',
    passwordResetRequired: false,
  });
  api.getCurrentAccessApi.mockResolvedValue({
    roleCodes: ['editor'],
    permissionCodes: ['system:user:read'],
    moduleIds: [1],
    superAdmin: false,
  });
  api.getAllMenusApi.mockResolvedValue([
    {
      id: 1,
      name: '用户管理',
      menuType: 2,
      path: '/system/users',
      enabled: true,
      hidden: false,
      sortOrder: 0,
    },
  ]);
  api.logoutApi.mockResolvedValue(null);
});

describe('系统认证', () => {
  it('真实登录后读取资料、权限与菜单，并跳转首个可见页面', async () => {
    const auth = useAuthStore();
    await auth.authLogin({
      username: 'tester',
      password: ' unchanged password ',
    });
    expect(api.loginApi).toHaveBeenCalledWith({
      username: 'tester',
      password: ' unchanged password ',
    });
    expect(useAccessStore().accessToken).toBe('test-session');
    expect(useAccessStore().accessCodes).toEqual(['system:user:read']);
    expect(useUserStore().userInfo).toMatchObject({
      userId: '7',
      roles: ['editor'],
      superAdmin: false,
    });
    expect(auth.menuTree).toHaveLength(1);
    expect(router.push).toHaveBeenCalledWith('/system/users');
  });

  it('短信验证完成之前不保存令牌或请求资料', async () => {
    api.loginApi.mockResolvedValue({
      status: 'MFA_REQUIRED',
      challengeId: 'test-challenge',
      maskedMobile: '138****0000',
    });
    const auth = useAuthStore();
    await auth.authLogin({ username: 'tester', password: 'password' });
    expect(useAccessStore().accessToken).toBeNull();
    expect(api.getUserInfoApi).not.toHaveBeenCalled();
    await auth.authVerifySms('test-challenge', '123456');
    expect(api.verifyLoginSmsApi).toHaveBeenCalledWith(
      'test-challenge',
      '123456',
    );
    expect(useAccessStore().accessToken).toBe('sms-session');
  });
  it('首页使用接口返回的首个可见页面，无需前端路由注册表', async () => {
    const realMenus = await api.getAllMenusApi();
    api.getAllMenusApi.mockResolvedValue([
      {
        id: 99,
        name: '后端首页',
        menuType: 2,
        path: '/config-info',
        enabled: true,
        hidden: false,
        sortOrder: -1,
      },
      ...realMenus,
    ]);
    await useAuthStore().authLogin({
      username: 'tester',
      password: 'password',
    });
    expect(router.push).toHaveBeenCalledWith('/config-info');
    expect(useUserStore().userInfo?.homePath).toBe('/config-info');
  });

  it('必须改密的账号不请求被禁止访问的菜单，直接进入修改密码', async () => {
    api.getUserInfoApi.mockResolvedValue({
      id: 7,
      username: 'tester',
      realName: '测试用户',
      passwordResetRequired: true,
    });
    const auth = useAuthStore();
    await auth.authLogin({ username: 'tester', password: 'initial' });
    expect(auth.passwordResetRequired).toBe(true);
    expect(api.getAllMenusApi).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/auth/change-password');
  });

  it('资料获取失败清理令牌和权限，避免保留半登录状态', async () => {
    api.getAllMenusApi.mockRejectedValue(new Error('菜单加载失败'));
    await expect(
      useAuthStore().authLogin({ username: 'tester', password: 'password' }),
    ).rejects.toThrow('菜单加载失败');
    expect(useAccessStore().accessToken).toBeNull();
    expect(useAccessStore().accessCodes).toEqual([]);
    expect(useUserStore().userInfo).toBeNull();
  });

  it('刷新后重新加载当前账号的权限和菜单，退出时清理动态路由', async () => {
    useAccessStore().setAccessToken('restored-session');
    const auth = useAuthStore();
    await auth.fetchUserInfo();
    expect(useUserStore().userRoles).toEqual(['editor']);
    expect(auth.menuTree).toHaveLength(1);
    await auth.logout(false, false);
    expect(api.logoutApi).not.toHaveBeenCalled();
    expect(useAccessStore().accessToken).toBeNull();
    expect(auth.menuTree).toEqual([]);
    expect(resetRoutes).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith({
      path: '/auth/login',
      query: {},
    });
  });
});
