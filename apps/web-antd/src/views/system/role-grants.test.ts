import type { SystemGrants, SystemMenuTreeNode } from '#/api';

import { describe, expect, it } from 'vitest';

import {
  grantBranchKeys,
  grantCheckState,
  grantModuleTree,
  toggleGrantNode,
} from './role-grants';

function node(
  id: number,
  nodeType: SystemMenuTreeNode['nodeType'],
  values: Partial<SystemMenuTreeNode> = {},
): SystemMenuTreeNode {
  return {
    id,
    nodeType,
    key: `${nodeType.toLowerCase()}:${id}`,
    parentKey: null,
    parentId: null,
    menuId: null,
    moduleId: 1,
    name: `节点${id}`,
    type: nodeType === 'MENU' ? 2 : 3,
    path: null,
    icon: null,
    permissionCode: null,
    hidden: false,
    enabled: true,
    sortOrder: 0,
    remark: null,
    ...values,
  };
}
const rows = [
  node(1, 'MENU', {
    children: [
      node(2, 'MENU', {
        parentKey: 'menu:1',
        children: [
          node(1, 'PERMISSION', { parentKey: 'menu:2', menuId: 2 }),
          node(2, 'PERMISSION', { parentKey: 'menu:2', menuId: 2 }),
        ],
      }),
    ],
  }),
  node(3, 'MENU', {
    moduleId: 2,
    children: [
      node(3, 'PERMISSION', { moduleId: 2, menuId: 3, parentKey: 'menu:3' }),
    ],
  }),
];
const empty: SystemGrants = { menuIds: [], permissionIds: [], moduleIds: [] };

describe('角色授权树状态', () => {
  it('父菜单已授权不会在回显时授予所有子权限，部分授权显示半选', () => {
    const grants = { menuIds: [1, 2], permissionIds: [1], moduleIds: [1] };
    const before = structuredClone(grants);
    const tree = grantModuleTree(rows, 1);
    expect(grantCheckState(tree, grants)).toEqual({
      checked: ['permission:1'],
      halfChecked: ['menu:2', 'menu:1'],
    });
    expect(grants).toEqual(before);
    expect(grantBranchKeys(tree)).toEqual(['menu:1', 'menu:2']);
  });
  it('用户勾选父节点时联动下级，菜单与权限同id时分别保存，模块访问不被隐式改变', () => {
    const result = toggleGrantNode(
      grantModuleTree(rows, 1),
      empty,
      'menu:2',
      true,
    );
    expect(result.menuIds.toSorted()).toEqual([1, 2]);
    expect(result.permissionIds).toEqual([1, 2]);
    expect(result.moduleIds).toEqual([]);
    expect(
      grantCheckState(grantModuleTree(rows, 1), result).halfChecked,
    ).toEqual([]);
    expect(empty).toEqual({ menuIds: [], permissionIds: [], moduleIds: [] });
  });
  it('勾选单个操作带入祖先，不额外选中同级操作', () => {
    const result = toggleGrantNode(
      grantModuleTree(rows, 1),
      empty,
      'permission:1',
      true,
    );
    expect(result.menuIds.toSorted()).toEqual([1, 2]);
    expect(result.permissionIds).toEqual([1]);
  });
  it('清空当前分支保留其他模块和未展示的授权，原始授权不被修改', () => {
    const grants = {
      menuIds: [1, 2, 3, 99],
      permissionIds: [1, 2, 3, 99],
      moduleIds: [1, 2, 99],
    };
    const result = toggleGrantNode(
      grantModuleTree(rows, 1),
      grants,
      'menu:1',
      false,
    );
    expect(result).toEqual({
      menuIds: [3, 99],
      permissionIds: [3, 99],
      moduleIds: [1, 2, 99],
    });
    expect(grants.menuIds).toEqual([1, 2, 3, 99]);
  });
  it('跨模块祖先只作层级提示，当前模块操作不改变其他模块节点', () => {
    const input = [
      node(1, 'MENU', {
        children: [node(2, 'MENU', { moduleId: 2, parentKey: 'menu:1' })],
      }),
    ];
    const tree = grantModuleTree(input, 2);
    expect(tree[0]?.disableCheckbox).toBe(true);
    expect(toggleGrantNode(tree, empty, 'menu:1', true)).toBe(empty);
    expect(toggleGrantNode(tree, empty, 'menu:2', true).menuIds).toEqual([2]);
  });
  it('未分配模块可查看与勾选，不会选中其他模块节点', () => {
    const input = [...rows, node(4, 'MENU', { moduleId: null })];
    const tree = grantModuleTree(input, -1);
    expect(tree.map((row) => row.key)).toEqual(['menu:4']);
    expect(toggleGrantNode(tree, empty, 'menu:4', true)).toEqual({
      menuIds: [4],
      permissionIds: [],
      moduleIds: [],
    });
  });
});
