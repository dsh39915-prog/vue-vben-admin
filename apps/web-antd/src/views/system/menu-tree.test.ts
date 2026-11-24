import { describe, expect, it } from 'vitest';

import { buildMenuTree, filterMenuTree, menuBranchIds } from './menu-tree';

describe('菜单树', () => {
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
