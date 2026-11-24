export interface MenuTreeRow {
  [key: string]: any;
  children?: MenuTreeRow[];
  id: number;
}

/** 兼容接口树形及 parentId 平铺数据，空 children 不产生展开按钮。 */
export function buildMenuTree(items: MenuTreeRow[]): MenuTreeRow[] {
  const nodes = new Map<number, MenuTreeRow>();
  function visit(rows: MenuTreeRow[], parentId: null | number = null) {
    for (const row of rows) {
      if (nodes.has(row.id)) continue;
      const { children, ...data } = row;
      nodes.set(row.id, { ...data, parentId: row.parentId ?? parentId });
      visit(children ?? [], row.id);
    }
  }
  visit(items);
  const roots: MenuTreeRow[] = [];
  for (const node of nodes.values()) {
    const parent = nodes.get(node.parentId);
    const ancestors = new Set([node.id]);
    let current = parent;
    let cycle = false;
    while (current) {
      if (ancestors.has(current.id)) {
        cycle = true;
        break;
      }
      ancestors.add(current.id);
      current = nodes.get(current.parentId);
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
        ['name', 'path', 'permissionCode'].some((key) =>
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

export function menuBranchIds(rows: MenuTreeRow[]): number[] {
  return rows.flatMap((row) =>
    row.children?.length ? [row.id, ...menuBranchIds(row.children)] : [],
  );
}
