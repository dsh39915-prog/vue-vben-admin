import type { GenerateMenuAndRoutesOptions } from '@vben/types';

import { generateAccessible } from '@vben/access';

import { useAuthStore } from '#/store';

import { buildAuthorizedRoutes } from './menu-adapter';

const forbiddenComponent = () => import('#/views/_core/fallback/forbidden.vue');

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  const authorizedRoutes = buildAuthorizedRoutes(useAuthStore().menuTree);
  // 访问规则已由接口决定，框架仅处理组件注册与标签缓存。
  return await generateAccessible('frontend', {
    ...options,
    roles: [],
    routes: authorizedRoutes,
    // 可以指定没有权限跳转403页面
    forbiddenComponent,
    // 如果 route.meta.menuVisibleWithForbidden = true
  });
}

export { generateAccess };
