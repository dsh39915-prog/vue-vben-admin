export interface SystemTreeItem {
  id: number;
  name: string;
  parentId?: number;
  sort?: number;
}
export type SystemTreeNode<T> = T & {
  key: number;
  children?: SystemTreeNode<T>[];
};

export function buildSystemTree<T extends SystemTreeItem>(
  items: T[],
): SystemTreeNode<T>[] {
  const nodes = new Map<number, SystemTreeNode<T>>();
  for (const item of items) {
    if (!Number.isSafeInteger(item.id) || item.id <= 0 || nodes.has(item.id))
      throw new Error('树形数据编号无效，请重新加载');
    nodes.set(item.id, { ...item, key: item.id });
  }
  const roots: SystemTreeNode<T>[] = [];
  for (const item of items) {
    const seen = new Set([item.id]);
    let parentId = item.parentId;
    while (parentId && nodes.has(parentId)) {
      if (seen.has(parentId))
        throw new Error('树形数据存在循环层级，请检查上级关系');
      seen.add(parentId);
      parentId = nodes.get(parentId)?.parentId;
    }
    const node = nodes.get(item.id)!;
    const parent = item.parentId ? nodes.get(item.parentId) : undefined;
    if (parent) (parent.children ??= []).push(node);
    else roots.push(node);
  }
  function sort(nodes: SystemTreeNode<T>[]) {
    nodes.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id);
    nodes.forEach((node) => {
      if (node.children) sort(node.children);
    });
  }
  sort(roots);
  return roots;
}
export function validateSystemIds(data: unknown): asserts data is number[] {
  if (
    !Array.isArray(data) ||
    data.some((id) => !Number.isSafeInteger(id) || id <= 0)
  )
    throw new Error('授权编号格式不正确，请重新加载');
}
