import type { AdminRow } from './resource-types';

export type MenuTreeRow = AdminRow;

export function menuRowKey(row: MenuTreeRow): number | string {
  return row.key ?? row.id;
}

/** 组合树以接口 key/parentKey 为准；兼容旧菜单数据，叶节点不产生展开按钮。 */
export function buildMenuTree(items: MenuTreeRow[]): MenuTreeRow[] {
  const nodes = new Map<number | string, MenuTreeRow>();
  function visit(
    rows: MenuTreeRow[],
    parentKey: null | number | string = null,
  ) {
    for (const row of rows) {
      const key = menuRowKey(row);
      if (nodes.has(key)) continue;
      const { children, ...data } = row;
      nodes.set(key, {
        ...data,
        parentId: row.nodeType
          ? row.parentId
          : (row.parentId ??
            (typeof parentKey === 'number' ? parentKey : null)),
        parentKey:
          row.parentKey === undefined
            ? (parentKey ?? row.parentId ?? null)
            : row.parentKey,
      });
      visit(children ?? [], key);
    }
  }
  visit(items);
  const roots: MenuTreeRow[] = [];
  for (const node of nodes.values()) {
    const parent = nodes.get(node.parentKey ?? '');
    const ancestors = new Set([menuRowKey(node)]);
    let current = parent;
    let cycle = false;
    while (current) {
      if (ancestors.has(menuRowKey(current))) {
        cycle = true;
        break;
      }
      ancestors.add(menuRowKey(current));
      current = nodes.get(current.parentKey ?? '');
    }
    if (parent && !cycle) (parent.children ??= []).push(node);
    else roots.push(node);
  }
  function sort(rows: MenuTreeRow[]): MenuTreeRow[] {
    return rows
      .toSorted((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((row) => {
        if (row.children) row.children = sort(row.children);
        return row;
      });
  }
  return sort(roots);
}

/** 子节点命中时保留祖先；父节点命中关键字时显示该模块下的整个子树。 */
export function filterMenuTree(
  rows: MenuTreeRow[],
  keyword: string,
  moduleId: number,
): MenuTreeRow[] {
  const query = keyword.toLowerCase();
  function filter(
    items: MenuTreeRow[],
    ancestorMatches = false,
  ): MenuTreeRow[] {
    return items.flatMap((row) => {
      const matches =
        ancestorMatches ||
        (['name', 'path', 'permissionCode'] as const).some((key) =>
          String(row[key] ?? '')
            .toLowerCase()
            .includes(query),
        );
      const inModule =
        moduleId === 0 ||
        (moduleId === -1
          ? row.moduleId === null || row.moduleId === undefined
          : row.moduleId === moduleId);
      const children = filter(row.children ?? [], matches);
      if (!(matches && inModule) && children.length === 0) return [];
      const { children: _children, ...data } = row;
      return [{ ...data, ...(children.length > 0 ? { children } : {}) }];
    });
  }
  return filter(rows);
}

export function menuBranchIds(rows: MenuTreeRow[]): (number | string)[] {
  return rows.flatMap((row) =>
    row.children?.length
      ? [menuRowKey(row), ...menuBranchIds(row.children)]
      : [],
  );
}
