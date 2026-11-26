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
  currentRoute: {
    value: { fullPath: '/system/users', query: {} as Record<string, string> },
  },
  resolve: vi.fn(),
  hasRoute: vi.fn(),
}));
const resetRoutes = vi.hoisted(() => vi.fn());
const generateAccess = vi.hoisted(() => vi.fn());
vi.mock('#/api', () => api);
vi.mock('#/router', () => ({ resetRoutes }));
vi.mock('#/router/access', () => ({ generateAccess }));
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
  router.currentRoute.value = { fullPath: '/system/users', query: {} };
  router.resolve.mockImplementation((path) => ({
    fullPath: path,
    matched: [{ name: 'menu:1' }],
  }));
  router.hasRoute.mockReturnValue(true);
  generateAccess.mockResolvedValue({
    accessibleMenus: [],
    accessibleRoutes: [],
  });
});

describe('系统认证', () => {
  it('菜单慢返回时登录和守卫共享初始化，路由就绪前不跳转', async () => {
    const menus = await api.getAllMenusApi();
    api.getAllMenusApi.mockClear();
    let finishMenus: ((value: unknown) => void) | undefined;
    api.getAllMenusApi.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishMenus = resolve;
        }),
    );
    let finishRoutes: ((value: unknown) => void) | undefined;
    generateAccess.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRoutes = resolve;
        }),
    );
    const auth = useAuthStore();
    const login = auth.authLogin({ username: 'tester', password: 'password' });
    await vi.waitFor(() => expect(api.getAllMenusApi).toHaveBeenCalledOnce());
    const guard = auth.initializeAccess();
    expect(router.push).not.toHaveBeenCalled();
    expect(generateAccess).not.toHaveBeenCalled();
    expect(useAccessStore().isAccessChecked).toBe(false);
    finishMenus?.(menus);
    await vi.waitFor(() => expect(generateAccess).toHaveBeenCalledOnce());
    expect(router.push).not.toHaveBeenCalled();
    expect(useAccessStore().isAccessChecked).toBe(false);
    finishRoutes?.({ accessibleMenus: [], accessibleRoutes: [] });
    await Promise.all([login, guard]);
    expect(api.getUserInfoApi).toHaveBeenCalledOnce();
    expect(api.getCurrentAccessApi).toHaveBeenCalledOnce();
    expect(api.getAllMenusApi).toHaveBeenCalledOnce();
    expect(useAccessStore().isAccessChecked).toBe(true);
    expect(router.push).toHaveBeenCalledExactlyOnceWith('/system/users');
  });
  it('历史回跳地址为临时无权限页时，登录仍前往接口首页', async () => {
    router.currentRoute.value.query.redirect =
      encodeURIComponent('/access-empty');
    await useAuthStore().authLogin({
      username: 'tester',
      password: 'password',
    });
    expect(router.push).toHaveBeenCalledWith('/system/users');
  });
  it('登录完成注册路由后保留仍有权限的回跳页面及查询参数', async () => {
    router.currentRoute.value.query.redirect = encodeURIComponent(
      '/config-info?page=2#item',
    );
    await useAuthStore().authLogin({
      username: 'tester',
      password: 'password',
    });
    expect(router.push).toHaveBeenCalledWith('/config-info?page=2#item');
    expect(generateAccess).toHaveBeenCalledOnce();
  });
  it('接口确实没有可见菜单时才进入无权限页', async () => {
    api.getAllMenusApi.mockResolvedValue([]);
    await useAuthStore().authLogin({
      username: 'tester',
      password: 'password',
    });
    expect(router.push).toHaveBeenCalledWith('/access-empty');
    expect(useAccessStore().isAccessChecked).toBe(true);
  });
  it('旧登录初始化晚返回时不覆盖新会话，也不注册旧菜单', async () => {
    let finish: ((value: unknown) => void) | undefined;
    api.getAllMenusApi.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const auth = useAuthStore();
    useAccessStore().setAccessToken('old-session');
    const old = auth.initializeAccess();
    await vi.waitFor(() => expect(api.getAllMenusApi).toHaveBeenCalledOnce());
    auth.$reset();
    useAccessStore().setAccessToken('new-session');
    finish?.([]);
    await expect(old).rejects.toThrow('登录状态已变化');
    expect(useUserStore().userInfo).toBeNull();
    expect(generateAccess).not.toHaveBeenCalled();
    expect(useAccessStore().accessToken).toBe('new-session');
  });
  it('授权刷新替换菜单、权限与路由，保持当前仍可访问的页面', async () => {
    const auth = useAuthStore();
    useAccessStore().setAccessToken('session');
    const first = auth.refreshAccess();
    const second = auth.refreshAccess();
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(api.getAllMenusApi).toHaveBeenCalledTimes(1);
    expect(generateAccess).toHaveBeenCalledOnce();
    expect(resetRoutes).toHaveBeenCalledOnce();
    expect(useAccessStore().isAccessChecked).toBe(true);
    expect(useAccessStore().accessCodes).toEqual(['system:user:read']);
    expect(router.replace).toHaveBeenCalledWith('/system/users');
  });
  it('当前菜单被移除时跳转新的首个可用页面', async () => {
    useAccessStore().setAccessToken('session');
    api.getAllMenusApi.mockResolvedValue([
      {
        id: 2,
        name: '配置',
        menuType: 2,
        path: '/config-info',
        enabled: true,
        hidden: false,
        sortOrder: 0,
      },
    ]);
    router.resolve.mockReturnValue({ matched: [{ name: 'FallbackNotFound' }] });
    expect(await useAuthStore().refreshAccess()).toBe(true);
    expect(router.replace).toHaveBeenCalledWith('/config-info');
  });
  it('授权刷新失败阻止继续操作，独立重试成功后解除', async () => {
    useAccessStore().setAccessToken('session');
    api.getAllMenusApi.mockRejectedValueOnce(new Error('offline'));
    const auth = useAuthStore();
    expect(await auth.refreshAccess()).toBe(false);
    expect(auth.accessRefreshFailed).toBe(true);
    expect(auth.accessRefreshing).toBe(false);
    expect(await auth.refreshAccess()).toBe(true);
    expect(auth.accessRefreshFailed).toBe(false);
  });
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
    expect(auth.moduleIds).toEqual([1]);
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
    expect(auth.moduleIds).toEqual([]);
    expect(resetRoutes).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith({
      path: '/auth/login',
      query: {},
    });
  });
});
