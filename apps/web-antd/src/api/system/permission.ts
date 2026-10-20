import { requestClient } from '#/api/request';

export const getRoleMenuIdsApi = (roleId: number) =>
  requestClient.get<number[]>('/system/permission/list-role-menus', {
    params: { roleId },
  });
export const assignRoleMenusApi = (roleId: number, menuIds: number[]) =>
  requestClient.post<boolean>('/system/permission/assign-role-menu', {
    roleId,
    menuIds,
  });
export const getUserRoleIdsApi = (userId: number) =>
  requestClient.get<number[]>('/system/permission/list-user-roles', {
    params: { userId },
  });
export const assignUserRolesApi = (userId: number, roleIds: number[]) =>
  requestClient.post<boolean>('/system/permission/assign-user-role', {
    userId,
    roleIds,
  });

export type RoleDataScope = 1 | 2 | 3 | 4 | 5;
export interface RoleDataScopeParams {
  roleId: number;
  dataScope: RoleDataScope;
  dataScopeDeptIds: number[];
}
export const assignRoleDataScopeApi = (data: RoleDataScopeParams) =>
  requestClient.post<boolean>(
    '/system/permission/assign-role-data-scope',
    data,
  );
