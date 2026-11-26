import { describe, expect, it } from 'vitest';

import {
  buildMenuTree,
  filterMenuTree,
  menuBranchIds,
  menuRowKey,
} from './menu-tree';

describe('菜单树', () => {
  it('菜单与权限同id时按接口key保留，组合层级只依据parentKey，保留来源parentId', () => {
    const input = [
      {
        id: 1,
        key: 'menu:1',
        parentKey: null,
        parentId: null,
        nodeType: 'MENU' as const,
        children: [
          {
            id: 2,
            key: 'menu:2',
            parentKey: 'menu:1',
            parentId: 1,
            nodeType: 'MENU' as const,
            children: [
              {
                id: 1,
                key: 'permission:1',
                parentKey: 'menu:2',
                parentId: null,
                menuId: 2,
                nodeType: 'PERMISSION' as const,
                children: [
                  {
                    id: 2,
                    key: 'permission:2',
                    parentKey: 'permission:1',
                    parentId: 1,
                    menuId: 2,
                    nodeType: 'PERMISSION' as const,
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
    const tree = buildMenuTree(input);
    const permission = tree[0]?.children?.[0]?.children?.[0];
    expect(tree.map((row) => menuRowKey(row))).toEqual(['menu:1']);
    expect(permission?.key).toBe('permission:1');
    expect(permission?.parentId).toBeNull();
    expect(permission?.children?.[0]?.key).toBe('permission:2');
    expect(permission?.children?.[0]?.children).toBeUndefined();
    expect(menuBranchIds(tree)).toEqual(['menu:1', 'menu:2', 'permission:1']);
    expect(input[0]?.children[0]?.children[0]?.children[0]?.children).toEqual(
      [],
    );
  });
  it('组合节点平铺时仍按parentKey组装，同id菜单和权限不会误归属或互相覆盖', () => {
    const tree = buildMenuTree([
      {
        id: 2,
        key: 'permission:2',
        parentKey: 'permission:1',
        parentId: 1,
        nodeType: 'PERMISSION',
      },
      {
        id: 1,
        key: 'menu:1',
        parentKey: null,
        parentId: null,
        nodeType: 'MENU',
      },
      {
        id: 1,
        key: 'permission:1',
        parentKey: 'menu:1',
        parentId: null,
        nodeType: 'PERMISSION',
      },
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.children?.[0]?.key).toBe('permission:1');
    expect(tree[0]?.children?.[0]?.children?.[0]?.key).toBe('permission:2');
  });
  it('保留接口层级并按同级排序，叶节点不带空 children，也不修改原始数据', () => {
    const input = [
      {
        id: 1,
        name: '目录',
        children: [
          { id: 3, sortOrder: 2, children: [] },
          { id: 2, sortOrder: 1 },
        ],
      },
    ];
    const tree = buildMenuTree(input);
    expect(tree[0]?.children?.map((row) => row.id)).toEqual([2, 3]);
    expect(tree[0]?.children?.[0]?.parentId).toBe(1);
    expect(tree[0]?.children?.[1]?.children).toBeUndefined();
    expect(input[0]?.children?.map((row) => row.id)).toEqual([3, 2]);
    expect(menuBranchIds(tree)).toEqual([1]);
  });
  it('兼容平铺 parentId 数据，找不到父节点的菜单保留在根层', () => {
    const tree = buildMenuTree([
      { id: 2, parentId: 1 },
      { id: 1, parentId: null },
      { id: 3, parentId: 99 },
    ]);
    expect(tree.map((row) => row.id)).toEqual([1, 3]);
    expect(tree[0]?.children?.[0]?.id).toBe(2);
  });
  it('子节点命中模块和关键字时保留跨模块祖先，匹配目录时保留其子树', () => {
    const tree = buildMenuTree([
      {
        id: 1,
        moduleId: 1,
        name: '应用目录',
        children: [
          {
            id: 2,
            moduleId: 2,
            name: '列表',
            permissionCode: 'api:list:read',
            children: [{ id: 3, moduleId: 2, name: '新增' }],
          },
          { id: 4, moduleId: 1, name: '其他' },
        ],
      },
    ]);
    const result = filterMenuTree(tree, 'API:LIST', 2);
    expect(result[0]?.id).toBe(1);
    expect(result[0]?.children?.map((row) => row.id)).toEqual([2]);
    expect(result[0]?.children?.[0]?.children?.[0]?.id).toBe(3);
    expect(filterMenuTree(tree, '不存在', 0)).toEqual([]);
    expect(filterMenuTree(tree, '应用目录', 0)).toEqual(tree);
  });
});
