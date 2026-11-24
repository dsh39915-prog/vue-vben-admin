<script setup lang="ts">
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';

import type { ResourceField } from './resource-config';

import type { SystemResource } from '#/api';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  assignSystemUserRolesApi,
  createSystemResourceApi,
  deleteSystemResourceApi,
  getSystemResourceDetailsApi,
  getSystemResourceListApi,
  getSystemRoleGrantsApi,
  getSystemRoleOptionsApi,
  resetSystemUserPasswordApi,
  updateSystemResourceApi,
  updateSystemRoleGrantsApi,
  updateSystemStatusApi,
} from '#/api';

import { useSystemAccess } from './access';
import {
  getResourceFields,
  passwordRules,
  typeOptions,
} from './resource-config';

const props = defineProps<{ resource: SystemResource }>();
const route = useRoute();
type AdminRow = { [key: string]: any; id: number };
const { can } = useSystemAccess(
  () => props.resource,
  () => route.meta.permissionCode,
);
const info = computed(() => ({ title: String(route.meta.title ?? '管理') }));
const serverPaged = computed(
  () => props.resource === 'users' || props.resource === 'roles',
);
const fields = computed(() => getResourceFields(props.resource));
const records = ref<AdminRow[]>([]);
const loading = ref(false);
const listFailed = ref(false);
const working = ref(false);
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });
const filters = reactive({
  keyword: '',
  mobile: '',
  departmentId: undefined as number | undefined,
  roleId: undefined as number | undefined,
  enabled: undefined as '0' | '1' | undefined,
});
let appliedFilters: Record<string, unknown> = {};
let listRequest = 0;

function flatten(items: AdminRow[]): AdminRow[] {
  return items.flatMap(({ children, ...item }) => [
    item as AdminRow,
    ...flatten(children ?? []),
  ]);
}
const dataSource = computed(() => {
  if (serverPaged.value || !appliedKeyword.value) return records.value;
  const keyword = appliedKeyword.value.toLowerCase();
  return records.value.filter((row) =>
    ['name', 'code', 'path', 'permissionCode'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(keyword),
    ),
  );
});
const appliedKeyword = ref('');
const columns = computed<TableColumnsType<AdminRow>>(() => {
  const keys =
    props.resource === 'users'
      ? [
          ['username', '登录名'],
          ['realName', '真实姓名'],
          ['nickname', '昵称'],
          ['mobile', '联系电话'],
          ['departmentId', '部门'],
          ['enabled', '状态'],
          ['passwordResetRequired', '需要改密'],
          ['lastLoginAt', '最近登录'],
        ]
      : [
          ['name', '名称'],
          ...(props.resource === 'menus'
            ? [
                ['path', '路由地址'],
                ['permissionCode', '权限标识'],
                ['menuType', '类型'],
              ]
            : [['code', '编码']]),
          ...(props.resource === 'permissions'
            ? [
                ['permissionType', '类型'],
                ['menuId', '关联菜单'],
              ]
            : []),
          ...(['departments', 'menus', 'permissions'].includes(props.resource)
            ? [['parentId', '上级']]
            : []),
          ...(['menus', 'permissions'].includes(props.resource)
            ? [
                ['moduleId', '模块'],
                ['hidden', '隐藏'],
              ]
            : []),
          ['enabled', '状态'],
          ['sortOrder', '排序号'],
          ['remark', '备注'],
        ];
  return [
    { dataIndex: 'id', title: 'ID', width: 90 },
    ...keys.map(([key, label]) => ({
      dataIndex: key ?? '',
      title: label ?? '',
      width: key === 'lastLoginAt' ? 190 : 150,
      ellipsis: true,
    })),
    {
      key: 'action',
      title: '操作',
      fixed: 'right',
      width:
        ({ users: 380, roles: 300 } as Partial<Record<SystemResource, number>>)[
          props.resource
        ] ?? 190,
    },
  ];
});

