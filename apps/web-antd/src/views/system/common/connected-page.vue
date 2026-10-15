<script lang="ts" setup>
import type {
  DeptRecord,
  MenuRecord,
  PostRecord,
  RoleRecord,
  UserRecord,
} from '#/api';

import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import {
  Button,
  Card,
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
  deleteMenuApi,
  deletePostApi,
  deleteRoleApi,
  deleteUserApi,
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
  getSimpleUserListApi,
  getUserApi,
  getUserPageApi,
  updateDeptApi,
  updateMenuApi,
  updatePostApi,
  updateRoleApi,
  updateUserApi,
} from '#/api';

type ModuleKey =
  | 'SystemDept'
  | 'SystemLoginLog'
  | 'SystemMenu'
  | 'SystemOperateLog'
  | 'SystemPost'
  | 'SystemRole'
  | 'SystemUser';

interface ViewRow {
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
const loading = ref(false);
const saving = ref(false);
const editorOpen = ref(false);
const rows = ref<ViewRow[]>([]);
const total = ref(0);
const editingId = ref<number>();
const editor = reactive<Record<string, any>>({});
const query = reactive({ keyword: '', status: undefined as number | undefined });
const pager = reactive({ current: 1, pageSize: 10 });

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
  const definitions: Record<Exclude<ModuleKey, 'SystemLoginLog' | 'SystemOperateLog'>, FormField[]> = {
    SystemUser: [
      { label: '用户账号', name: 'username', required: true },
      { label: '用户昵称', name: 'nickname', required: true },
      { createOnly: true, label: '初始密码', name: 'password', required: true, type: 'password' },
      { label: '所属部门', name: 'deptId', options: deptOptions.value, type: 'select' },
      { label: '岗位', multiple: true, name: 'postIds', options: postOptions.value, type: 'select' },
      { label: '邮箱', name: 'email' },
      { label: '手机号', name: 'mobile' },
      { label: '性别', name: 'sex', options: [{ label: '未知', value: 0 }, { label: '男', value: 1 }, { label: '女', value: 2 }], type: 'select' },
      { label: '备注', name: 'remark', type: 'textarea' },
    ],
    SystemRole: [
      { label: '角色名称', name: 'name', required: true },
      { label: '角色编码', name: 'code', required: true },
      { label: '排序', name: 'sort', required: true, type: 'number' },
      { label: '状态', name: 'status', options: commonStatusOptions, required: true, type: 'select' },
      { label: '备注', name: 'remark', type: 'textarea' },
    ],
    SystemPost: [
      { label: '岗位名称', name: 'name', required: true },
      { label: '岗位编码', name: 'code', required: true },
      { label: '排序', name: 'sort', required: true, type: 'number' },
      { label: '状态', name: 'status', options: commonStatusOptions, required: true, type: 'select' },
      { label: '备注', name: 'remark', type: 'textarea' },
    ],
    SystemDept: [
      { label: '部门名称', name: 'name', required: true },
      { label: '上级部门', name: 'parentId', options: deptOptions.value, type: 'select' },
      { label: '排序', name: 'sort', required: true, type: 'number' },
      { label: '负责人', name: 'leaderUserId', options: userOptions.value, type: 'select' },
      { label: '联系电话', name: 'phone' },
      { label: '邮箱', name: 'email' },
      { label: '状态', name: 'status', options: commonStatusOptions, required: true, type: 'select' },
    ],
    SystemMenu: [
      { label: '菜单名称', name: 'name', required: true },
      { label: '上级菜单', name: 'parentId', options: menuOptions.value, required: true, type: 'select' },
      { label: '菜单类型', name: 'type', options: [{ label: '目录', value: 1 }, { label: '菜单', value: 2 }, { label: '按钮', value: 3 }], required: true, type: 'select' },
      { label: '排序', name: 'sort', required: true, type: 'number' },
      { label: '路由地址', name: 'path' },
      { label: '组件路径', name: 'component' },
      { label: '权限标识', name: 'permission' },
      { label: '图标', name: 'icon' },
      { label: '状态', name: 'status', options: commonStatusOptions, required: true, type: 'select' },
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
  { fixed: 'right' as const, key: 'action', title: '操作', width: 150 },
];

function statusText(status: number) {
  return status === 0 ? '正常' : '停用';
}

function formatDateTime(value: string) {
  if (!value) return '';

  const date = /^\d+$/.test(value)
    ? new Date(Number(value))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function mapBasicRows(data: Array<Record<string, any>>): ViewRow[] {
  return data.map((item) => ({
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
  try {
    const base = { pageNo: pager.current, pageSize: pager.pageSize };
    if (moduleKey.value === 'SystemUser') {
      const result = await getUserPageApi({ ...base, status: query.status as 0 | 1 | undefined, username: query.keyword || undefined });
      if (requestId !== latestLoadRequest) return;
      rows.value = mapBasicRows(result.list);
      total.value = result.total;
    } else if (moduleKey.value === 'SystemRole') {
      const result = await getRolePageApi({ ...base, name: query.keyword || undefined, status: query.status as 0 | 1 | undefined });
      if (requestId !== latestLoadRequest) return;
      rows.value = mapBasicRows(result.list);
      total.value = result.total;
    } else if (moduleKey.value === 'SystemPost') {
      const result = await getPostPageApi({ ...base, name: query.keyword || undefined, status: query.status as 0 | 1 | undefined });
      if (requestId !== latestLoadRequest) return;
      rows.value = mapBasicRows(result.list);
      total.value = result.total;
    } else if (moduleKey.value === 'SystemMenu') {
      const result = await getMenuListApi({ name: query.keyword || undefined, status: query.status as 0 | 1 | undefined });
      if (requestId !== latestLoadRequest) return;
      rows.value = mapBasicRows(result);
      total.value = result.length;
    } else if (moduleKey.value === 'SystemDept') {
      const result = await getDeptListApi({ name: query.keyword || undefined, status: query.status as 0 | 1 | undefined });
      if (requestId !== latestLoadRequest) return;
      rows.value = mapBasicRows(result);
      total.value = result.length;
    } else if (moduleKey.value === 'SystemOperateLog') {
      const result = await getOperateLogPageApi({ ...base, type: query.keyword || undefined });
      if (requestId !== latestLoadRequest) return;
      rows.value = result.list.map((item) => ({ code: `${item.type} / ${item.subType}`, id: item.id, name: item.userName, remark: item.action || item.requestUrl, status: 0, updatedAt: item.createTime }));
      total.value = result.total;
    } else if (moduleKey.value === 'SystemLoginLog') {
      const result = await getLoginLogPageApi({ ...base, status: query.status, username: query.keyword || undefined });
      if (requestId !== latestLoadRequest) return;
      rows.value = result.list.map((item) => ({ code: String(item.result), id: item.id, name: item.username, remark: item.userIp, status: item.result, updatedAt: item.createTime }));
      total.value = result.total;
    }
  } finally {
    if (requestId === latestLoadRequest) loading.value = false;
  }
}

async function loadLookups() {
  if (moduleKey.value === 'SystemUser') {
    const [depts, posts] = await Promise.all([getSimpleDeptListApi(), getSimplePostListApi()]);
    deptOptions.value = depts.filter((item) => item.id).map((item) => ({ label: item.name, value: item.id! }));
    postOptions.value = posts.filter((item) => item.id).map((item) => ({ label: item.name, value: item.id! }));
  } else if (moduleKey.value === 'SystemDept') {
    const [depts, users] = await Promise.all([getSimpleDeptListApi(), getSimpleUserListApi()]);
    deptOptions.value = [{ label: '顶级部门', value: 0 }, ...depts.filter((item) => item.id).map((item) => ({ label: item.name, value: item.id! }))];
    userOptions.value = users.filter((item) => item.id).map((item) => ({ label: item.nickname, value: item.id! }));
  } else if (moduleKey.value === 'SystemMenu') {
    const menus = await getSimpleMenuListApi();
    menuOptions.value = [{ label: '主类目', value: 0 }, ...menus.filter((item) => item.id).map((item) => ({ label: item.name, value: item.id! }))];
  }
}

function resetEditor() {
  Object.keys(editor).forEach((key) => delete editor[key]);
  Object.assign(editor, { alwaysShow: false, keepAlive: false, parentId: 0, sort: 0, status: 0, visible: true });
}

async function openEditor(id?: number) {
  resetEditor();
  editingId.value = id;
  await loadLookups();
  if (id) {
    let data: Record<string, any>;
    if (moduleKey.value === 'SystemUser') data = await getUserApi(id);
    else if (moduleKey.value === 'SystemRole') data = await getRoleApi(id);
    else if (moduleKey.value === 'SystemPost') data = await getPostApi(id);
    else if (moduleKey.value === 'SystemMenu') data = await getMenuApi(id);
    else data = await getDeptApi(id);
    Object.assign(editor, data);
  }
  editorOpen.value = true;
}

async function save() {
  for (const field of fields.value) {
    if (field.required && (!editingId.value || !field.createOnly) && (editor[field.name] === undefined || editor[field.name] === '')) {
      message.warning(`请填写${field.label}`);
      return;
    }
  }
  saving.value = true;
  try {
    if (moduleKey.value === 'SystemUser') {
      editingId.value ? await updateUserApi(editor as UserRecord) : await createUserApi(editor as UserRecord);
    } else if (moduleKey.value === 'SystemRole') {
      editingId.value ? await updateRoleApi(editor as RoleRecord) : await createRoleApi(editor as RoleRecord);
    } else if (moduleKey.value === 'SystemPost') {
      editingId.value ? await updatePostApi(editor as PostRecord) : await createPostApi(editor as PostRecord);
    } else if (moduleKey.value === 'SystemMenu') {
      editingId.value ? await updateMenuApi(editor as MenuRecord) : await createMenuApi(editor as MenuRecord);
    } else if (moduleKey.value === 'SystemDept') {
      editingId.value ? await updateDeptApi(editor as DeptRecord) : await createDeptApi(editor as DeptRecord);
    }
    editorOpen.value = false;
    message.success('保存成功');
    await loadRows();
  } finally {
    saving.value = false;
  }
}

async function remove(id: number) {
  if (moduleKey.value === 'SystemUser') await deleteUserApi(id);
  else if (moduleKey.value === 'SystemRole') await deleteRoleApi(id);
  else if (moduleKey.value === 'SystemPost') await deletePostApi(id);
  else if (moduleKey.value === 'SystemMenu') await deleteMenuApi(id);
  else if (moduleKey.value === 'SystemDept') await deleteDeptApi(id);
  message.success('删除成功');
  await loadRows();
}

async function viewLog(id: number) {
  const detail = moduleKey.value === 'SystemOperateLog' ? await getOperateLogApi(id) : await getLoginLogApi(id);
  Modal.info({ content: JSON.stringify(detail, null, 2), title: '日志详情', width: 720 });
}

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
  query.keyword = '';
  query.status = undefined;
  search();
}

watch(
  () => route.name,
  () => {
    pager.current = 1;
    reset();
  },
  { immediate: true },
);
</script>

<template>
  <Page :description="descriptions[moduleKey]" :title="title">
    <Card class="mb-4!" :bordered="false">
      <Form layout="inline">
        <FormItem label="关键词">
          <Input v-model:value="query.keyword" allow-clear placeholder="名称 / 编码 / 用户" style="width: 240px" @press-enter="search" />
        </FormItem>
        <FormItem v-if="moduleKey !== 'SystemOperateLog'" label="状态">
          <Select v-model:value="query.status" allow-clear placeholder="全部状态" style="width: 140px" :options="commonStatusOptions" />
        </FormItem>
        <FormItem>
          <Space><Button type="primary" @click="search">查询</Button><Button @click="reset">重置</Button></Space>
        </FormItem>
      </Form>
    </Card>

    <Card :bordered="false">
      <template #title>{{ title }}列表</template>
      <template v-if="!isLogModule" #extra><Button type="primary" @click="openEditor()">新增</Button></template>
      <Table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="{ current: pager.current, pageSize: pager.pageSize, showSizeChanger: true, total, onChange: changePage }"
        row-key="id"
        :scroll="{ x: 1050 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'"><Tag :color="record.status === 0 ? 'success' : 'default'">{{ isLogModule ? record.status : statusText(record.status) }}</Tag></template>
          <template v-else-if="column.key === 'updatedAt'">{{ formatDateTime(record.updatedAt) }}</template>
          <template v-else-if="column.key === 'action'">
            <Button v-if="isLogModule" size="small" type="link" @click="viewLog(record.id)">详情</Button>
            <Space v-else>
              <Button size="small" type="link" @click="openEditor(record.id)">编辑</Button>
              <Popconfirm title="确认删除这条数据吗？" @confirm="remove(record.id)"><Button danger size="small" type="link">删除</Button></Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </Card>

    <Modal v-model:open="editorOpen" :confirm-loading="saving" :title="`${editingId ? '编辑' : '新增'}${title.replace('管理', '')}`" width="680px" @ok="save">
      <Form class="pt-4" :label-col="{ span: 5 }" :wrapper-col="{ span: 17 }">
        <template v-for="field in fields" :key="field.name">
          <FormItem v-if="!field.createOnly || !editingId" :label="field.label" :required="field.required">
            <InputNumber v-if="field.type === 'number'" v-model:value="editor[field.name]" class="w-full" />
            <Select v-else-if="field.type === 'select'" v-model:value="editor[field.name]" allow-clear :mode="field.multiple ? 'multiple' : undefined" :options="field.options" />
            <Switch v-else-if="field.type === 'boolean'" v-model:checked="editor[field.name]" />
            <Input.Password v-else-if="field.type === 'password'" v-model:value="editor[field.name]" />
            <Input.TextArea v-else-if="field.type === 'textarea'" v-model:value="editor[field.name]" :rows="3" />
            <Input v-else v-model:value="editor[field.name]" />
          </FormItem>
        </template>
      </Form>
    </Modal>
  </Page>
</template>
