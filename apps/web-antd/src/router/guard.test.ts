import { createMemoryHistory, createRouter } from 'vue-router';

import { updatePreferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRouterGuard } from './guard';
import { clearNavigationFailure, navigationFailure } from './navigation-error';

const auth = vi.hoisted(() => ({
  initializeAccess: vi.fn(),
  passwordResetRequired: false,
}));
vi.mock('#/store', () => ({ useAuthStore: () => auth }));
vi.mock('#/router/routes', () => ({
  coreRouteNames: [
    'Root',
    'Login',
    'AccessEmpty',
    'ChangeInitialPassword',
    'AccessInitializationError',
  ],
}));

beforeEach(() => {
  clearNavigationFailure();
  vi.resetAllMocks();
  setActivePinia(createPinia());
  updatePreferences({ transition: { progress: false } });
  auth.passwordResetRequired = false;
});

function setup() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        name: 'Root',
        component: {},
        redirect: '/access-empty',
        children: [
          {
            path: '/access-empty',
            name: 'AccessEmpty',
            component: {},
            meta: { requiresAuth: true, title: '暂无可用菜单' },
          },
        ],
      },
      { path: '/auth/login', name: 'Login', component: {} },
      {
        path: '/auth/access-error',
        name: 'AccessInitializationError',
        component: {},
      },
      {
        path: '/auth/change-password',
        name: 'ChangeInitialPassword',
        component: {},
        meta: { requiresAuth: true, title: '修改密码' },
      },
      { path: '/:path(.*)*', name: 'FallbackNotFound', component: {} },
    ],
  });
  createRouterGuard(router);
  function install() {
    router.addRoute('Root', {
      path: '/allowed',
      name: 'menu:99',
      component: {},
    });
    useAccessStore().setIsAccessChecked(true);
    return { homePath: '/allowed' };
  }
  auth.initializeAccess.mockImplementation(async () => {
    if (!router.hasRoute('menu:99')) install();
    return { homePath: '/allowed' };
  });
  return { router, install };
}

describe('登录与权限路由时序', () => {
  it('页面脚本加载失败记录完整目标地址，成功导航后移除恢复界面', async () => {
    const { router } = setup();
    useAccessStore().setAccessToken('session');
    await router.push('/allowed');
    router.addRoute('Root', {
      name: 'menu:broken',
      path: '/broken',
      component: async () => {
        throw new Error('Failed to fetch dynamically imported module');
      },
    });
    await expect(router.push('/broken?page=2#row')).rejects.toThrow(
      'dynamically imported',
    );
    expect(navigationFailure.value).toEqual({ fullPath: '/broken?page=2#row' });
    await router.push('/auth/access-error');
    expect(navigationFailure.value).toBeUndefined();
  });
  it('旧页面脚本迟到失败不能覆盖已完成的新导航', async () => {
    const { router } = setup();
    useAccessStore().setAccessToken('session');
    await router.push('/allowed');
    let fail: (() => void) | undefined;
    const loader = vi.fn(
      () =>
        new Promise<never>((_resolve, reject) => {
          fail = () => reject(new Error('old chunk failed'));
        }),
    );
    router.addRoute('Root', {
      name: 'menu:broken',
      path: '/broken',
      component: loader,
    });
    const old = router.push('/broken').catch(() => {});
    await vi.waitFor(() => expect(loader).toHaveBeenCalledOnce());
    await router.push('/auth/access-error');
    fail?.();
    await old;
    expect(navigationFailure.value).toBeUndefined();
    expect(router.currentRoute.value.path).toBe('/auth/access-error');
  });
  it.each(['/allowed?page=2#row', '/auth/login?redirect=%252Fallowed'])(
    '初始化失败进入可重试页面，恢复后继续访问原地址：%s',
    async (target) => {
      const { router } = setup();
      useAccessStore().setAccessToken('session');
      auth.initializeAccess.mockRejectedValueOnce(
        new Error('service unavailable'),
      );
      await router.push(target);
      expect(router.currentRoute.value.path).toBe('/auth/access-error');
      expect(router.currentRoute.value.query.redirect).toBe(
        encodeURIComponent(target),
      );
      expect(auth.initializeAccess).toHaveBeenCalledTimes(1);
      await router.replace(target);
      expect(router.currentRoute.value.fullPath).toBe(
        target.startsWith('/auth') ? '/allowed' : target,
      );
    },
  );
  it('初始化期间会话失效时返回登录表单，不进入重试循环', async () => {
    const { router } = setup();
    useAccessStore().setAccessToken('expired');
    auth.initializeAccess.mockImplementationOnce(async () => {
      useAccessStore().setAccessToken(null);
      throw new Error('Unauthorized');
    });
    await router.push('/allowed');
    expect(router.currentRoute.value.path).toBe('/auth/login');
    expect(auth.initializeAccess).toHaveBeenCalledTimes(1);
  });
  it('旧会话初始化失败不能把新登录会话带入错误页', async () => {
    const { router } = setup();
    useAccessStore().setAccessToken('old-session');
    auth.initializeAccess.mockImplementationOnce(async () => {
      useAccessStore().setAccessToken('new-session');
      throw new Error('旧会话已结束');
    });
    await router.push('/allowed');
    expect(router.currentRoute.value.path).toBe('/allowed');
    expect(useAccessStore().accessToken).toBe('new-session');
  });
  it('权限已经初始化时，也会从临时无权限页回到真实首页', async () => {
    const { router, install } = setup();
    useAccessStore().setAccessToken('session');
    install();
    await router.push('/access-empty');
    expect(router.currentRoute.value.fullPath).toBe('/allowed');
  });
  it('菜单尚未返回时不展示无权限页，初始化结束后进入真实首页', async () => {
    const { router, install } = setup();
    useAccessStore().setAccessToken('session');
    let finish: (() => void) | undefined;
    auth.initializeAccess.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(install());
        }),
    );
    const navigation = router.push('/access-empty');
    await vi.waitFor(() =>
      expect(auth.initializeAccess).toHaveBeenCalledOnce(),
    );
    expect(router.currentRoute.value.name).not.toBe('AccessEmpty');
    finish?.();
    await navigation;
    expect(router.currentRoute.value.fullPath).toBe('/allowed');
  });
  it('携带旧无权限回跳地址的登录页，在令牌恢复后进入接口首页', async () => {
    const { router } = setup();
    useAccessStore().setAccessToken('session');
    await router.push('/auth/login?redirect=%252Faccess-empty');
    expect(router.currentRoute.value.fullPath).toBe('/allowed');
  });
  it('刷新业务地址时等待路由注册，并保留原地址参数', async () => {
    const { router } = setup();
    useAccessStore().setAccessToken('session');
    await router.push('/allowed?page=2#row');
    expect(router.currentRoute.value.fullPath).toBe('/allowed?page=2#row');
    expect(router.currentRoute.value.name).toBe('menu:99');
  });
  it('菜单确实为空时保留无权限页面', async () => {
    const { router } = setup();
    useAccessStore().setAccessToken('session');
    auth.initializeAccess.mockResolvedValue({ homePath: '/access-empty' });
    await router.push('/access-empty');
    expect(router.currentRoute.value.name).toBe('AccessEmpty');
  });
});