async function loadList(
  page = pagination.current,
  pageSize = pagination.pageSize,
) {
  const request = ++listRequest;
  loading.value = true;
  listFailed.value = false;
  try {
    const data = await getSystemResourceListApi(
      props.resource,
      serverPaged.value ? { ...appliedFilters, page, pageSize } : {},
    );
    if (request !== listRequest) return;
    if (Array.isArray(data)) {
      records.value = flatten(data as AdminRow[]);
      pagination.current = page;
      pagination.pageSize = pageSize;
      pagination.total = records.value.length;
    } else {
      records.value = data.records as AdminRow[];
      pagination.current = data.page;
      pagination.pageSize = data.pageSize;
      pagination.total = data.total;
    }
  } catch {
    if (request === listRequest) listFailed.value = true;
  } finally {
    if (request === listRequest) loading.value = false;
  }
}
function search() {
  appliedKeyword.value = filters.keyword.trim();
  appliedFilters = { keyword: filters.keyword.trim() || undefined };
  if (props.resource === 'users')
    Object.assign(appliedFilters, {
      mobile: filters.mobile.trim() || undefined,
      departmentId: filters.departmentId,
      roleId: filters.roleId,
      enabled:
        filters.enabled === undefined ? undefined : filters.enabled === '1',
    });
  void loadList(1);
}
function reset() {
  Object.assign(filters, {
    keyword: '',
    mobile: '',
    departmentId: undefined,
    roleId: undefined,
    enabled: undefined,
  });
  search();
}
function changePage(value: TablePaginationConfig) {
  const pageSize = value.pageSize ?? pagination.pageSize;
  const page = pageSize === pagination.pageSize ? (value.current ?? 1) : 1;
  if (serverPaged.value) void loadList(page, pageSize);
  else Object.assign(pagination, { current: page, pageSize });
}

const relations = reactive<Partial<Record<SystemResource, AdminRow[]>>>({});
const relationLoading = ref(false);
const relationFailures = ref<SystemResource[]>([]);
let relationRequest = 0;
async function loadRelations(resources: SystemResource[]) {
  const request = ++relationRequest;
  relationLoading.value = true;
  relationFailures.value = [];
  await Promise.all(
    [...new Set(resources)].map(async (resource) => {
      if (!can(resource, 'read')) return;
      try {
        const data =
          resource === 'roles'
            ? await getSystemRoleOptionsApi()
            : await getSystemResourceListApi(resource);
        if (request !== relationRequest) return;
        relations[resource] = flatten(
          (Array.isArray(data) ? data : data.records) as AdminRow[],
        );
      } catch {
        if (request === relationRequest) relationFailures.value.push(resource);
      }
    }),
  );
  if (request === relationRequest) relationLoading.value = false;
}
function relationOptions(resource: SystemResource) {
  return (relations[resource] ?? []).map((row) => ({
    label: String(row.name || row.realName || row.username || row.id),
    value: row.id,
  }));
}
function optionsFor(field: ResourceField) {
  if (!field.relation) return field.options ?? [];
  let options = relationOptions(field.relation);
  if (
    field.key === 'parentId' &&
    selectedId.value !== undefined &&
    field.relation === props.resource
  ) {
    const excluded = new Set([selectedId.value]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const row of relations[field.relation] ?? []) {
        if (excluded.has(row.parentId) && !excluded.has(row.id)) {
          excluded.add(row.id);
          changed = true;
        }
      }
    }
    options = options.filter((option) => !excluded.has(option.value));
  }
  const selected: number[] = [];
  const value = form[field.key];
  if (Array.isArray(value)) selected.push(...value);
  else if (value !== null && value !== undefined) selected.push(value);
  return [
    ...options,
    ...selected
      .filter((id) => !options.some((option) => option.value === id))
      .map((value) => ({ label: `ID: ${value}`, value })),
  ];
}

