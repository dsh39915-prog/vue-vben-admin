<script lang="ts" setup>
import type {
  DeptRecord,
  MenuRecord,
  PostRecord,
  RoleRecord,
  UserRecord,
} from '#/api';

import { computed, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { downloadFileFromBlob } from '@vben/utils';

import {
  Alert,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Descriptions,
  DescriptionsItem,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  createDeptApi,
  createMenuApi,
  createPostApi,
  createRoleApi,
  createUserApi,
  deleteDeptApi,
  deleteDeptListApi,
  deleteMenuApi,
  deletePostApi,
  deleteRoleApi,
  deleteRoleListApi,
  deleteUserApi,
  deleteUserListApi,
  exportLoginLogApi,
  exportRoleApi,
  exportUserApi,
  getDeptApi,
  getDeptListApi,
  getLoginLogApi,
  getLoginLogPageApi,
  getMenuApi,
  getMenuListApi,
  getOperateLogApi,
  getOperateLogPageApi,
  getPostApi,
  getPostPageApi,
  getRoleApi,
  getRolePageApi,
  getSimpleDeptListApi,
  getSimpleMenuListApi,
  getSimplePostListApi,
  getSimpleRoleListApi,
  getSimpleUserApi,
  getSimpleUserListApi,
  getUserApi,
  getUserImportTemplateApi,
  getUserListApi,
  getUserPageApi,
  importUserApi,
  resetUserPasswordApi,
  searchSimpleUsersApi,
  updateDeptApi,
  updateMenuApi,
  updatePostApi,
  updateRoleApi,
  updateUserApi,
  updateUserStatusApi,
} from '#/api';
import { useSystemAccess } from '#/features/system/access';
import { buildSystemTree } from '#/features/system/tree';

import PermissionEditor from './permission-editor.vue';

type ModuleKey =
  | 'SystemDept'
  | 'SystemLoginLog'
  | 'SystemMenu'
  | 'SystemOperateLog'
  | 'SystemPost'
  | 'SystemRole'
  | 'SystemUser';

interface ViewRow {
  parentId?: number;
  sort?: number;
  code: string;
  id: number;
  name: string;
  remark: string;
  status: number;
  updatedAt: string;
}

interface FormField {
  createOnly?: boolean;
  label: string;
  multiple?: boolean;
  name: string;
  options?: Array<{ label: string; value: number | string }>;
  required?: boolean;
  type?: 'boolean' | 'number' | 'password' | 'select' | 'textarea';
}

const route = useRoute();
const has = useSystemAccess();
const authorization = ref<{
  kind: 'data' | 'menus' | 'roles';
  targetId: number;
  targetName: string;
}>();
function authorize(kind: 'data' | 'menus' | 'roles', id: number, name: string) {
  const code =
    'system:permission:' +
    (kind === 'menus'
      ? 'assign-role-menu'
      : kind === 'roles'
        ? 'assign-user-role'
        : 'assign-role-data-scope');
  if (has(code)) authorization.value = { kind, targetId: id, targetName: name };
}
const operationPermission = (operation: string) => {
  const modules: Partial<Record<ModuleKey, string>> = {
    SystemUser: 'user',
    SystemRole: 'role',
    SystemDept: 'dept',
    SystemLoginLog: 'login-log',
  };
  const module = modules[moduleKey.value];
  return !module || has('system:' + module + ':' + operation);
};
const loading = ref(false);
const saving = ref(false);
const editorOpen = ref(false);
const rows = ref<ViewRow[]>([]);
const total = ref(0);
const editingId = ref<number>();
const editor = reactive<Record<string, any>>({});
const query = reactive({
  keyword: '',
  code: '',
  mobile: '',
  userIp: '',
  createTime: undefined as [string, string] | undefined,
  deptId: undefined as number | undefined,
  roleId: undefined as number | undefined,
  status: undefined as number | undefined,
});
const pager = reactive({ current: 1, pageSize: 10 });

const failed = ref(false);
const reading = ref(false);
let editorRequest = 0;
const batchUsers = ref<UserRecord[]>();
const selected = ref<number[]>([]);
const actionBusy = ref(false);
const detail = ref<Record<string, unknown>>();
const passwordTarget = ref<number>();
const newPassword = ref('');
const importOpen = ref(false);
const importFile = ref<File>();
const updateSupport = ref(false);
const importResult = ref<Awaited<ReturnType<typeof importUserApi>>>();
const roleOptions = ref<Array<{ label: string; value: number }>>([]);
const depts = ref<DeptRecord[]>([]);
const tableRows = computed(() =>
  moduleKey.value === 'SystemDept' ? buildSystemTree(rows.value) : rows.value,
);
const rowSelection = computed(() =>
  !isLogModule.value &&
  ['SystemDept', 'SystemRole', 'SystemUser'].includes(moduleKey.value) &&
  (moduleKey.value === 'SystemUser' || operationPermission('delete'))
    ? {
        selectedRowKeys: selected.value,
        checkStrictly: true,
        onChange: (keys: (number | string)[]) => {
          selected.value = keys.map(Number);
        },
      }
    : undefined,
);
const deptOptions = ref<Array<{ label: string; value: number }>>([]);
const menuOptions = ref<Array<{ label: string; value: number }>>([]);
const postOptions = ref<Array<{ label: string; value: number }>>([]);
const userOptions = ref<Array<{ label: string; value: number }>>([]);

const moduleKey = computed(() => String(route.name) as ModuleKey);
const title = computed(() => String(route.meta.title || '系统管理'));
const isLogModule = computed(() =>
  ['SystemLoginLog', 'SystemOperateLog'].includes(moduleKey.value),
);
let latestLoadRequest = 0;

const descriptions: Record<ModuleKey, string> = {
  SystemDept: '维护组织部门树及部门负责人',
  SystemLoginLog: '查询用户登录结果、地址和客户端信息',
  SystemMenu: '维护菜单路由、按钮权限和显示顺序',
  SystemOperateLog: '查询后台操作记录和异常详情',
  SystemPost: '维护组织岗位及岗位状态',
  SystemRole: '维护系统角色基础信息',
  SystemUser: '维护后台用户、部门和岗位',
};

const commonStatusOptions = [
  { label: '正常', value: 0 },
  { label: '停用', value: 1 },
];

const fields = computed<FormField[]>(() => {
  const definitions: Record<
    Exclude<ModuleKey, 'SystemLoginLog' | 'SystemOperateLog'>,
    FormField[]
  > = {
    SystemUser: [
      { label: '用户账号', name: 'username', required: true },
      { label: '用户昵称', name: 'nickname', required: true },
      {
        createOnly: true,
        label: '初始密码',
        name: 'password',
        required: true,
        type: 'password',
      },
      {
        label: '所属部门',
        name: 'deptId',
        options: deptOptions.value,
        type: 'select',
      },
      {
        label: '岗位',
        multiple: true,
        name: 'postIds',
        options: postOptions.value,
        type: 'select',
      },
      { label: '邮箱', name: 'email' },
      { label: '手机号', name: 'mobile' },
      {
        label: '性别',
        name: 'sex',
        options: [
          { label: '未知', value: 0 },
          { label: '男', value: 1 },
          { label: '女', value: 2 },
        ],
        type: 'select',
      },
      { label: '备注', name: 'remark', type: 'textarea' },
    ],
    SystemRole: [
      { label: '角色名称', name: 'name', required: true },
      { label: '角色编码', name: 'code', required: true },
      { label: '排序', name: 'sort', required: true, type: 'number' },
      {
        label: '状态',
        name: 'status',
        options: commonStatusOptions,
        required: true,
        type: 'select',
      },
      { label: '备注', name: 'remark', type: 'textarea' },
    ],
    SystemPost: [
      { label: '岗位名称', name: 'name', required: true },
      { label: '岗位编码', name: 'code', required: true },
      { label: '排序', name: 'sort', required: true, type: 'number' },
      {
        label: '状态',
        name: 'status',
        options: commonStatusOptions,
        required: true,
        type: 'select',
      },
      { label: '备注', name: 'remark', type: 'textarea' },
    ],
    SystemDept: [
      { label: '部门名称', name: 'name', required: true },
      {
        label: '上级部门',
        name: 'parentId',
        options: deptOptions.value.filter((o) => !isDescendant(o.value)),
        type: 'select',
      },
      { label: '排序', name: 'sort', required: true, type: 'number' },
      {
        label: '负责人',
        name: 'leaderUserId',
        options: userOptions.value,
        type: 'select',
      },
      { label: '联系电话', name: 'phone' },
      { label: '邮箱', name: 'email' },
      {
        label: '状态',
        name: 'status',
        options: commonStatusOptions,
        required: true,
        type: 'select',
      },
    ],
    SystemMenu: [
      { label: '菜单名称', name: 'name', required: true },
      {
        label: '上级菜单',
        name: 'parentId',
        options: menuOptions.value,
        required: true,
        type: 'select',
      },
      {
        label: '菜单类型',
        name: 'type',
        options: [
          { label: '目录', value: 1 },
          { label: '菜单', value: 2 },
          { label: '按钮', value: 3 },
        ],
        required: true,
        type: 'select',
      },
      { label: '排序', name: 'sort', required: true, type: 'number' },
      { label: '路由地址', name: 'path' },
      { label: '组件路径', name: 'component' },
      { label: '权限标识', name: 'permission' },
      { label: '图标', name: 'icon' },
      {
        label: '状态',
        name: 'status',
        options: commonStatusOptions,
        required: true,
        type: 'select',
      },
      { label: '可见', name: 'visible', type: 'boolean' },
      { label: '缓存', name: 'keepAlive', type: 'boolean' },
      { label: '总是显示', name: 'alwaysShow', type: 'boolean' },
    ],
  };
  return definitions[moduleKey.value as keyof typeof definitions] || [];
});

const columns = [
  { dataIndex: 'id', key: 'id', title: '编号', width: 90 },
  { dataIndex: 'name', key: 'name', title: '名称' },
  { dataIndex: 'code', key: 'code', title: '编码 / 类型', width: 190 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 100 },
  { dataIndex: 'remark', key: 'remark', title: '备注 / 地址' },
  { dataIndex: 'updatedAt', key: 'updatedAt', title: '时间', width: 175 },
  { fixed: 'right' as const, key: 'action', title: '操作', width: 340 },
];

function statusText(status: number) {
  return status === 0 ? '正常' : '停用';
}

function formatDateTime(value: string) {
  if (!value) return '';

  const date = /^\d+$/.test(value) ? new Date(Number(value)) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function isDescendant(id: number): boolean {
  const seen = new Set<number>();
  while (id) {
    if (id === editingId.value || seen.has(id)) return true;
    seen.add(id);
    id = depts.value.find((d) => d.id === id)?.parentId ?? 0;
  }
  return false;
}
function userFilters() {
  return {
    username: query.keyword || undefined,
    mobile: query.mobile || undefined,
    deptId: query.deptId,
    roleId: query.roleId,
    status: query.status as 0 | 1 | undefined,
    createTime: query.createTime,
  };
}
function roleFilters() {
  return {
    name: query.keyword || undefined,
    code: query.code || undefined,
    status: query.status as 0 | 1 | undefined,
    createTime: query.createTime,
  };
}
function logFilters() {
  return {
    username: query.keyword || undefined,
    userIp: query.userIp || undefined,
    status: query.status === undefined ? undefined : query.status === 1,
    createTime: query.createTime,
  };
}

function mapBasicRows(data: Array<Record<string, any>>): ViewRow[] {
  return data.map((item) => ({
    parentId: item.parentId,
    sort: item.sort,
    code: String(item.code ?? item.path ?? item.username ?? item.id ?? ''),
    id: Number(item.id),
    name: String(item.name ?? item.nickname ?? item.username ?? ''),
    remark: String(item.remark ?? item.deptName ?? ''),
    status: Number(item.status ?? 0),
    updatedAt: String(item.createTime ?? item.loginDate ?? ''),
  }));
}

async function loadRows() {
  const requestId = ++latestLoadRequest;
  loading.value = true;
  failed.value = false;
  selected.value = [];
  try {
    const base = { pageNo: pager.current, pageSize: pager.pageSize };
    if (moduleKey.value === 'SystemUser') {
      const result = await getUserPageApi({
        ...base,
        ...userFilters(),
      });
      if (requestId !== latestLoadRequest) return;
      rows.value = mapBasicRows(result.list);
      total.value = result.total;
    } else if (moduleKey.value === 'SystemRole') {
      const result = await getRolePageApi({
        ...base,
        ...roleFilters(),
      });
      if (requestId !== latestLoadRequest) return;
      rows.value = mapBasicRows(result.list);
      total.value = result.total;
    } else if (moduleKey.value === 'SystemPost') {
      const result = await getPostPageApi({
        ...base,
        name: query.keyword || undefined,
        status: query.status as 0 | 1 | undefined,
      });
      if (requestId !== latestLoadRequest) return;
      rows.value = mapBasicRows(result.list);
      total.value = result.total;
    } else if (moduleKey.value === 'SystemMenu') {
      const result = await getMenuListApi({
        name: query.keyword || undefined,
        status: query.status as 0 | 1 | undefined,
      });
      if (requestId !== latestLoadRequest) return;
      rows.value = mapBasicRows(result);
      total.value = result.length;
    } else if (moduleKey.value === 'SystemDept') {
      const result = await getDeptListApi({
        name: query.keyword || undefined,
        status: query.status as 0 | 1 | undefined,
      });
      if (requestId !== latestLoadRequest) return;
      rows.value = mapBasicRows(result);
      total.value = result.length;
    } else if (moduleKey.value === 'SystemOperateLog') {
      const result = await getOperateLogPageApi({
        ...base,
        type: query.keyword || undefined,
      });
      if (requestId !== latestLoadRequest) return;
      rows.value = result.list.map((item) => ({
        code: `${item.type} / ${item.subType}`,
        id: item.id,
        name: item.userName,
        remark: item.action || item.requestUrl,
        status: 0,
        updatedAt: item.createTime,
      }));
      total.value = result.total;
    } else if (moduleKey.value === 'SystemLoginLog') {
      const result = await getLoginLogPageApi({
        ...base,
        ...logFilters(),
      });
      if (requestId !== latestLoadRequest) return;
      rows.value = result.list.map((item) => ({
        code: String(item.result),
        id: item.id,
        name: item.username,
        remark: item.userIp,
        status: item.result,
        updatedAt: item.createTime,
      }));
      total.value = result.total;
    }
  } catch {
    if (requestId === latestLoadRequest) {
      failed.value = true;
      rows.value = [];
      total.value = 0;
    }
  } finally {
    if (requestId === latestLoadRequest) loading.value = false;
  }
}

let lookupRequest = 0;
async function loadLookups() {
  const request = ++lookupRequest;
  const module = moduleKey.value;
  if (moduleKey.value === 'SystemUser') {
    const [depts, posts, roles] = await Promise.all([
      getSimpleDeptListApi(),
      getSimplePostListApi(),
      getSimpleRoleListApi(),
    ]);
    if (request !== lookupRequest || module !== moduleKey.value) return;
    roleOptions.value = roles.map((r) => ({ label: r.name, value: r.id! }));
    deptOptions.value = depts
      .filter((item) => item.id)
      .map((item) => ({ label: item.name, value: item.id! }));
    postOptions.value = posts
      .filter((item) => item.id)
      .map((item) => ({ label: item.name, value: item.id! }));
  } else if (moduleKey.value === 'SystemDept') {
    const [deptList, users] = await Promise.all([
      getSimpleDeptListApi(),
      getSimpleUserListApi(),
    ]);
    if (request !== lookupRequest || module !== moduleKey.value) return;
    depts.value = deptList;
    deptOptions.value = [
      { label: '顶级部门', value: 0 },
      ...deptList
        .filter((item) => item.id)
        .map((item) => ({ label: item.name, value: item.id! })),
    ];
    userOptions.value = users
      .filter((item) => item.id)
      .map((item) => ({ label: item.nickname, value: item.id! }));
  } else if (moduleKey.value === 'SystemMenu') {
    const menus = await getSimpleMenuListApi();
    if (request !== lookupRequest || module !== moduleKey.value) return;
    menuOptions.value = [
      { label: '主类目', value: 0 },
      ...menus
        .filter((item) => item.id)
        .map((item) => ({ label: item.name, value: item.id! })),
    ];
  }
}

function resetEditor() {
  Object.keys(editor).forEach((key) => delete editor[key]);
  Object.assign(editor, {
    alwaysShow: false,
    keepAlive: false,
    parentId: 0,
    sort: 0,
    status: 0,
    visible: true,
  });
}

async function openEditor(id?: number) {
  if (
    reading.value ||
    saving.value ||
    !operationPermission(id ? 'update' : 'create')
  )
    return;
  const request = ++editorRequest;
  const module = moduleKey.value;
  reading.value = true;
  resetEditor();
  editingId.value = id;
  try {
    await loadLookups();
    if (request !== editorRequest) return;
    if (id) {
      let data: Record<string, any>;
      if (moduleKey.value === 'SystemUser') data = await getUserApi(id);
      else if (moduleKey.value === 'SystemRole') data = await getRoleApi(id);
      else if (moduleKey.value === 'SystemPost') data = await getPostApi(id);
      else if (moduleKey.value === 'SystemMenu') data = await getMenuApi(id);
      else data = await getDeptApi(id);
      if (request !== editorRequest) return;
      Object.assign(editor, data);
      if (
        module === 'SystemDept' &&
        data.leaderUserId &&
        !userOptions.value.some((o) => o.value === data.leaderUserId)
      ) {
        const user = await getSimpleUserApi(data.leaderUserId);
        if (request !== editorRequest) return;
        userOptions.value.push({
          value: data.leaderUserId,
          label: user?.nickname || '用户 #' + data.leaderUserId,
        });
      }
    }
    delete editor.password;
    editorOpen.value = true;
  } catch {
    /* Request interceptor displays read errors. */
  } finally {
    if (request === editorRequest) reading.value = false;
  }
}

function userPayload(): UserRecord {
  const {
    id,
    username,
    nickname,
    password,
    deptId,
    postIds,
    email,
    mobile,
    sex,
    remark,
    avatar,
  } = editor;
  return {
    id,
    username,
    nickname,
    ...(!editingId.value ? { password } : {}),
    deptId,
    postIds,
    email,
    mobile,
    sex,
    remark,
    avatar,
  };
}
async function save() {
  if (
    saving.value ||
    !operationPermission(editingId.value ? 'update' : 'create')
  )
    return;
  for (const field of fields.value) {
    if (
      field.required &&
      (!editingId.value || !field.createOnly) &&
      (editor[field.name] === undefined || editor[field.name] === '')
    ) {
      message.warning(`请填写${field.label}`);
      return;
    }
  }
  if (
    moduleKey.value === 'SystemUser' &&
    (!/^[a-zA-Z0-9]{4,30}$/.test(editor.username) ||
      editor.nickname.length > 30)
  ) {
    message.warning('账号需为 4–30 位字母或数字，昵称最多 30 个字符');
    return;
  }
  if (moduleKey.value === 'SystemDept' && isDescendant(editor.parentId)) {
    message.warning('上级部门不能是本部门或下级部门');
    return;
  }
  saving.value = true;
  try {
    let result: unknown;
    if (moduleKey.value === 'SystemUser') {
      result = editingId.value
        ? await updateUserApi(userPayload())
        : await createUserApi(userPayload());
    } else if (moduleKey.value === 'SystemRole') {
      result = editingId.value
        ? await updateRoleApi(editor as RoleRecord)
        : await createRoleApi(editor as RoleRecord);
    } else if (moduleKey.value === 'SystemPost') {
      result = editingId.value
        ? await updatePostApi(editor as PostRecord)
        : await createPostApi(editor as PostRecord);
    } else if (moduleKey.value === 'SystemMenu') {
      result = editingId.value
        ? await updateMenuApi(editor as MenuRecord)
        : await createMenuApi(editor as MenuRecord);
    } else if (moduleKey.value === 'SystemDept') {
      result = editingId.value
        ? await updateDeptApi(editor as DeptRecord)
        : await createDeptApi(editor as DeptRecord);
    }
    if (result === false) {
      message.error('保存失败，请重试');
      return;
    }
    editorOpen.value = false;
    message.success('保存成功');
    await loadRows();
  } catch {
    /* Keep editor open for retry. */
  } finally {
    saving.value = false;
  }
}

async function runAction(action: () => Promise<unknown>, success: string) {
  if (actionBusy.value) return false;
  actionBusy.value = true;
  try {
    if ((await action()) === false) {
      message.error('操作失败，请重试');
      return false;
    }
    message.success(success);
    await loadRows();
    return true;
  } catch {
    return false;
  } finally {
    actionBusy.value = false;
  }
}
async function remove(id: number) {
  if (!operationPermission('delete')) return;
  const fn = {
    SystemUser: deleteUserApi,
    SystemRole: deleteRoleApi,
    SystemPost: deletePostApi,
    SystemMenu: deleteMenuApi,
    SystemDept: deleteDeptApi,
  }[moduleKey.value as 'SystemUser'];
  await runAction(() => fn(id), '删除成功');
}
async function removeSelected() {
  if (!operationPermission('delete') || !selected.value.length) return;
  const fn = {
    SystemUser: deleteUserListApi,
    SystemRole: deleteRoleListApi,
    SystemDept: deleteDeptListApi,
  }[moduleKey.value as 'SystemUser'];
  await runAction(() => fn([...selected.value]), '批量删除成功');
}
async function toggleUser(id: number, status: number) {
  if (!has('system:user:update')) return;
  await runAction(
    () => updateUserStatusApi(id, status === 0 ? 1 : 0),
    '用户状态已更新',
  );
}
async function resetPassword() {
  if (
    !passwordTarget.value ||
    !newPassword.value ||
    !has('system:user:update-password')
  )
    return;
  const ok = await runAction(
    () => resetUserPasswordApi(passwordTarget.value!, newPassword.value),
    '密码已重置',
  );
  if (ok) {
    passwordTarget.value = undefined;
    newPassword.value = '';
  }
}
async function download(template = false) {
  if (actionBusy.value || !operationPermission(template ? 'import' : 'export'))
    return;
  actionBusy.value = true;
  try {
    const blob = template
      ? await getUserImportTemplateApi()
      : moduleKey.value === 'SystemUser'
        ? await exportUserApi(userFilters())
        : moduleKey.value === 'SystemRole'
          ? await exportRoleApi(roleFilters())
          : await exportLoginLogApi(logFilters());
    if (
      !(blob instanceof Blob) ||
      !blob.size ||
      /json|html|text/i.test(blob.type)
    ) {
      message.error('接口未返回有效 Excel 文件');
      return;
    }
    const prefix = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    const extension =
      prefix[0] === 0x50 && prefix[1] === 0x4b ? '.xlsx' : '.xls';
    downloadFileFromBlob({
      source: blob,
      fileName: (template ? '用户导入模板' : title.value) + extension,
    });
  } catch {
    /* Download errors are shown by request client. */
  } finally {
    actionBusy.value = false;
  }
}
async function importUsers() {
  if (!importFile.value || actionBusy.value || !has('system:user:import'))
    return;
  actionBusy.value = true;
  try {
    importResult.value = await importUserApi(
      importFile.value,
      updateSupport.value,
    );
    await loadRows();
  } catch {
    /* Retain the file for retry. */
  } finally {
    actionBusy.value = false;
  }
}
let leaderRequest = 0;
async function searchLeaders(nickname: string) {
  const request = ++leaderRequest;
  try {
    const users = await searchSimpleUsersApi(nickname);
    if (request === leaderRequest)
      userOptions.value = users.map((u) => ({
        label: u.nickname,
        value: u.id!,
      }));
  } catch {
    /* Preserve previous options. */
  }
}
async function viewSelectedUsers() {
  if (!selected.value.length || actionBusy.value) return;
  actionBusy.value = true;
  try {
    batchUsers.value = await getUserListApi([...selected.value]);
  } catch {
    /* Request error is displayed. */
  } finally {
    actionBusy.value = false;
  }
}
function chooseImport(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file && !/\.xlsx?$/i.test(file.name)) {
    message.warning('请选择 Excel 文件（.xls 或 .xlsx）');
    input.value = '';
    importFile.value = undefined;
    return;
  }
  importFile.value = file;
  importResult.value = undefined;
}
async function viewLog(id: number) {
  try {
    detail.value = {
      ...(await (moduleKey.value === 'SystemOperateLog'
        ? getOperateLogApi(id)
        : moduleKey.value === 'SystemUser'
          ? getUserApi(id)
          : getLoginLogApi(id))),
    };
  } catch {
    /* Request interceptor displays read errors. */
  }
}
const detailLabels: Record<string, string> = {
  id: '编号',
  username: '账号',
  nickname: '昵称',
  email: '邮箱',
  mobile: '手机号',
  deptId: '部门编号',
  postIds: '岗位编号',
  sex: '性别',
  avatar: '头像地址',
  status: '账号状态',
  remark: '备注',
  createTime: '创建时间',
  loginDate: '最后登录时间',
  loginIp: '最后登录 IP',
  logType: '日志类型',
  result: '登录结果',
  traceId: '追踪编号',
  userAgent: '客户端',
  userId: '用户编号',
  userIp: '登录 IP',
  userType: '用户类型',
};
const loginResults: Record<number, string> = {
  0: '成功',
  10: '账号或密码不正确',
  20: '用户被禁用',
  30: '验证码不存在',
  31: '验证码不正确',
  100: '未知异常',
};

function changePage(page: number, pageSize: number) {
  pager.current = page;
  pager.pageSize = pageSize;
  loadRows();
}

function search() {
  pager.current = 1;
  loadRows();
}

function reset() {
  Object.assign(query, {
    keyword: '',
    code: '',
    mobile: '',
    userIp: '',
    createTime: undefined,
    deptId: undefined,
    roleId: undefined,
    status: undefined,
  });
  search();
}

function allowNavigation() {
  if (saving.value || actionBusy.value) {
    message.warning('操作处理中，请稍候');
    return false;
  }
  return true;
}
onBeforeRouteLeave(allowNavigation);
onBeforeRouteUpdate(allowNavigation);
watch(
  () => route.name,
  () => {
    editorRequest++;
    reading.value = false;
    batchUsers.value = undefined;
    authorization.value = undefined;
    editorOpen.value = false;
    detail.value = undefined;
    passwordTarget.value = undefined;
    importOpen.value = false;
    if (route.name === 'SystemUser') void loadLookups().catch(() => {});
    pager.current = 1;
    reset();
  },
  { immediate: true },
);
</script>

<template>
  <Page :description="descriptions[moduleKey]" :title="title">
    <Card class="mb-4!" :bordered="false">
      <Form layout="inline" :model="query">
        <FormItem label="关键词">
          <Input
            v-model:value="query.keyword"
            allow-clear
            placeholder="名称 / 编码 / 用户"
            style="width: 240px"
            @press-enter="search"
          />
        </FormItem>
        <FormItem v-if="moduleKey !== 'SystemOperateLog'" label="状态">
          <Select
            v-model:value="query.status"
            allow-clear
            placeholder="全部状态"
            style="width: 140px"
            :options="
              moduleKey === 'SystemLoginLog'
                ? [
                    { label: '成功', value: 1 },
                    { label: '失败', value: 0 },
                  ]
                : commonStatusOptions
            "
          />
        </FormItem>
        <FormItem v-if="moduleKey === 'SystemUser'" label="手机号">
          <Input v-model:value="query.mobile" allow-clear />
        </FormItem>
        <FormItem v-if="moduleKey === 'SystemUser'" label="部门">
          <Select
            v-model:value="query.deptId"
            allow-clear
            :options="deptOptions"
            style="width: 180px"
          />
        </FormItem>
        <FormItem v-if="moduleKey === 'SystemUser'" label="角色">
          <Select
            v-model:value="query.roleId"
            allow-clear
            :options="roleOptions"
            style="width: 180px"
          />
        </FormItem>
        <FormItem v-if="moduleKey === 'SystemRole'" label="角色编码">
          <Input v-model:value="query.code" allow-clear />
        </FormItem>
        <FormItem v-if="moduleKey === 'SystemLoginLog'" label="登录 IP">
          <Input v-model:value="query.userIp" allow-clear />
        </FormItem>
        <FormItem
          v-if="
            ['SystemUser', 'SystemRole', 'SystemLoginLog'].includes(moduleKey)
          "
          label="创建时间"
        >
          <DatePicker.RangePicker
            v-model:value="query.createTime"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </FormItem>
        <FormItem>
          <Space>
            <Button type="primary" @click="search">查询</Button>
            <Button @click="reset">重置</Button>
          </Space>
        </FormItem>
      </Form>
    </Card>
    <Card :bordered="false">
      <template #title>{{ title }}列表</template>
      <template #extra>
        <div class="flex flex-wrap gap-2">
          <Button
            v-if="!isLogModule && operationPermission('create')"
            type="primary"
            :disabled="actionBusy"
            @click="openEditor()"
          >
            <span>新增</span>
          </Button>
          <Button
            v-if="
              ['SystemUser', 'SystemRole', 'SystemLoginLog'].includes(
                moduleKey,
              ) && operationPermission('export')
            "
            :loading="actionBusy"
            @click="download()"
          >
            <span>导出</span>
          </Button>
          <Button
            v-if="moduleKey === 'SystemUser' && operationPermission('import')"
            @click="
              importOpen = true;
              importResult = undefined;
            "
          >
            <span>导入用户</span>
          </Button>
          <Button
            v-if="moduleKey === 'SystemUser'"
            :disabled="!selected.length || actionBusy"
            @click="viewSelectedUsers"
          >
            <span>查看所选用户</span>
          </Button>
          <Popconfirm
            v-if="rowSelection && operationPermission('delete')"
            title="确认删除选中的数据吗？"
            @confirm="removeSelected"
          >
            <Button danger :disabled="!selected.length || actionBusy">
              <span>批量删除</span>
            </Button>
          </Popconfirm>
        </div>
      </template>
      <Alert
        v-if="failed"
        class="mb-4!"
        type="error"
        message="列表加载失败，请重新查询"
        show-icon
      />
      <Table
        :columns="columns"
        :data-source="tableRows"
        :row-selection="rowSelection"
        :loading="loading || actionBusy || reading"
        :pagination="
          moduleKey === 'SystemDept'
            ? false
            : {
                current: pager.current,
                pageSize: pager.pageSize,
                showSizeChanger: true,
                total,
                onChange: changePage,
              }
        "
        row-key="id"
        :scroll="{ x: 1050 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <Tag :color="record.status === 0 ? 'success' : 'default'">
              {{
                moduleKey === 'SystemLoginLog'
                  ? loginResults[record.status] || `未知结果：${record.status}`
                  : isLogModule
                    ? record.status
                    : statusText(record.status)
              }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'updatedAt'">
            {{ formatDateTime(record.updatedAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <Button
              v-if="isLogModule"
              size="small"
              type="link"
              @click="viewLog(record.id)"
            >
              详情
            </Button>
            <Space v-else wrap>
              <Button
                v-if="moduleKey === 'SystemUser'"
                type="link"
                size="small"
                @click="viewLog(record.id)"
              >
                <span>详情</span>
              </Button>
              <Popconfirm
                v-if="moduleKey === 'SystemUser' && has('system:user:update')"
                :title="
                  record.status === 0 ? '确认停用此用户？' : '确认启用此用户？'
                "
                @confirm="toggleUser(record.id, record.status)"
              >
                <Button type="link" size="small" :disabled="actionBusy">
                  <span>{{ record.status === 0 ? '停用' : '启用' }}</span>
                </Button>
              </Popconfirm>
              <Button
                v-if="
                  moduleKey === 'SystemUser' &&
                  has('system:user:update-password')
                "
                type="link"
                size="small"
                @click="
                  passwordTarget = record.id;
                  newPassword = '';
                "
              >
                <span>重置密码</span>
              </Button>
              <Button
                v-if="operationPermission('update')"
                size="small"
                type="link"
                @click="openEditor(record.id)"
              >
                编辑
              </Button>
              <Button
                v-if="
                  moduleKey === 'SystemUser' &&
                  has('system:permission:assign-user-role')
                "
                size="small"
                type="link"
                @click="authorize('roles', record.id, record.name)"
              >
                <span>分配角色</span>
              </Button>
              <Button
                v-if="
                  moduleKey === 'SystemRole' &&
                  has('system:permission:assign-role-menu')
                "
                size="small"
                type="link"
                @click="authorize('menus', record.id, record.name)"
              >
                <span>菜单权限</span>
              </Button>
              <Button
                v-if="
                  moduleKey === 'SystemRole' &&
                  has('system:permission:assign-role-data-scope')
                "
                size="small"
                type="link"
                @click="authorize('data', record.id, record.name)"
              >
                <span>数据权限</span>
              </Button>
              <Popconfirm
                v-if="operationPermission('delete')"
                title="确认删除这条数据吗？"
                @confirm="remove(record.id)"
              >
                <Button danger size="small" type="link"> 删除 </Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </Card>
    <PermissionEditor
      v-if="authorization"
      :key="authorization.kind + authorization.targetId"
      v-bind="authorization"
      @close="authorization = undefined"
    />
    <Modal
      v-model:open="editorOpen"
      :closable="!saving"
      :mask-closable="!saving"
      :keyboard="!saving"
      :cancel-button-props="{ disabled: saving }"
      :confirm-loading="saving"
      :title="`${editingId ? '编辑' : '新增'}${title.replace('管理', '')}`"
      width="680px"
      @ok="save"
    >
      <Form
        :model="editor"
        class="pt-4"
        :label-col="{ span: 5 }"
        :wrapper-col="{ span: 17 }"
      >
        <template v-for="field in fields" :key="field.name">
          <FormItem
            v-if="!field.createOnly || !editingId"
            :label="field.label"
            :required="field.required"
          >
            <InputNumber
              v-if="field.type === 'number'"
              v-model:value="editor[field.name]"
              class="w-full"
            />
            <Select
              v-else-if="field.type === 'select'"
              v-model:value="editor[field.name]"
              allow-clear
              :mode="field.multiple ? 'multiple' : undefined"
              :options="field.options"
              show-search
              option-filter-prop="label"
              :filter-option="field.name === 'leaderUserId' ? false : undefined"
              @search="field.name === 'leaderUserId' && searchLeaders($event)"
            />
            <Switch
              v-else-if="field.type === 'boolean'"
              v-model:checked="editor[field.name]"
            />
            <Input.Password
              v-else-if="field.type === 'password'"
              v-model:value="editor[field.name]"
            />
            <Input.TextArea
              v-else-if="field.type === 'textarea'"
              v-model:value="editor[field.name]"
              :rows="3"
            />
            <Input v-else v-model:value="editor[field.name]" />
          </FormItem>
        </template>
      </Form>
    </Modal>
    <Modal
      :open="!!batchUsers"
      title="所选用户详情"
      :footer="null"
      width="900px"
      @cancel="batchUsers = undefined"
    >
      <Table
        :data-source="batchUsers"
        row-key="id"
        :pagination="false"
        :columns="[
          { title: '账号', dataIndex: 'username' },
          { title: '昵称', dataIndex: 'nickname' },
          { title: '部门', dataIndex: 'deptName' },
          { title: '手机号', dataIndex: 'mobile' },
          { title: '邮箱', dataIndex: 'email' },
        ]"
      />
    </Modal>
    <Modal
      :open="!!detail"
      title="详情"
      :footer="null"
      width="720px"
      @cancel="detail = undefined"
    >
      <Descriptions bordered :column="1">
        <DescriptionsItem
          v-for="(value, key) in detail"
          :key="key"
          :label="detailLabels[key] || key"
        >
          {{
            key === 'result'
              ? loginResults[Number(value)] || value
              : (value ?? '—')
          }}
        </DescriptionsItem>
      </Descriptions>
    </Modal>
    <Modal
      :open="!!passwordTarget"
      title="重置用户密码"
      :confirm-loading="actionBusy"
      :closable="!actionBusy"
      :mask-closable="!actionBusy"
      :keyboard="!actionBusy"
      :cancel-button-props="{ disabled: actionBusy }"
      @cancel="
        passwordTarget = undefined;
        newPassword = '';
      "
      @ok="resetPassword"
    >
      <Form :model="{ newPassword }" layout="vertical">
        <FormItem label="新密码" required>
          <Input.Password
            v-model:value="newPassword"
            autocomplete="new-password"
          />
        </FormItem>
      </Form>
    </Modal>
    <Modal
      v-model:open="importOpen"
      title="导入用户"
      :confirm-loading="actionBusy"
      :closable="!actionBusy"
      :mask-closable="!actionBusy"
      :keyboard="!actionBusy"
      :cancel-button-props="{ disabled: actionBusy }"
      :ok-button-props="{ disabled: !importFile || !!importResult }"
      @ok="importUsers"
    >
      <div class="flex flex-col gap-4 py-4">
        <Button :disabled="actionBusy" @click="download(true)">
          <span>下载导入模板</span>
        </Button>
        <input
          type="file"
          accept=".xls,.xlsx"
          :disabled="actionBusy"
          aria-label="用户 Excel 文件"
          @change="chooseImport"
        />
        <Checkbox v-model:checked="updateSupport" :disabled="actionBusy">
          更新已存在的用户
        </Checkbox>
        <template v-if="importResult">
          <Alert
            type="info"
            :message="`新增 ${(importResult.createUsernames || []).length} 个，更新 ${(importResult.updateUsernames || []).length} 个，失败 ${Object.keys(importResult.failureUsernames || {}).length} 个`"
          />
          <div
            v-for="(reason, username) in importResult.failureUsernames"
            :key="username"
          >
            {{ username }}：{{ reason }}
          </div>
        </template>
      </div>
    </Modal>
  </Page>
</template>
