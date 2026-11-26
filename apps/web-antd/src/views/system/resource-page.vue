<script setup lang="ts">
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type { AdminRow, EditorMode } from './resource-types';

import type { SystemResource } from '#/api';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  FormItem,
  Input,
  message,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  deleteSystemResourceApi,
  getSystemMenuTreeApi,
  getSystemResourceListApi,
  updateSystemStatusApi,
} from '#/api';
import { useAuthStore } from '#/store';

import { useSystemAccess } from './access';
import {
  buildMenuTree,
  filterMenuTree,
  menuBranchIds,
  menuRowKey,
} from './menu-tree';
import { typeOptions } from './resource-config';
import ResourceEditor from './resource-editor.vue';
import { flattenResources as flatten } from './resource-types';
import { useResourceRelations } from './use-resource-relations';

const props = defineProps<{ resource: SystemResource }>();
const route = useRoute();
const auth = useAuthStore();
const { can } = useSystemAccess(
  () => props.resource,
  () => route.meta.permissionCode,
);
const info = computed(() => ({ title: String(route.meta.title ?? '管理') }));
const isMenu = computed(() => props.resource === 'menus');
const selectedModule = ref(0);
const menuModules = ref<AdminRow[]>([]);
const modulesLoading = ref(false);
const modulesFailed = ref(false);
const expandedKeys = ref<(number | string)[]>([]);
let treeInitialized = false;
const serverPaged = computed(
  () => props.resource === 'users' || props.resource === 'roles',
);
const records = ref<AdminRow[]>([]);
const loading = ref(false);
const listFailed = ref(false);
const mutating = ref(false);
const working = computed(() => mutating.value || editorWorking.value);
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