const modalOpen = ref(false);
const mode = ref<'add' | 'detail' | 'edit' | 'grants' | 'password' | 'roles'>(
  'add',
);
const selectedId = ref<number>();
const selectedLabel = ref('');
const form = reactive<Record<string, any>>({});
const formRef = ref<FormInstance>();
const detailLoading = ref(false);
const detailFailed = ref(false);
let detailRequest = 0;
const entityMode = computed(() =>
  ['add', 'detail', 'edit'].includes(mode.value),
);
const activeFields = computed(() =>
  fields.value.filter((field) =>
    mode.value === 'add' ? !field.editOnly : !field.createOnly,
  ),
);
const readonly = computed(() => mode.value === 'detail');
const modalTitle = computed(
  () =>
    ({
      add: '新增',
      edit: '编辑',
      detail: '详情',
      roles: '分配角色',
      password: '重置密码',
      grants: '配置授权',
    })[mode.value] +
    (selectedLabel.value ? `：${selectedLabel.value}` : info.value.title),
);
const requiredRelations = computed<SystemResource[]>(() => {
  if (mode.value === 'password') return [];
  if (mode.value === 'roles') return ['roles'];
  if (mode.value === 'grants') return ['menus', 'permissions', 'modules'];
  return activeFields.value.flatMap((field) =>
    field.relation ? [field.relation] : [],
  );
});
const saveDisabled = computed(
  () =>
    detailLoading.value ||
    detailFailed.value ||
    relationLoading.value ||
    relationFailures.value.length > 0 ||
    (['grants', 'roles'].includes(mode.value) &&
      requiredRelations.value.some((resource) => !can(resource, 'read'))),
);

function rulesFor(field: ResourceField) {
  if (field.type === 'password') return passwordRules;
  return [
    ...(field.required
      ? [{ required: true, message: `请填写${field.label}` }]
      : []),
    ...(field.type === 'text' && field.required
      ? [{ whitespace: true, message: `请填写${field.label}` }]
      : []),
    ...(field.pattern
      ? [
          {
            pattern: field.pattern,
            transform: (value: unknown) =>
              typeof value === 'string' ? value.trim() : value,
            message: `${field.label}格式不正确`,
          },
        ]
      : []),
    ...(field.type === 'number'
      ? [
          {
            type: 'integer' as const,
            min: field.min ?? 0,
            max: 2_147_483_647,
            message: '请输入有效的非负整数',
          },
        ]
      : []),
  ];
}
async function openModal(nextMode: typeof mode.value, id?: number) {
  const request = ++detailRequest;
  mode.value = nextMode;
  selectedId.value = id;
  const row = records.value.find((item) => item.id === id);
  selectedLabel.value = row?.name || row?.realName || row?.username || '';
  Object.keys(form).forEach((key) => delete form[key]);
  for (const field of fields.value) {
    switch (field.type) {
      case 'boolean': {
        form[field.key] = field.key === 'enabled';
        break;
      }
      case 'multi': {
        form[field.key] = [];
        break;
      }
      case 'number': {
        form[field.key] = 0;
        break;
      }
      case 'select': {
        form[field.key] = field.relation ? null : field.options?.[0]?.value;
        break;
      }
      default: {
        form[field.key] = '';
      }
    }
  }
  Object.assign(form, {
    newPassword: '',
    roleIds: [],
    menuIds: [],
    permissionIds: [],
    moduleIds: [],
  });
  detailFailed.value = false;
  detailLoading.value = true;
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
  try {
    let details: Promise<null | Record<string, any>> = Promise.resolve(null);
    if (id !== undefined && nextMode !== 'password') {
      details =
        nextMode === 'grants'
          ? getSystemRoleGrantsApi(id)
          : getSystemResourceDetailsApi(props.resource, id);
    }
    const [detail] = await Promise.all([
      details,
      loadRelations(requiredRelations.value),
    ]);
    if (request !== detailRequest) return;
    if (detail) Object.assign(form, detail);
  } catch {
    if (request === detailRequest) detailFailed.value = true;
  } finally {
    if (request === detailRequest) detailLoading.value = false;
  }
}
function closeModal() {
  if (working.value) return;
  ++detailRequest;
  ++relationRequest;
  relationLoading.value = false;
  modalOpen.value = false;
}
async function refreshAfterChange() {
  await loadList();
  const total = serverPaged.value ? pagination.total : dataSource.value.length;
  const lastPage = Math.max(1, Math.ceil(total / pagination.pageSize));
  if (pagination.current > lastPage) await loadList(lastPage);
}
async function save() {
  if (working.value || readonly.value || saveDisabled.value) return;
  working.value = true;
  try {
    await formRef.value?.validate();
  } catch {
    working.value = false;
    return;
  }
  try {
    const id = selectedId.value;
    if (mode.value === 'roles' && id !== undefined)
      await assignSystemUserRolesApi(id, [...form.roleIds]);
    else if (mode.value === 'password' && id !== undefined)
      await resetSystemUserPasswordApi(id, form.newPassword);
    else if (mode.value === 'grants' && id !== undefined)
      await updateSystemRoleGrantsApi(id, {
        menuIds: [...form.menuIds],
        permissionIds: [...form.permissionIds],
        moduleIds: [...form.moduleIds],
      });
    else {
      const data = Object.fromEntries(
        activeFields.value.map((field) => {
          const value = form[field.key];
          return [
            field.key,
            typeof value === 'string' && field.type !== 'password'
              ? value.trim()
              : (value ?? null),
          ];
        }),
      );
      if (mode.value === 'add')
        await createSystemResourceApi(props.resource, data);
      else if (id !== undefined)
        await updateSystemResourceApi(props.resource, id, data);
    }
    message.success('保存成功');
    modalOpen.value = false;
    form.password = '';
    form.newPassword = '';
    await refreshAfterChange();
  } catch {
    // 统一显示接口错误，保留表单供重试。
  } finally {
    working.value = false;
  }
}
async function remove(id: number) {
  if (working.value) return;
  working.value = true;
  try {
    await deleteSystemResourceApi(props.resource, id);
    message.success('删除成功');
    await refreshAfterChange();
  } catch {
    /* 请求拦截器统一展示错误。 */
  } finally {
    working.value = false;
  }
}
async function toggleStatus(id: number, enabled: boolean) {
  if (
    working.value ||
    (props.resource !== 'users' && props.resource !== 'roles')
  )
    return;
  working.value = true;
  try {
    await updateSystemStatusApi(props.resource, id, !enabled);
    message.success('状态修改成功');
    await refreshAfterChange();
  } catch {
    /* 请求拦截器统一展示错误。 */
  } finally {
    working.value = false;
  }
}
function labelFor(key: string, value: any) {
  if (key === 'menuType' || key === 'permissionType')
    return typeOptions.find((option) => option.value === value)?.label ?? value;
  const relatedResources: Record<string, SystemResource> = {
    departmentId: 'departments',
    moduleId: 'modules',
    menuId: 'menus',
    parentId: props.resource,
  };
  const resource = relatedResources[key];
  return resource && value !== null && value !== undefined
    ? (relationOptions(resource).find((option) => option.value === value)
        ?.label ?? value)
    : (value ?? '—');
}
onMounted(() => {
  void loadList();
  if (props.resource === 'users') void loadRelations(['departments', 'roles']);
});
</script>

