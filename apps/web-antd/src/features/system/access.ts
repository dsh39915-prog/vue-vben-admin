import type { RouteRecordRaw } from 'vue-router';

import { useAccessStore } from '@vben/stores';

export const systemPagePermissions: Record<string, string> = {
  '/system/dept': 'system:dept:query',
  '/system/login-log': 'system:login-log:query',
  '/system/menu': 'system:menu:query',
  '/system/role': 'system:role:query',
  '/system/user': 'system:user:query',
};
export function hasSystemPermission(codes: string[], code: string) {
  return codes.includes('*:*:*') || codes.includes(code);
}
export function canAccessSystemPath(path: string, codes: string[]) {
  const permission = systemPagePermissions[path.replace(/\/$/, '')];
  return !permission || hasSystemPermission(codes, permission);
}
export function useSystemAccess() {
  const access = useAccessStore();
  return (code: string) => hasSystemPermission(access.accessCodes, code);
}
export function filterSystemRoutes(
  routes: RouteRecordRaw[],
  codes: string[],
  parent = '',
): RouteRecordRaw[] {
  return routes.flatMap((route) => {
    const path = route.path.startsWith('/')
      ? route.path
      : `${parent}/${route.path}`;
    if (!canAccessSystemPath(path, codes)) return [];
    const children = route.children
      ? filterSystemRoutes(route.children, codes, path)
      : undefined;
    if (route.children?.length && !children?.length) return [];
    return [{ ...route, ...(children ? { children } : {}) } as RouteRecordRaw];
  });
}
