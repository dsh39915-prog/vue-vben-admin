import type { RouteRecordRaw } from 'vue-router';

import { traverseTreeValues } from '@vben/utils';

import { coreRoutes, fallbackNotFoundRoute } from './core';

/** 仅注册登录、改密和异常页等框架路由；业务路由在获取接口菜单后注册。 */
const routes: RouteRecordRaw[] = [...coreRoutes, fallbackNotFoundRoute];

/** 基本路由列表，这些路由不需要进入权限拦截 */
const coreRouteNames = traverseTreeValues(coreRoutes, (route) => route.name);

export { coreRouteNames, routes };
