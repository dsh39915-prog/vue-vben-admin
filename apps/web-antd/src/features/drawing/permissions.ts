import type { MenuRecord } from '#/api';

import {
  assignRoleMenusApi,
  createMenuApi,
  getMenuListApi,
  getRoleMenuIdsApi,
} from '#/api';

import {
  drawingManagePermission,
  drawingNodes,
  drawingPermission,
} from './nodes';

export const drawingDutyOptions = [
  ...drawingNodes.map((node) => ({
    label: node.title,
    value: drawingPermission(node.key),
  })),
  {
    label: '流程管理（全部环节和所有员工任务）',
    value: drawingManagePermission,
  },
];
const managedCodes = new Set(drawingDutyOptions.map((item) => item.value));
export function roleDrawingDuties(menus: MenuRecord[], menuIds: number[]) {
  const ids = new Set(menuIds);
  return menus
    .filter(
      (menu) =>
        menu.id && ids.has(menu.id) && managedCodes.has(menu.permission ?? ''),
    )
    .map((menu) => menu.permission!);
}
export async function saveRoleDrawingDuties(
  roleId: number,
  selected: string[],
  canCreate: boolean,
) {
  if (selected.some((code) => !managedCodes.has(code)))
    throw new Error('职责选项无效，请重新加载');
  // Read again before saving so unrelated role menu grants are retained.
  const [menus, currentIds] = await Promise.all([
    getMenuListApi(),
    getRoleMenuIdsApi(roleId),
  ]);
  if (!Array.isArray(menus) || !Array.isArray(currentIds))
    throw new Error('角色权限数据无效，请重新加载');
  const missing = selected.filter(
    (code) => !menus.some((menu) => menu.permission === code),
  );
  if (missing.length && !canCreate)
    throw new Error('部分职责尚未配置，请联系有菜单管理权限的管理员');
  let parentId = menus.find(
    (menu) =>
      menu.type === 1 && ['/drawing', 'drawing'].includes(menu.path ?? ''),
  )?.id;
  const validId = (id: number) => {
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new Error('权限创建未返回有效编号，请重新加载后重试');
    return id;
  };
  if (missing.length && !parentId) {
    parentId = validId(
      await createMenuApi({
        name: '制图流程',
        parentId: 0,
        path: '/drawing',
        icon: 'lucide:workflow',
        type: 1,
        sort: 15,
        status: 0,
        visible: true,
        alwaysShow: true,
      }),
    );
  }
  for (const code of missing) {
    const option = drawingDutyOptions.find((item) => item.value === code)!;
    const item: MenuRecord = {
      name: option.label,
      parentId: parentId!,
      type: 3,
      sort: drawingDutyOptions.indexOf(option) + 1,
      permission: code,
      status: 0,
      visible: true,
    };
    const id = validId(await createMenuApi(item));
    menus.push({ ...item, id });
  }
  const managedIds = new Set(
    menus
      .filter((menu) => managedCodes.has(menu.permission ?? ''))
      .map((menu) => menu.id!),
  );
  const selectedIds = menus
    .filter((menu) => selected.includes(menu.permission ?? ''))
    .map((menu) => menu.id!);
  if (
    menus.some(
      (menu) => selected.includes(menu.permission ?? '') && menu.status !== 0,
    )
  )
    throw new Error('所选职责已被停用，请在菜单管理中启用后重试');
  const ids = new Set(currentIds.filter((id) => !managedIds.has(id)));
  for (const id of selectedIds) ids.add(id);
  if (selectedIds.length && parentId) ids.add(parentId);
  const saved = await assignRoleMenusApi(roleId, [...ids]);
  if (saved !== true) throw new Error('职责未保存，请重试');
}
