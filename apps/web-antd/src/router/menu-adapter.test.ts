import type { SystemMenu } from '#/api';

import { describe, expect, it } from 'vitest';

import { buildAuthorizedRoutes, firstAuthorizedPath } from './menu-adapter';

const page = () => Promise.resolve({ default: {} });
function menu(id: number, values: Partial<SystemMenu>): SystemMenu {
  return {
    id,
    enabled: true,
    hidden: false,
    icon: '',
    menuType: 2,
    moduleId: null,
    name: `接口菜单${id}`,
    parentId: null,
    path: '',
    permissionCode: '',
    remark: '',
    sortOrder: 0,
    ...values,
  };
}
describe('接口菜单生成路由', () => {
  it('空目录及子菜单全部无效的目录不成为首页，保留真实可用页面', () => {
    const result = buildAuthorizedRoutes(
      [
        menu(1, { menuType: 1, path: '/empty', sortOrder: -2, children: [] }),
        menu(2, {
          menuType: 1,
          path: '/disabled-group',
          sortOrder: -1,
          children: [
            menu(3, { path: '/disabled', enabled: false }),
            menu(4, { menuType: 3 }),
          ],
        }),
        menu(5, { path: '/available' }),
      ],
      { '../views/available/index.vue': page },
    );
    expect(result.map((route) => route.path)).toEqual(['/available']);
    expect(firstAuthorizedPath(result)).toBe('/available');
    expect(
      buildAuthorizedRoutes([menu(6, { menuType: 1, path: '/empty' })]),
    ).toEqual([]);
  });
  it('直接按接口 path 自动发现页面，标题、图标、顺序也采用接口值', () => {
    const result = buildAuthorizedRoutes(
      [
        menu(42, {
          path: '/custom/screen',
          name: '服务端标题',
          icon: 'lucide:box',
          sortOrder: 17,
        }),
      ],
      { '../views/custom/screen/index.vue': page },
    );
    expect(result[0]).toMatchObject({
      name: 'menu:42',
      path: '/custom/screen',
      meta: {
        title: '服务端标题',
        icon: 'lucide:box',
        order: 17,
        keepAlive: true,
        menuId: 42,
      },
    });
    expect(result[0]?.component).toBe(page);
  });
  it('支持接口直接提供 vue 文件标识，不需要权限码到页面的映射', () => {
    const result = buildAuthorizedRoutes(
      [
        menu(7, {
          path: '/custom/page.vue',
          permissionCode: 'opaque-from-server',
        }),
      ],
      { '../views/custom/page.vue': page },
    );
    expect(result[0]?.component).toBe(page);
    expect(result[0]?.path).toBe('/custom/page.vue');
    expect(result[0]?.meta?.permissionCode).toBe('opaque-from-server');
  });
  it('页面文件缺失时保留接口菜单并使用 404，不由前端删改菜单数据', () => {
    const result = buildAuthorizedRoutes(
      [menu(1, { path: '/not-yet-implemented' })],
      {},
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.path).toBe('/not-yet-implemented');
    expect(result[0]?.component).toBeTypeOf('function');
  });
  it('遵循启用、隐藏和按钮类型字段，保持接口层级', () => {
    const result = buildAuthorizedRoutes(
      [
        menu(1, {
          path: '/group',
          menuType: 1,
          children: [
            menu(2, { path: '/disabled', enabled: false }),
            menu(3, { path: '/button', menuType: 3 }),
            menu(4, { path: '/hidden', hidden: true }),
            menu(5, { path: '/visible' }),
          ],
        }),
      ],
      {},
    );
    expect(result[0]?.children).toHaveLength(2);
    expect(result[0]?.children?.[0]?.meta?.hideInMenu).toBe(true);
    expect(firstAuthorizedPath(result)).toBe('/visible');
  });
  it('相对路径按接口目录层级解析首页，不生成前端业务地址', () => {
    const result = buildAuthorizedRoutes(
      [
        menu(1, {
          path: '/group',
          menuType: 1,
          children: [menu(2, { path: 'page' })],
        }),
      ],
      { '../views/group/page/index.vue': page },
    );
    expect(firstAuthorizedPath(result)).toBe('/group/page');
    expect(result[0]?.children?.[0]?.component).toBe(page);
  });
});
