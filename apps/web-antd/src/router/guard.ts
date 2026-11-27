import type { RouteLocationNormalized, Router } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';
import { startProgress, stopProgress } from '@vben/utils';

import { coreRouteNames } from '#/router/routes';
import { useAuthStore } from '#/store';

import { authenticatedDestination } from './access-redirect';
import { clearNavigationFailure, navigationFailure } from './navigation-error';

/**
 * 通用守卫配置
 * @param router
 */
function setupCommonGuard(router: Router) {
  // 记录已经加载的页面
  const loadedPaths = new Set<string>();
  let latestTarget: RouteLocationNormalized | undefined;

  router.beforeEach((to) => {
    latestTarget = to;
    to.meta.loaded = loadedPaths.has(to.path);

    // 页面加载进度条
    if (!to.meta.loaded && preferences.transition.progress) {
      startProgress();
    }
    return true;
  });

  router.afterEach((to, _from, failure) => {
    // 记录页面是否加载,如果已经加载，后续的页面切换动画等效果不在重复执行

    if (!failure) {
      loadedPaths.add(to.path);
      clearNavigationFailure();
      latestTarget = undefined;
    }

    // 关闭页面加载进度条
    if (preferences.transition.progress) {
      stopProgress();
    }
  });
  router.onError((_error, to) => {
    stopProgress();
    if (to === latestTarget)
      navigationFailure.value = { fullPath: to.fullPath };
  });
}

/**
 * 权限访问守卫配置
 * @param router
 */
function setupAccessGuard(router: Router) {
  router.beforeEach(async (to) => {
    const accessStore = useAccessStore();
    const authStore = useAuthStore();

    if (
      coreRouteNames.includes(to.name as string) &&
      !to.meta.requiresAuth &&
      (to.path !== LOGIN_PATH || !accessStore.accessToken)
    ) {
      return true;
    }

    if (!accessStore.accessToken) {
      if (to.meta.ignoreAccess) return true;
      return {
        path: LOGIN_PATH,
        query:
          to.fullPath === preferences.app.defaultHomePath
            ? {}
            : { redirect: encodeURIComponent(to.fullPath) },
        replace: true,
      };
    }

    const token = accessStore.accessToken;
    let user: Awaited<ReturnType<typeof authStore.initializeAccess>>;
    try {
      user = await authStore.initializeAccess();
    } catch {
      if (token !== accessStore.accessToken) return LOGIN_PATH;
      return {
        path: accessStore.accessToken ? '/auth/access-error' : LOGIN_PATH,
        query: { redirect: encodeURIComponent(to.fullPath) },
        replace: true,
      };
    }
    if (token !== accessStore.accessToken) return LOGIN_PATH;
    if (authStore.passwordResetRequired) {
      return to.path === '/auth/change-password'
        ? true
        : '/auth/change-password';
    }
    if (to.path === '/auth/change-password') return true;
    if (to.path === LOGIN_PATH)
      return authenticatedDestination(router, to.query.redirect, user.homePath);

    // 即使路由已经初始化，也不能把历史临时落点当作真实的无权限结果。
    if (to.path === '/access-empty' && user.homePath !== '/access-empty')
      return { path: user.homePath, replace: true };

    // 首次访问时页面可能按旧的静态路由匹配；只在安装动态路由后重新匹配。
    const resolved = router.resolve(to.fullPath);
    if (resolved.matched.some((record, index) => record !== to.matched[index]))
      return { ...resolved, replace: true };
    return true;
  });
}

/**
 * 项目守卫配置
 * @param router
 */
function createRouterGuard(router: Router) {
  /** 通用 */
  setupCommonGuard(router);
  /** 权限访问 */
  setupAccessGuard(router);
}

export { createRouterGuard };
