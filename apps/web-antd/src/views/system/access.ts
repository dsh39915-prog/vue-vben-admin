import type { RouteRecordRaw } from 'vue-router';

import type { SystemResource } from '#/api';

import { useAccessStore, useUserStore } from '@vben/stores';

/** 从接口菜单的读取权限确定分组，只匹配接口实际返回的授权码。 */
export function useSystemAccess(
  currentResource?: () => SystemResource,
  currentMenuPermission?: () => unknown,
) {
  const access = useAccessStore();
  const users = useUserStore();

  function readPermission(resource: SystemResource): string | undefined {
    const currentCode = currentMenuPermission?.();
    if (
      currentResource?.() === resource &&
      typeof currentCode === 'string' &&
      currentCode
    )
      return currentCode;

    function find(routes: RouteRecordRaw[]): string | undefined {
      for (const route of routes) {
        const view = route.path
          .replaceAll('\\', '/')
          .replace(/\.vue$/, '')
          .replace(/\/index\/?$/, '');
        const code = route.meta?.permissionCode;
        if (
          view.split('/').findLast(Boolean) === resource &&
          typeof code === 'string' &&
          code
        )
          return code;
        const nested = find(route.children ?? []);
        if (nested) return nested;
      }
    }
    return find(access.accessRoutes);
  }

  function can(resource: SystemResource, action: string) {
    if (users.userInfo?.superAdmin === true) return true;
    const readCode = readPermission(resource);
    if (!readCode) return false;
    if (action === 'read') return access.accessCodes.includes(readCode);

    // 实际接口采用“权限分组:操作”的编码约定；不固定分组名称，也不生成授权码。
    const separator = readCode.lastIndexOf(':');
    if (separator === -1) return false;
    const group = readCode.slice(0, separator);
    return access.accessCodes.some((code) => {
      const position = code.lastIndexOf(':');
      return (
        position !== -1 &&
        code.slice(0, position) === group &&
        code.slice(position + 1) === action
      );
    });
  }
  return { can };
}
