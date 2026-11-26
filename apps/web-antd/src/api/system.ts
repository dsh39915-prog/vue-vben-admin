import { requestClient } from '#/api/request';

export interface SystemPage<T> {
  page: number;
  pageSize: number;
  records: T[];
  total: number;
}
export interface SystemUserInput {
  avatarUrl?: string;
  departmentId?: null | number;
  mobile: string;
  nameInitials?: string;
  namePinyin?: string;
  nickname: string;
  platform?: number;
  realName: string;
  username: string;
}
export interface SystemUser extends SystemUserInput {
  createdAt: string;
  enabled: boolean;
  failedLoginAttempts: number;
  firstLogin: boolean;
  id: number;
  lastLoginAt: null | string;
  lastLoginIp: null | string;
  lockedUntil: null | string;
  passwordConfigured: boolean;
  passwordResetRequired: boolean;
  roleIds: number[];
  updatedAt: string;
}
export interface SystemRoleInput {
  code: string;
  enabled: boolean;
  name: string;
  remark: string;
  sortOrder: number;
}
export interface SystemRole extends SystemRoleInput {
  createdAt: string;
  id: number;
  updatedAt: string;
  userCount: number;
}
export interface SystemModule extends SystemRoleInput {
  createdAt?: string;
  id: number;
  updatedAt?: string;
}
export interface SystemDepartment extends SystemModule {
  children?: SystemDepartment[];
  parentId: null | number;
}
export interface SystemMenuInput {
  enabled: boolean;
  hidden: boolean;
  icon: string;
  menuType: number;
  moduleId: null | number;
  name: string;
  parentId: null | number;
  path: string;
  permissionCode: string;
  remark: string;
  sortOrder: number;
}
export interface SystemMenu extends SystemMenuInput {
  children?: SystemMenu[];
  createdAt?: string;
  id: number;
  updatedAt?: string;
}
export interface SystemPermissionInput extends Omit<
  SystemMenuInput,
  'menuType' | 'permissionCode'
> {
  code: string;
  menuId: null | number;
  permissionType: number;
}
export interface SystemPermission extends SystemPermissionInput {
  createdAt?: string;
  id: number;
  updatedAt?: string;
}
export interface SystemMenuTreeNode {
  children?: SystemMenuTreeNode[];
  createdAt?: string;
  enabled: boolean;
  hidden: boolean;
  icon: null | string;
  id: number;
  key: string;
  menuId: null | number;
  moduleId: null | number;
  name: string;
  nodeType: 'MENU' | 'PERMISSION';
  parentId: null | number;
  parentKey: null | string;
  path: null | string;
  permissionCode: null | string;
  remark: null | string;
  sortOrder: number;
  type: number;
  updatedAt?: string;
}
export interface SystemGrants {
  menuIds: number[];
  moduleIds: number[];
  permissionIds: number[];
}
export interface SystemAccess {
  moduleIds: number[];
  permissionCodes: string[];
  roleCodes: string[];
  superAdmin: boolean;
}
export type SystemResource =
  | 'departments'
  | 'menus'
  | 'modules'
  | 'permissions'
  | 'roles'
  | 'users';
export interface SystemResourceMap {
  departments: SystemDepartment;
  menus: SystemMenu;
  modules: SystemModule;
  permissions: SystemPermission;
  roles: SystemRole;
  users: SystemUser;
}
export function getSystemMenuTreeApi() {
  return requestClient.get<SystemMenuTreeNode[]>('/system/menus/tree');
}
export function getSystemResourceListApi<K extends SystemResource>(
  resource: K,
  params: Record<string, unknown> = {},
) {
  return requestClient.get<
    SystemPage<SystemResourceMap[K]> | SystemResourceMap[K][]
  >(`/system/${resource}`, { params });
}
export function getSystemResourceDetailsApi<K extends SystemResource>(
  resource: K,
  id: number,
) {
  return requestClient.get<SystemResourceMap[K]>(`/system/${resource}/${id}`);
}
export function createSystemResourceApi(
  resource: SystemResource,
  data: object,
) {
  return requestClient.post<{ id: number }>(`/system/${resource}`, data);
}
export function updateSystemResourceApi(
  resource: SystemResource,
  id: number,
  data: object,
) {
  return requestClient.put<{ id: number }>(`/system/${resource}/${id}`, data);
}
export function deleteSystemResourceApi(resource: SystemResource, id: number) {
  return requestClient.delete<null>(`/system/${resource}/${id}`);
}
export function updateSystemStatusApi(
  resource: 'roles' | 'users',
  id: number,
  enabled: boolean,
) {
  return requestClient.request<null>(`/system/${resource}/${id}/status`, {
    method: 'PATCH',
    data: { enabled },
  });
}
export function assignSystemUserRolesApi(id: number, roleIds: number[]) {
  return requestClient.put<null>(`/system/users/${id}/roles`, { roleIds });
}
export function resetSystemUserPasswordApi(id: number, newPassword: string) {
  return requestClient.put<null>(`/system/users/${id}/password`, {
    newPassword,
  });
}
export function getSystemRoleGrantsApi(id: number) {
  return requestClient.get<SystemGrants>(`/system/roles/${id}/grants`);
}
export function updateSystemRoleGrantsApi(id: number, data: SystemGrants) {
  return requestClient.put<null>(`/system/roles/${id}/grants`, data);
}
/** 拉取完整选项，角色列表的单页上限为 100。 */
export async function getSystemRoleOptionsApi() {
  const result: SystemRole[] = [];
  let page = 1;
  while (true) {
    const data = await requestClient.get<SystemPage<SystemRole>>(
      '/system/roles',
      { params: { page, pageSize: 100 } },
    );
    result.push(...data.records);
    if (result.length >= data.total || data.records.length === 0) return result;
    page += 1;
  }
}
