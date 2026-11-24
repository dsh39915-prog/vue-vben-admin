import type { SystemResource } from '#/api';

export interface ResourceField {
  createOnly?: boolean;
  editOnly?: boolean;
  key: string;
  label: string;
  max?: number;
  min?: number;
  options?: { label: string; value: number | string }[];
  pattern?: RegExp;
  relation?: SystemResource;
  required?: boolean;
  type:
    | 'boolean'
    | 'multi'
    | 'number'
    | 'password'
    | 'select'
    | 'text'
    | 'textarea';
}
export const typeOptions = [
  { label: '目录', value: 1 },
  { label: '菜单', value: 2 },
  { label: '按钮/操作', value: 3 },
];
export const platformOptions = [
  { label: 'iOS', value: 1 },
  { label: 'Android', value: 2 },
  { label: 'Windows', value: 3 },
];
export const passwordRules = [
  { required: true, message: '请输入密码' },
  { min: 12, max: 72, message: '密码长度为 12 至 72 个字符' },
  {
    validator: async (_rule: unknown, value: string) => {
      if (value && new TextEncoder().encode(value).length > 72)
        throw new Error('密码 UTF-8 长度不能超过 72 字节');
    },
  },
];
const namedFields: ResourceField[] = [
  { key: 'name', label: '名称', type: 'text', required: true, max: 64 },
  {
    key: 'code',
    label: '编码',
    type: 'text',
    required: true,
    pattern: /^[a-zA-Z0-9_-]{2,64}$/,
  },
  { key: 'enabled', label: '启用', type: 'boolean', required: true },
  { key: 'sortOrder', label: '排序号', type: 'number', min: 0, required: true },
  { key: 'remark', label: '备注', type: 'textarea', max: 500 },
];
export function getResourceFields(resource: SystemResource): ResourceField[] {
  if (resource === 'users')
    return [
      {
        key: 'username',
        label: '登录名',
        type: 'text',
        required: true,
        pattern: /^[a-zA-Z0-9_.@-]{3,64}$/,
      },
      {
        key: 'password',
        label: '初始密码',
        type: 'password',
        required: true,
        createOnly: true,
      },
      {
        key: 'realName',
        label: '真实姓名',
        type: 'text',
        required: true,
        max: 64,
      },
      { key: 'nickname', label: '昵称', type: 'text', max: 64 },
      {
        key: 'mobile',
        label: '联系电话',
        type: 'text',
        pattern: /^$|[+]?[0-9]{6,20}$/,
      },
      {
        key: 'departmentId',
        label: '所属部门',
        type: 'select',
        relation: 'departments',
      },
      {
        key: 'roleIds',
        label: '角色',
        type: 'multi',
        relation: 'roles',
        createOnly: true,
      },
      {
        key: 'avatarUrl',
        label: '头像地址',
        type: 'text',
        max: 512,
        editOnly: true,
      },
      {
        key: 'platform',
        label: '平台',
        type: 'select',
        options: platformOptions,
        editOnly: true,
      },
      {
        key: 'namePinyin',
        label: '姓名拼音',
        type: 'text',
        max: 255,
        editOnly: true,
      },
      {
        key: 'nameInitials',
        label: '姓名首字母',
        type: 'text',
        max: 64,
        editOnly: true,
      },
    ];
  if (resource === 'roles')
    return namedFields.map((field) =>
      field.key === 'code'
        ? { ...field, pattern: /^[a-z][a-z0-9_]{1,63}$/ }
        : field,
    );
  if (resource === 'modules') return namedFields;
  if (resource === 'departments')
    return [
      ...namedFields.slice(0, 2),
      {
        key: 'parentId',
        label: '上级部门',
        type: 'select',
        relation: 'departments',
      },
      ...namedFields.slice(2),
    ];
  return [
    { key: 'name', label: '名称', type: 'text', required: true, max: 64 },
    {
      key: 'parentId',
      label: resource === 'menus' ? '上级菜单' : '上级权限',
      type: 'select',
      relation: resource,
    },
    { key: 'moduleId', label: '所属模块', type: 'select', relation: 'modules' },
    ...(resource === 'permissions'
      ? ([
          {
            key: 'menuId',
            label: '关联菜单',
            type: 'select',
            relation: 'menus',
          },
          {
            key: 'code',
            label: '权限标识',
            type: 'text',
            required: true,
            pattern: /^[a-zA-Z0-9:_-]{3,128}$/,
          },
        ] as ResourceField[])
      : ([
          {
            key: 'permissionCode',
            label: '关联权限标识',
            type: 'text',
            max: 128,
          },
        ] as ResourceField[])),
    {
      key: resource === 'menus' ? 'menuType' : 'permissionType',
      label: '类型',
      type: 'select',
      options: typeOptions,
      required: true,
    },
    { key: 'path', label: '路由地址', type: 'text', max: 255 },
    { key: 'icon', label: '图标', type: 'text', max: 128 },
    { key: 'hidden', label: '隐藏', type: 'boolean', required: true },
    ...namedFields.slice(2),
  ];
}