<template>
  <Page :title="info.title">
    <Card class="filter-card" title="筛选条件">
      <Form
        name="system-filter"
        :model="filters"
        layout="vertical"
        @finish="search"
      >
        <Row :gutter="16">
          <Col :xs="24" :sm="12" :lg="6" :xl="3">
            <FormItem label="关键字" name="keyword">
              <Input
                v-model:value="filters.keyword"
                :maxlength="64"
                allow-clear
                :placeholder="
                  resource === 'users'
                    ? '登录名、姓名或拼音'
                    : '名称、编码或路由'
                "
              />
            </FormItem>
          </Col>
          <template v-if="resource === 'users'">
            <Col :xs="24" :sm="12" :lg="6" :xl="3">
              <FormItem label="联系电话">
                <Input
                  v-model:value="filters.mobile"
                  :maxlength="32"
                  allow-clear
                />
              </FormItem>
            </Col>
            <Col :xs="24" :sm="12" :lg="6" :xl="3">
              <FormItem label="部门">
                <Select
                  v-model:value="filters.departmentId"
                  :options="relationOptions('departments')"
                  allow-clear
                  placeholder="全部"
                />
              </FormItem>
            </Col>
            <Col :xs="24" :sm="12" :lg="6" :xl="3">
              <FormItem label="角色">
                <Select
                  v-model:value="filters.roleId"
                  :options="relationOptions('roles')"
                  allow-clear
                  placeholder="全部"
                />
              </FormItem>
            </Col>
            <Col :xs="24" :sm="12" :lg="6" :xl="3">
              <FormItem label="状态">
                <Select
                  v-model:value="filters.enabled"
                  :options="[
                    { label: '启用', value: '1' },
                    { label: '停用', value: '0' },
                  ]"
                  allow-clear
                  placeholder="全部"
                />
              </FormItem>
            </Col>
          </template>
        </Row>
        <div class="flex justify-end">
          <Space>
            <Button html-type="submit" type="primary" :loading="loading">
              查询
            </Button>
            <Button @click="reset">重置</Button>
          </Space>
        </div>
      </Form>
    </Card>
    <Card :title="info.title">
      <template #extra>
        <Space>
          <Button :loading="loading" @click="loadList()">刷新</Button>
          <Button
            v-if="can(resource, 'create')"
            type="primary"
            @click="openModal('add')"
          >
            新增
          </Button>
        </Space>
      </template>
      <Alert
        v-if="listFailed"
        class="mb-4"
        message="列表加载失败，请刷新重试"
        type="error"
        show-icon
      />
      <Table
        :columns="columns"
        :data-source="dataSource"
        :loading="loading"
        :pagination="{
          ...pagination,
          total: serverPaged ? pagination.total : dataSource.length,
          showSizeChanger: true,
          pageSizeOptions: ['20', '50', '100'],
          showTotal: (total) => `共 ${total} 条`,
        }"
        :scroll="{ x: 1800 }"
        row-key="id"
        @change="changePage"
      >
        <template #bodyCell="{ column, record, text }">
          <Space v-if="column.key === 'action'" :size="0">
            <Button
              size="small"
              type="link"
              @click="openModal('detail', record.id)"
            >
              详情
            </Button>
            <Button
              v-if="can(resource, 'update')"
              size="small"
              type="link"
              @click="openModal('edit', record.id)"
            >
              编辑
            </Button>
            <Button
              v-if="resource === 'users' && can(resource, 'assign-role')"
              size="small"
              type="link"
              @click="openModal('roles', record.id)"
            >
              角色
            </Button>
            <Button
              v-if="resource === 'users' && can(resource, 'reset-password')"
              size="small"
              type="link"
              @click="openModal('password', record.id)"
            >
              重置密码
            </Button>
            <Button
              v-if="resource === 'roles' && can(resource, 'grant')"
              size="small"
              type="link"
              @click="openModal('grants', record.id)"
            >
              授权
            </Button>
            <Popconfirm
              v-if="
                (resource === 'users' || resource === 'roles') &&
                can(resource, 'status')
              "
              :title="`确定${record.enabled ? '停用' : '启用'}此记录吗？`"
              :disabled="working"
              @confirm="toggleStatus(record.id, record.enabled)"
            >
              <Button type="link" size="small" :disabled="working">
                {{ record.enabled ? '停用' : '启用' }}
              </Button>
            </Popconfirm>
            <Popconfirm
              v-if="can(resource, 'delete')"
              title="确定删除此记录吗？"
              :disabled="working"
              @confirm="remove(record.id)"
            >
              <Button type="link" size="small" danger :disabled="working">
                删除
              </Button>
            </Popconfirm>
          </Space>
          <Tag
            v-else-if="column.dataIndex === 'enabled'"
            :color="text ? 'success' : 'default'"
          >
            {{ text ? '启用' : '停用' }}
          </Tag>
          <template
            v-else-if="
              column.dataIndex === 'hidden' ||
              column.dataIndex === 'passwordResetRequired'
            "
          >
            {{ text ? '是' : '否' }}
          </template>
          <template v-else>
            {{ labelFor(String(column.dataIndex), text) }}
          </template>
        </template>
      </Table>
    </Card>
    <Modal
      :open="modalOpen"
      :title="modalTitle"
      :width="760"
      :mask-closable="false"
      :closable="!working"
      :keyboard="!working"
      @cancel="closeModal"
    >
      <Spin :spinning="detailLoading || relationLoading">
        <Alert
          v-if="detailFailed"
          message="详情加载失败，请重试"
          type="error"
          show-icon
        >
          <template #action>
            <Button size="small" @click="openModal(mode, selectedId)">
              重试详情
            </Button>
          </template>
        </Alert>
        <Alert
          v-if="relationFailures.length > 0"
          class="mb-4"
          message="关联选项加载失败，请重试"
          type="error"
          show-icon
        >
          <template #action>
            <Button size="small" @click="loadRelations(requiredRelations)">
              重试选项
            </Button>
          </template>
        </Alert>
        <Alert
          v-if="
            (mode === 'roles' || mode === 'grants') &&
            requiredRelations.some((item) => !can(item, 'read'))
          "
          class="mb-4"
          message="当前账号缺少读取授权选项的权限，请联系管理员"
          type="warning"
          show-icon
        />
        <Alert
          v-if="mode === 'roles' || mode === 'password'"
          class="mb-4"
          message="保存后将撤销该用户的现有会话，需要重新登录"
          type="info"
          show-icon
        />
        <Form
          v-if="!detailFailed"
          ref="formRef"
          name="system-editor"
          :model="form"
          :disabled="readonly || detailLoading || working || relationLoading"
          layout="vertical"
        >
          <Row v-if="entityMode" :gutter="16">
            <Col
              v-for="field in activeFields"
              :key="field.key"
              :xs="24"
              :sm="field.type === 'textarea' ? 24 : 12"
            >
              <FormItem
                :label="field.label"
                :name="field.key"
                :rules="rulesFor(field)"
              >
                <Switch
                  v-if="field.type === 'boolean'"
                  v-model:checked="form[field.key]"
                />
                <InputNumber
                  v-else-if="field.type === 'number'"
                  v-model:value="form[field.key]"
                  :min="field.min ?? 0"
                  :max="2147483647"
                  :precision="0"
                  class="w-full"
                />
                <Input.Password
                  v-else-if="field.type === 'password'"
                  v-model:value="form[field.key]"
                  autocomplete="new-password"
                />
                <Input.TextArea
                  v-else-if="field.type === 'textarea'"
                  v-model:value="form[field.key]"
                  :maxlength="field.max"
                  :rows="3"
                />
                <Select
                  v-else-if="field.type === 'select' || field.type === 'multi'"
                  v-model:value="form[field.key]"
                  :mode="field.type === 'multi' ? 'multiple' : undefined"
                  :options="optionsFor(field)"
                  :disabled="
                    field.relation && !can(field.relation, 'read')
                      ? true
                      : undefined
                  "
                  max-tag-count="responsive"
                  :allow-clear="!field.required"
                  show-search
                  option-filter-prop="label"
                />
                <Input
                  v-else
                  v-model:value="form[field.key]"
                  :maxlength="field.max"
                  :placeholder="
                    field.key === 'path' ? '请输入页面组件标识' : undefined
                  "
                />
              </FormItem>
            </Col>
          </Row>
          <FormItem v-else-if="mode === 'roles'" label="角色" name="roleIds">
            <Select
              v-model:value="form.roleIds"
              mode="multiple"
              :options="relationOptions('roles')"
              show-search
              option-filter-prop="label"
            />
          </FormItem>
          <FormItem
            v-else-if="mode === 'password'"
            label="临时密码"
            name="newPassword"
            :rules="passwordRules"
          >
            <Input.Password
              v-model:value="form.newPassword"
              autocomplete="new-password"
            />
          </FormItem>
          <template v-else-if="mode === 'grants'">
            <Alert
              class="mb-4"
              message="菜单可见性、功能权限和模块访问分别配置，保存会替换全部授权；清空表示移除授权"
              type="info"
              show-icon
            />
            <FormItem label="可见菜单" name="menuIds">
              <Select
                v-model:value="form.menuIds"
                mode="multiple"
                :options="relationOptions('menus')"
                show-search
                option-filter-prop="label"
              />
            </FormItem>
            <FormItem label="功能权限" name="permissionIds">
              <Select
                v-model:value="form.permissionIds"
                mode="multiple"
                :options="relationOptions('permissions')"
                show-search
                option-filter-prop="label"
              />
            </FormItem>
            <FormItem label="可见模块" name="moduleIds">
              <Select
                v-model:value="form.moduleIds"
                mode="multiple"
                :options="relationOptions('modules')"
                show-search
                option-filter-prop="label"
              />
            </FormItem>
          </template>
        </Form>
      </Spin>
      <template #footer>
        <Button :disabled="working" @click="closeModal">
          {{ readonly ? '关闭' : '取消' }}
        </Button>
        <Button
          v-if="!readonly"
          type="primary"
          :loading="working"
          :disabled="saveDisabled"
          @click="save"
        >
          保存
        </Button>
      </template>
    </Modal>
  </Page>
</template>
