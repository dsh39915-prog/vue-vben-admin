import type { SystemMenuTreeNode, SystemResourceMap } from '#/api';

type ResourceRecord =
  | SystemMenuTreeNode
  | SystemResourceMap[keyof SystemResourceMap];
type UnionKeys<T> = T extends unknown ? keyof T : never;
type FieldValue<T, K> = T extends unknown
  ? K extends keyof T
    ? T[K]
    : never
  : never;

/** 通用列表只访问接口定义的字段，保留菜单与权限节点各自的 ID。 */
export type AdminRow = {
  [K in Exclude<
    UnionKeys<ResourceRecord>,
    'children' | 'parentKey'
  >]?: FieldValue<ResourceRecord, K>;
} & { children?: AdminRow[]; id: number; parentKey?: null | number | string };

export type EditorMode =
  | 'add'
  | 'detail'
  | 'edit'
  | 'grants'
  | 'password'
  | 'roles';
export type ResourceValue =
  | (number | string)[]
  | boolean
  | null
  | number
  | string
  | undefined;
export interface ResourceForm extends Record<string, ResourceValue> {
  menuIds: number[];
  moduleIds: number[];
  newPassword: string;
  permissionIds: number[];
  roleIds: number[];
}

export function flattenResources(items: AdminRow[]): AdminRow[] {
  return items.flatMap(({ children, ...item }) => [
    item,
    ...flattenResources(children ?? []),
  ]);
}