function rowResource(row: AdminRow): SystemResource {
  return isMenu.value && row.nodeType === 'PERMISSION'
    ? 'permissions'
    : props.resource;
}
const dataSource = computed(() => {
  if (isMenu.value)
    return filterMenuTree(
      records.value,
      appliedKeyword.value,
      selectedModule.value,
    );
  if (serverPaged.value || !appliedKeyword.value) return records.value;
  const keyword = appliedKeyword.value.toLowerCase();
  return records.value.filter((row) =>
    (['name', 'code', 'path', 'permissionCode'] as const).some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(keyword),
    ),
  );
});
const appliedKeyword = ref('');
const columns = computed<TableColumnsType<AdminRow>>(() => {
  if (isMenu.value)
    return [
      { dataIndex: 'name', title: '菜单/权限名称', width: 260, fixed: 'left' },
      { dataIndex: 'nodeType', title: '来源', width: 90, align: 'center' },
      { dataIndex: 'icon', title: '图标', width: 80, align: 'center' },
      { dataIndex: 'sortOrder', title: '排序', width: 80, align: 'center' },
      { dataIndex: 'type', title: '类型', width: 110, align: 'center' },
      { dataIndex: 'hidden', title: '可见性', width: 90, align: 'center' },
      { dataIndex: 'path', title: '路由地址', width: 250, ellipsis: true },
      {
        dataIndex: 'permissionCode',
        title: '权限标识',
        width: 240,
        ellipsis: true,
      },
      { dataIndex: 'remark', title: '备注', width: 220, ellipsis: true },
      { dataIndex: 'enabled', title: '状态', width: 90, align: 'center' },
      { key: 'action', title: '操作', width: 330, fixed: 'right' },
    ];
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
    const data = isMenu.value
      ? await getSystemMenuTreeApi()
      : await getSystemResourceListApi(
          props.resource,
          serverPaged.value ? { ...appliedFilters, page, pageSize } : {},
        );
    if (request !== listRequest) return;
    if (Array.isArray(data)) {
      records.value = isMenu.value
        ? buildMenuTree(data as AdminRow[])
        : flatten(data as AdminRow[]);
      pagination.current = page;
      pagination.pageSize = pageSize;
      pagination.total = records.value.length;
    } else {
      records.value = data.records as AdminRow[];
      pagination.current = data.page;
      pagination.pageSize = data.pageSize;
      pagination.total = data.total;
    }
    if (isMenu.value) {
      const branchIds = menuBranchIds(records.value);
      expandedKeys.value = treeInitialized
        ? expandedKeys.value.filter((id) => branchIds.includes(id))
        : records.value
            .filter((row) => row.children?.length)
            .map((row) => menuRowKey(row));
      treeInitialized = true;
    }
  } catch {
    if (request === listRequest) listFailed.value = true;
  } finally {
    if (request === listRequest) loading.value = false;
  }
}
function search() {
  appliedKeyword.value = filters.keyword.trim();
  if (isMenu.value) {
    expandMenus();
    return;
  }
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
  if (isMenu.value) selectedModule.value = 0;
  Object.assign(filters, {
    keyword: '',
    mobile: '',
    departmentId: undefined,
    roleId: undefined,
    enabled: undefined,
  });
  search();
}
function expandMenus() {
  expandedKeys.value = menuBranchIds(dataSource.value);
}
function onExpandedRowsChange(keys: (number | string)[]) {
  if (isMenu.value) expandedKeys.value = keys;
}
async function loadMenuModules() {
  if (!can('modules', 'read')) return;
  modulesLoading.value = true;
  modulesFailed.value = false;
  try {
    const data = await getSystemResourceListApi('modules');
    menuModules.value = Array.isArray(data) ? data : data.records;
  } catch {
    modulesFailed.value = true;
  } finally {
    modulesLoading.value = false;
  }
}
const menuModuleOptions = computed(() => {
  const modules = new Map(menuModules.value.map((row) => [row.id, row]));
  for (const row of flatten(records.value)) {
    if (
      row.moduleId !== null &&
      row.moduleId !== undefined &&
      !modules.has(row.moduleId)
    )
      modules.set(row.moduleId, {
        id: row.moduleId,
        name: `模块 ID: ${row.moduleId}`,
      });
  }
  return [...modules.values()].toSorted(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
});
const hasUnassignedMenus = computed(() =>
  flatten(records.value).some(
    (row) => row.moduleId === null || row.moduleId === undefined,
  ),
);
function changePage(value: TablePaginationConfig) {
  const pageSize = value.pageSize ?? pagination.pageSize;
  const page = pageSize === pagination.pageSize ? (value.current ?? 1) : 1;
  if (serverPaged.value) void loadList(page, pageSize);
  else Object.assign(pagination, { current: page, pageSize });
}

const { load: loadRelations, options: relationOptions } =
  useResourceRelations(can);
async function refreshAfterChange() {
  await loadList();
  const total = serverPaged.value ? pagination.total : dataSource.value.length;
  const lastPage = Math.max(1, Math.ceil(total / pagination.pageSize));
  if (pagination.current > lastPage) await loadList(lastPage);
}
const editor = ref<InstanceType<typeof ResourceEditor>>();
const editorWorking = ref(false);
function openModal(
  mode: EditorMode,
  id?: number,
  parent?: AdminRow,
  targetResource = props.resource,
) {
  if (!working.value) void editor.value?.open(mode, id, parent, targetResource);
}
async function saved(change: {
  mode: EditorMode;
  parentKey?: number | string;
  resource: SystemResource;
}) {
  mutating.value = true;
  try {
    if (change.parentKey !== undefined)
      expandedKeys.value = [
        ...new Set([...expandedKeys.value, change.parentKey]),
      ];
    await refreshAfterChange();
    await refreshNavigation(change.resource, change.mode);
  } finally {
    mutating.value = false;
  }
}
async function remove(id: number, targetResource = props.resource) {
  if (working.value) return;
  mutating.value = true;
  try {
    await deleteSystemResourceApi(targetResource, id);
    message.success('删除成功');
    await refreshAfterChange();
    await refreshNavigation(targetResource);
  } catch {
    /* 请求拦截器统一展示错误。 */
  } finally {
    mutating.value = false;
  }
}
async function toggleStatus(id: number, enabled: boolean) {
  if (
    working.value ||
    (props.resource !== 'users' && props.resource !== 'roles')
  )
    return;
  mutating.value = true;
  try {
    await updateSystemStatusApi(props.resource, id, !enabled);
    message.success('状态修改成功');
    await refreshAfterChange();
    await refreshNavigation();
  } catch {
    /* 请求拦截器统一展示错误。 */
  } finally {
    mutating.value = false;
  }
}
async function refreshNavigation(resource = props.resource, mode?: EditorMode) {
  if (
    ['menus', 'modules', 'permissions', 'roles'].includes(resource) ||
    (resource === 'users' && mode === 'roles')
  )
    await auth.refreshAccess();
}
function labelFor(key: string, value: unknown) {
  if (key === 'menuType' || key === 'permissionType' || key === 'type')
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
  if (isMenu.value) void loadMenuModules();
  if (props.resource === 'users') void loadRelations(['departments', 'roles']);
});
</script>

