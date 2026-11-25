import type { MenuRecordRaw } from '@vben/types';

import type { SystemMenu, SystemModule } from '#/api';

import { describe, expect, it } from 'vitest';

import { findMenuModule, groupModuleMenus } from './module-menus';

function menu(
  id: number,
  path: string,
  moduleId: null | number,
  children: SystemMenu[] = [],
): SystemMenu {
  return {
    id,
    path,
    moduleId,
    children,
    name: `接口菜单${id}`,
    parentId: null,
    menuType: children.length > 0 ? 1 : 2,
    enabled: true,
    hidden: false,
    sortOrder: 0,
    permissionCode: '',
    icon: '',
    remark: '',
  };
}
const modules: SystemModule[] = [
  {
    id: 31,
    name: '接口业务模块',
    code: 'arbitrary-business',
    enabled: true,
    sortOrder: 20,
    remark: '',
  },
  {
    id: 17,
    name: '接口系统模块',
    code: 'arbitrary-admin',
    enabled: true,
    sortOrder: 1,
    remark: '',
  },
];
const source = [
  menu(1, '/custom', 17, [menu(2, 'users', 17), menu(3, '/outside', 31)]),
  menu(4, '/tools', 31, [menu(5, 'list', 31)]),
];
const visible: MenuRecordRaw[] = [
  {
    name: '授权目录',
    path: '/custom',
    children: [
      { name: '用户', path: '/custom/users' },
      { name: '跨模块', path: '/outside' },
    ],
  },
  {
    name: '工具',
    path: '/tools',
    children: [{ name: '列表', path: '/tools/list', query: { view: 'list' } }],
  },
];
describe('模块菜单分组', () => {
  it('名称和顺序来自模块接口，按菜单moduleId分组并保留跨模块父子层级', () => {
    const groups = groupModuleMenus(visible, source, modules);
    expect(groups.map((item) => [item.id, item.name])).toEqual([
      [17, '接口系统模块'],
      [31, '接口业务模块'],
    ]);
    expect(groups[0]?.menus[0]?.children?.map((item) => item.path)).toEqual([
      '/custom/users',
    ]);
    expect(groups[1]?.menus[0]?.children?.map((item) => item.path)).toEqual([
      '/outside',
    ]);
    expect(groups[1]?.menus[1]?.children?.[0]?.query).toEqual({ view: 'list' });
    expect(visible[0]?.children).toHaveLength(2);
    expect(findMenuModule(groups, '/tools/list/')?.id).toBe(31);
  });
  it('只展示授权可见菜单，不从原始菜单或模块列表补出无权访问的入口', () => {
    const groups = groupModuleMenus(
      [
        { name: '用户', path: '/custom/users' },
        { name: '隐藏', path: '/outside', show: false },
      ],
      source,
      modules,
    );
    expect(groups.map((item) => item.id)).toEqual([17]);
    expect(groups[0]?.menus).toHaveLength(1);
  });
  it('模块元数据暂不可读时按接口moduleId分组，明确未分配的子菜单不继承父模块', () => {
    const data = [
      menu(1, '/root', 31, [
        menu(2, 'unassigned', null),
        menu(3, 'assigned', 31),
      ]),
    ];
    const menus = [
      {
        name: '根',
        path: '/root',
        children: [
          { name: '无模块', path: '/root/unassigned' },
          { name: '有模块', path: '/root/assigned' },
        ],
      },
    ];
    const groups = groupModuleMenus(menus, data, []);
    expect(groups.map((item) => item.name)).toEqual([
      '未分配模块',
      '模块 ID: 31',
    ]);
    expect(groups[0]?.menus[0]?.children?.map((item) => item.path)).toEqual([
      '/root/unassigned',
    ]);
  });
  it('禁用模块不显示，没有可见菜单的模块也不显示', () => {
    const groups = groupModuleMenus(
      visible,
      source,
      modules.map((item) => ({ ...item, enabled: item.id !== 31 })),
    );
    expect(groups.map((item) => item.id)).toEqual([17]);
  });
});
