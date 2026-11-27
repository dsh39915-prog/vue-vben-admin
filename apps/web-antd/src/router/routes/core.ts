import type { RouteRecordRaw } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';

import { getText } from '#/texts';

const BasicLayout = () => import('#/layouts/basic.vue');
const AuthPageLayout = () => import('#/layouts/auth.vue');
/** 全局404页面 */
const fallbackNotFoundRoute: RouteRecordRaw = {
  component: () => import('#/views/_core/fallback/not-found.vue'),
  meta: {
    hideInBreadcrumb: true,
    hideInMenu: true,
    hideInTab: true,
    title: '404',
  },
  name: 'FallbackNotFound',
  path: '/:path(.*)*',
};

/** 基本路由，这些路由是必须存在的 */
const coreRoutes: RouteRecordRaw[] = [
  /**
   * 根路由
   * 使用基础布局，作为所有页面的父级容器，子级就不必配置BasicLayout。
   * 此路由必须存在，且不应修改
   */
  {
    component: BasicLayout,
    meta: {
      hideInBreadcrumb: true,
      title: 'Root',
    },
    name: 'Root',
    path: '/',
    redirect: '/access-empty',
    children: [
      {
        name: 'AccessEmpty',
        path: '/access-empty',
        component: () => import('#/views/_core/fallback/forbidden.vue'),
        meta: { title: '暂无可用菜单', hideInMenu: true, requiresAuth: true },
      },
    ],
  },
  {
    component: AuthPageLayout,
    meta: {
      hideInTab: true,
      title: 'Authentication',
    },
    name: 'Authentication',
    path: '/auth',
    redirect: LOGIN_PATH,
    children: [
      {
        name: 'AccessInitializationError',
        path: 'access-error',
        component: () =>
          import('#/views/_core/authentication/access-error.vue'),
        meta: { title: '加载失败' },
      },
      {
        name: 'ChangeInitialPassword',
        path: 'change-password',
        component: () =>
          import('#/views/_core/authentication/change-password.vue'),
        meta: { title: '修改密码', requiresAuth: true },
      },
      {
        name: 'Login',
        path: 'login',
        component: () => import('#/views/_core/authentication/login.vue'),
        meta: {
          title: getText('page.auth.login'),
        },
      },
    ],
  },
];

export { coreRoutes, fallbackNotFoundRoute };