<template>
  <Page :title="info.title">
    <Card v-if="isMenu" class="filter-card">
      <div class="flex flex-wrap items-center gap-4">
        <Button
          v-if="can(resource, 'create')"
          type="primary"
          @click="openModal('add')"
        >
          新增
        </Button>
        <span class="shrink-0">模块：</span>
        <div class="min-w-0 flex-1 overflow-x-auto">
          <Radio.Group
            v-model:value="selectedModule"
            class="whitespace-nowrap"
            button-style="solid"
            @change="expandMenus"
          >
            <Radio.Button :value="0">全部</Radio.Button>
            <Radio.Button
              v-for="item in menuModuleOptions"
              :key="item.id"
              :value="item.id"
            >
              {{ item.name }}
            </Radio.Button>
            <Radio.Button v-if="hasUnassignedMenus" :value="-1">
              未分配模块
            </Radio.Button>
          </Radio.Group>
        </div>
      </div>
      <div class="mt-4 flex flex-wrap items-center gap-3">
        <Input.Search
          v-model:value="filters.keyword"
          class="w-full max-w-80"
          :maxlength="128"
          placeholder="搜索菜单、权限名称、路由或权限标识"
          allow-clear
          enter-button="查询"
          @search="search"
        />
        <Button @click="reset">重置</Button>
        <span v-if="modulesLoading" class="text-sm">模块加载中…</span>
      </div>
      <Alert
        v-if="modulesFailed"
        class="mt-4"
        message="模块加载失败，请重试"
        type="error"
        show-icon
      >
        <template #action>
          <Button size="small" @click="loadMenuModules">重试模块</Button>
        </template>
      </Alert>
    </Card>
    <Card v-else class="filter-card" title="筛选条件">
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
          <template v-if="isMenu">
            <Button @click="expandMenus">展开全部</Button>
            <Button @click="expandedKeys = []">收起全部</Button>
          </template>
          <Button :loading="loading" @click="loadList()">刷新</Button>
          <Button
            v-if="!isMenu && can(resource, 'create')"
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
        :pagination="
          isMenu
            ? false
            : {
                ...pagination,
                total: serverPaged ? pagination.total : dataSource.length,
                showSizeChanger: true,
                pageSizeOptions: ['20', '50', '100'],
                showTotal: (total) => `共 ${total} 条`,
              }
        "
        :scroll="{ x: 1800 }"
        :bordered="isMenu"
        :indent-size="24"
        :expanded-row-keys="isMenu ? expandedKeys : undefined"
        :row-key="isMenu ? menuRowKey : 'id'"
        @change="changePage"
        @expanded-rows-change="onExpandedRowsChange"
      >
        <template #bodyCell="{ column, record, text }">
          <Space v-if="column.key === 'action'" :size="0">
            <Button
              v-if="
                rowResource(record as AdminRow) !== 'permissions' ||
                can('permissions', 'read')
              "
              size="small"
              type="link"
              @click="
                openModal(
                  'detail',
                  record.id,
                  undefined,
                  rowResource(record as AdminRow),
                )
              "
            >
              详情
            </Button>
            <Button
              v-if="can(rowResource(record as AdminRow), 'update')"
              size="small"
              type="link"
              @click="
                openModal(
                  'edit',
                  record.id,
                  undefined,
                  rowResource(record as AdminRow),
                )
              "
            >
              编辑
            </Button>
            <Button
              v-if="
                isMenu &&
                record.nodeType === 'MENU' &&
                record.type !== 3 &&
                can('menus', 'create')
              "
              size="small"
              type="link"
              @click="openModal('add', undefined, record as AdminRow)"
            >
              新增子菜单
            </Button>
            <Button
              v-if="isMenu && record.type !== 3 && can('permissions', 'create')"
              size="small"
              type="link"
              @click="
                openModal('add', undefined, record as AdminRow, 'permissions')
              "
            >
              {{ record.nodeType === 'PERMISSION' ? '新增子权限' : '新增权限' }}
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
              v-if="can(rowResource(record as AdminRow), 'delete')"
              title="确定删除此记录吗？"
              :disabled="working"
              @confirm="remove(record.id, rowResource(record as AdminRow))"
            >
              <Button type="link" size="small" danger :disabled="working">
                删除
              </Button>
            </Popconfirm>
          </Space>
          <template v-else-if="isMenu && column.dataIndex === 'icon'">
            <IconifyIcon
              v-if="text"
              :icon="text"
              class="mx-auto size-5"
              :title="text"
            />
            <span v-else>—</span>
          </template>
          <Tag
            v-else-if="isMenu && column.dataIndex === 'nodeType'"
            :color="text === 'PERMISSION' ? 'orange' : 'cyan'"
          >
            {{ text === 'PERMISSION' ? '权限' : '菜单' }}
          </Tag>
          <Tag
            v-else-if="isMenu && column.dataIndex === 'type'"
            :color="{ 1: 'purple', 2: 'green', 3: 'blue' }[text as 1 | 2 | 3]"
          >
            {{ labelFor('type', text) }}
          </Tag>
          <Tag
            v-else-if="isMenu && column.dataIndex === 'hidden'"
            :color="text ? 'error' : 'success'"
          >
            {{ text ? '隐藏' : '显示' }}
          </Tag>
          <template v-else-if="isMenu && column.dataIndex === 'path'">
            {{ text || '无' }}
          </template>
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
    <ResourceEditor
      ref="editor"
      :resource="resource"
      :records="records"
      :selected-module="selectedModule"
      @busy="editorWorking = $event"
      @saved="saved"
    />
  </Page>
</template>
