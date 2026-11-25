import type { MenuRecordRaw } from '@vben/types';

import type { SystemMenu, SystemModule } from '#/api';

export interface ModuleMenuGroup {
  id: null | number;
  menus: MenuRecordRaw[];
  name: string;
  order: number;
}

function normalizePath(path: string) {
  return path.replaceAll(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
}

/** 仅对已授权菜单分组；组件路径、归属和模块信息都来自接口。 */
export function groupModuleMenus(
  menus: MenuRecordRaw[],
  source: SystemMenu[],
  modules: SystemModule[],
): ModuleMenuGroup[] {
  const membership = new Map<string, null | number>();
  function index(
    rows: SystemMenu[],
    parent = '',
    inherited: null | number = null,
  ) {
    for (const row of rows) {
      const path = row.path?.startsWith('/')
        ? row.path
        : `${parent}/${row.path || ''}`;
      const moduleId = row.moduleId === undefined ? inherited : row.moduleId;
      membership.set(normalizePath(path), moduleId);
      index(row.children ?? [], path, moduleId);
    }
  }
  index(source);
  const moduleInfo = new Map(modules.map((item) => [item.id, item]));
  function moduleFor(path: string, inherited: null | number) {
    const key = normalizePath(path);
    return membership.has(key) ? (membership.get(key) ?? null) : inherited;
  }
  const ids = new Set<null | number>();
  function collect(rows: MenuRecordRaw[], inherited: null | number = null) {
    for (const row of rows) {
      if (row.show === false) continue;
      const id = moduleFor(row.path, inherited);
      if (row.children?.length) collect(row.children, id);
      else ids.add(id);
    }
  }
  collect(menus);
  function filter(
    rows: MenuRecordRaw[],
    target: null | number,
    inherited: null | number = null,
  ): MenuRecordRaw[] {
    return rows.flatMap((row) => {
      if (row.show === false) return [];
      const id = moduleFor(row.path, inherited);
      if (!row.children?.length) return id === target ? [{ ...row }] : [];
      const children = filter(row.children, target, id);
      return children.length > 0 ? [{ ...row, children }] : [];
    });
  }
  return [...ids]
    .flatMap((id) => {
      const info = id === null ? undefined : moduleInfo.get(id);
      if (info?.enabled === false) return [];
      return [
        {
          id,
          name: info?.name ?? (id === null ? '未分配模块' : `模块 ID: ${id}`),
          order: info?.sortOrder ?? Number.MAX_SAFE_INTEGER,
          menus: filter(menus, id),
        },
      ];
    })
    .toSorted((a, b) => a.order - b.order);
}

export function findMenuModule(
  groups: ModuleMenuGroup[],
  path: string,
): ModuleMenuGroup | undefined {
  const target = normalizePath(path);
  function contains(menus: MenuRecordRaw[]): boolean {
    return menus.some(
      (menu) =>
        normalizePath(menu.path) === target || contains(menu.children ?? []),
    );
  }
  return groups.find((group) => contains(group.menus));
}
