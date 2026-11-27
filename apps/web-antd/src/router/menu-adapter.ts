import type { RouteRecordRaw } from 'vue-router';

import type { ComponentRecordType } from '@vben/types';

import type { SystemMenu } from '#/api';

const pageComponents: ComponentRecordType = import.meta.glob(
  '../views/**/*.vue',
);
const missingPage = () => import('#/views/_core/fallback/not-found.vue');

/** 接口 path 同时作为路由地址与页面文件标识，不维护业务路由或权限码对照表。 */
export function buildAuthorizedRoutes(
  menus: SystemMenu[],
  pages: ComponentRecordType = pageComponents,
): RouteRecordRaw[] {
  const seen = new Set<number>();
  function resolvePage(path: string) {
    const view = path
      .replaceAll('\\', '/')
      .replace(/^\/?views\//, '')
      .replaceAll(/^\/+|\/+$/g, '');
    const candidates = view.endsWith('.vue')
      ? [view]
      : [`${view}.vue`, `${view}/index.vue`];
    for (const candidate of candidates) {
      const component = pages[`../views/${candidate}`];
      if (component) return component;
    }
    return missingPage;
  }
  function convert(items: SystemMenu[], parent = ''): RouteRecordRaw[] {
    return items
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .flatMap((menu) => {
        if (seen.has(menu.id) || !menu.enabled || menu.menuType === 3)
          return [];
        seen.add(menu.id);
        const fullPath = menu.path?.startsWith('/')
          ? menu.path
          : `${parent}/${menu.path || ''}`.replaceAll(/\/{2,}/g, '/');
        const children = convert(menu.children ?? [], fullPath);
        // 目录不对应页面；没有可用子菜单时不生成叶子路由或首页落点。
        if (menu.menuType === 1 && children.length === 0) return [];
        return [
          {
            name: `menu:${menu.id}`,
            path: menu.path || '',
            component: children.length > 0 ? undefined : resolvePage(fullPath),
            children: children.length > 0 ? children : undefined,
            redirect:
              children.length > 0
                ? firstAuthorizedPath(children, fullPath)
                : undefined,
            meta: {
              menuId: menu.id,
              permissionCode: menu.permissionCode,
              title: menu.name,
              icon: menu.icon || undefined,
              hideInMenu: menu.hidden,
              keepAlive: menu.menuType === 2,
              order: menu.sortOrder,
            },
          } as RouteRecordRaw,
        ];
      });
  }
  return convert(menus);
}

export function firstAuthorizedPath(
  routes: RouteRecordRaw[],
  parent = '',
): string | undefined {
  for (const route of routes) {
    if (route.meta?.hideInMenu) continue;
    const path = route.path.startsWith('/')
      ? route.path
      : `${parent}/${route.path}`.replaceAll(/\/{2,}/g, '/');
    const child = firstAuthorizedPath(route.children ?? [], path);
    if (child) return child;
    if (route.component && path) return path;
  }
}
