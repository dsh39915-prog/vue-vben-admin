import type { SystemGrants, SystemMenuTreeNode } from '#/api';

export interface GrantTreeNode {
  children?: GrantTreeNode[];
  disableCheckbox: boolean;
  id: number;
  key: string;
  nodeType: SystemMenuTreeNode['nodeType'];
  title: string;
}

/** 只操作当前模块，跨模块的祖先作为层级提示保留。 */
export function grantModuleTree(
  rows: SystemMenuTreeNode[],
  moduleId: number,
): GrantTreeNode[] {
  return rows.flatMap((row) => {
    const inModule =
      moduleId === -1 ? row.moduleId === null : row.moduleId === moduleId;
    const children = grantModuleTree(row.children ?? [], moduleId);
    if (!inModule && children.length === 0) return [];
    return [
      {
        key: row.key,
        id: row.id,
        nodeType: row.nodeType,
        title: row.name,
        disableCheckbox: !inModule,
        ...(children.length > 0 ? { children } : {}),
      },
    ];
  });
}

export function grantCheckState(rows: GrantTreeNode[], grants: SystemGrants) {
  const menus = new Set(grants.menuIds);
  const permissions = new Set(grants.permissionIds);
  const checked: string[] = [];
  const halfChecked: string[] = [];
  function visit(row: GrantTreeNode): { selected: number; total: number } {
    let total = row.disableCheckbox ? 0 : 1;
    let selected =
      !row.disableCheckbox &&
      (row.nodeType === 'MENU' ? menus : permissions).has(row.id)
        ? 1
        : 0;
    for (const child of row.children ?? []) {
      const counts = visit(child);
      total += counts.total;
      selected += counts.selected;
    }
    if (selected > 0) {
      if (selected === total) checked.push(row.key);
      else halfChecked.push(row.key);
    }
    return { total, selected };
  }
  for (const row of rows) visit(row);
  return { checked, halfChecked };
}

/** 仅在用户勾选时联动，回显父菜单不会隐式授予全部子权限。 */
export function toggleGrantNode(
  rows: GrantTreeNode[],
  grants: SystemGrants,
  key: string,
  checked: boolean,
): SystemGrants {
  function findPath(
    items: GrantTreeNode[],
    parents: GrantTreeNode[] = [],
  ): GrantTreeNode[] | undefined {
    for (const row of items) {
      const path = [...parents, row];
      if (row.key === key) return path;
      const nested = findPath(row.children ?? [], path);
      if (nested) return nested;
    }
  }
  const path = findPath(rows);
  const target = path?.at(-1);
  if (!target || target.disableCheckbox) return grants;
  const menus = new Set(grants.menuIds);
  const permissions = new Set(grants.permissionIds);
  function update(row: GrantTreeNode) {
    if (row.disableCheckbox) return;
    const ids = row.nodeType === 'MENU' ? menus : permissions;
    if (checked) ids.add(row.id);
    else ids.delete(row.id);
  }
  function visit(row: GrantTreeNode) {
    update(row);
    for (const child of row.children ?? []) visit(child);
  }
  visit(target);
  if (checked) for (const row of path ?? []) update(row);
  return {
    menuIds: [...menus],
    permissionIds: [...permissions],
    moduleIds: [...grants.moduleIds],
  };
}

export function grantBranchKeys(rows: GrantTreeNode[]): string[] {
  return rows.flatMap((row) =>
    row.children?.length ? [row.key, ...grantBranchKeys(row.children)] : [],
  );
}
