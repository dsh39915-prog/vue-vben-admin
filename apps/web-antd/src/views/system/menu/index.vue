<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';

import type { MenuRecord, SimpleMenuRecord } from '#/api';

import { computed, onUnmounted, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Alert,
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
  Spin,
  Switch,
  Table,
  Tag,
  TreeSelect,
} from 'ant-design-vue';

import {
  createMenuApi,
  deleteMenuApi,
  deleteMenuListApi,
  getAllSimpleMenuListApi,
  getMenuApi,
  getMenuListApi,
  updateMenuApi,
} from '#/api';
import { useSystemAccess } from '#/features/system/access';
import { buildSystemTree } from '#/features/system/tree';

const has = useSystemAccess();
const canRead = computed(() => has('system:menu:query'));
const loading = ref(false);
const saving = ref(false);
const failed = ref(false);
const rows = ref<(MenuRecord & { id: number })[]>([]);
const selected = ref<number[]>([]);
const query = reactive({ name: '', status: undefined as 0 | 1 | undefined });
const applied = ref<{ name?: string; status?: 0 | 1 }>({});
const expanded = ref<number[]>([]);
const tree = computed(() => buildSystemTree(rows.value));
const editorOpen = ref(false);
const editorLoading = ref(false);
const editorFailed = ref(false);
const editorLoaded = ref(false);
const parentMenus = ref<SimpleMenuRecord[]>([]);
const editingId = ref<number>();
const formRef = ref<FormInstance>();
const defaults = (): MenuRecord => ({
  name: '',
  parentId: 0,
  sort: 0,
  status: 0,
  type: 1,
  visible: true,
  keepAlive: false,
  alwaysShow: true,
  path: '',
  component: '',
  componentName: '',
  permission: '',
  icon: '',
});
const form = reactive<MenuRecord>(defaults());
const writeCode = computed(() =>
  editingId.value ? 'system:menu:update' : 'system:menu:create',
);
const canSave = computed(
  () =>
    canRead.value &&
    has(writeCode.value) &&
    editorLoaded.value &&
    !editorLoading.value &&
    !saving.value,
);
const statusOptions = [
  { label: '正常', value: 0 },
  { label: '停用', value: 1 },
];
const typeOptions = [
  { label: '目录', value: 1 },
  { label: '菜单', value: 2 },
  { label: '按钮', value: 3 },
];
const forbiddenParents = computed(() => {
  const excluded = new Set<number>(editingId.value ? [editingId.value] : []);
  let changed = true;
  while (changed) {
    changed = false;
    for (const menu of parentMenus.value)
      if (excluded.has(menu.parentId) && !excluded.has(menu.id)) {
        excluded.add(menu.id);
        changed = true;
      }
  }
  return excluded;
});
const parentTree = computed(() => {
  return [
    {
      id: 0,
      name: '顶级菜单',
      children: buildSystemTree(
        parentMenus.value.filter(
          (menu) => menu.type !== 3 && !forbiddenParents.value.has(menu.id),
        ),
      ),
    },
  ];
});
const columns = [
  { title: '菜单名称', dataIndex: 'name', key: 'name', width: 240 },
  { title: '类型', key: 'type', width: 80 },
  { title: '排序', dataIndex: 'sort', width: 80 },
  { title: '权限标识', dataIndex: 'permission', width: 250 },
  { title: '路由地址', dataIndex: 'path', width: 180 },
  { title: '组件路径', dataIndex: 'component', width: 240 },
  { title: '状态', key: 'status', width: 80 },
  { title: '显示', key: 'visible', width: 80 },
  { title: '操作', key: 'action', width: 210, fixed: 'right' as const },
];
let latest = 0;
let editorRequest = 0;
async function load() {
  const request = ++latest;
  if (!canRead.value) {
    rows.value = [];
    selected.value = [];
    return;
  }
  loading.value = true;
  failed.value = false;
  try {
    const data = await getMenuListApi(applied.value);
    if (request !== latest || !canRead.value) return;
    if (!Array.isArray(data)) throw new Error('菜单列表格式错误');
    const records = data as (MenuRecord & { id: number })[];
    buildSystemTree(records);
    rows.value = records;
    selected.value = [];
    expanded.value = [];
  } catch {
    if (request === latest) {
      rows.value = [];
      selected.value = [];
      failed.value = true;
    }
  } finally {
    if (request === latest) loading.value = false;
  }
}
function search() {
  applied.value = {
    name: query.name.trim() || undefined,
    status: query.status,
  };
  void load();
}
function reset() {
  query.name = '';
  query.status = undefined;
  search();
}
async function loadEditor() {
  const request = ++editorRequest;
  editorLoading.value = true;
  editorFailed.value = false;
  editorLoaded.value = false;
  try {
    const id = editingId.value;
    const [menus, detail] = await Promise.all([
      getAllSimpleMenuListApi(),
      id ? getMenuApi(id) : Promise.resolve(defaults()),
    ]);
    if (request !== editorRequest || !editorOpen.value) return;
    if (!Array.isArray(menus) || !detail || (id && detail.id !== id))
      throw new Error('菜单信息错误');
    buildSystemTree(menus);
    parentMenus.value = menus;
    Object.assign(form, defaults(), detail);
    editorLoaded.value = true;
  } catch {
    if (request === editorRequest) editorFailed.value = true;
  } finally {
    if (request === editorRequest) editorLoading.value = false;
  }
}
function openEditor(id?: number, parentId = 0) {
  if (
    saving.value ||
    loading.value ||
    !canRead.value ||
    !has(id ? 'system:menu:update' : 'system:menu:create')
  )
    return;
  editingId.value = id;
  Object.assign(form, defaults());
  editorOpen.value = true;
  const request = editorRequest + 1;
  void loadEditor().then(() => {
    if (request === editorRequest && !id && editorLoaded.value)
      form.parentId = parentId;
  });
}
async function save() {
  if (!canSave.value) return;
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  if (!canSave.value) return;
  if (
    form.parentId &&
    (forbiddenParents.value.has(form.parentId) ||
      !parentMenus.value.some(
        (menu) => menu.id === form.parentId && menu.type !== 3,
      ))
  ) {
    message.warning('请选择有效的上级菜单');
    return;
  }
  if (
    form.type === 3 &&
    parentMenus.value.some((menu) => menu.parentId === editingId.value)
  ) {
    message.warning('有子菜单的目录或菜单不能改为按钮');
    return;
  }
  saving.value = true;
  try {
    const data: MenuRecord = {
      parentId: form.parentId,
      type: form.type,
      sort: form.sort,
      status: form.status,
      visible: form.visible,
      id: editingId.value,
      name: form.name.trim(),
      permission: form.type === 3 ? form.permission?.trim() : '',
      path: form.type === 3 ? '' : form.path?.trim(),
      icon: form.type === 3 ? '' : form.icon?.trim(),
      component: form.type === 2 ? form.component?.trim() : '',
      componentName: form.type === 2 ? form.componentName?.trim() : '',
      keepAlive: form.type === 2 && form.keepAlive,
      alwaysShow: form.type !== 3 && form.alwaysShow,
    };
    const result = editingId.value
      ? await updateMenuApi(data)
      : await createMenuApi(data);
    if (
      editingId.value
        ? result !== true
        : !Number.isSafeInteger(result) || Number(result) <= 0
    ) {
      message.warning('菜单未保存，请重试');
      return;
    }
    editorOpen.value = false;
    message.success('菜单已保存，导航和权限变更重新登录后生效');
    await load();
  } catch {
    /* Shared interceptor. */
  } finally {
    saving.value = false;
  }
}
async function remove(ids: number[], batch = false) {
  if (
    !ids.length ||
    saving.value ||
    loading.value ||
    !canRead.value ||
    !has('system:menu:delete')
  )
    return;
  saving.value = true;
  try {
    const result = batch
      ? await deleteMenuListApi(ids)
      : await deleteMenuApi(ids[0]!);
    if (result !== true) {
      message.warning('菜单未删除，请重试');
      return;
    }
    message.success('菜单已删除');
    await load();
  } catch {
    /* Shared interceptor. */
  } finally {
    saving.value = false;
  }
}
function close() {
  if (saving.value) return;
  editorRequest++;
  editorOpen.value = false;
}
onBeforeRouteLeave(() => !saving.value);
onUnmounted(() => {
  latest++;
  editorRequest++;
});
watch(
  canRead,
  () => {
    void load();
  },
  { immediate: true },
);
</script>
<template>
  <Page
    title="菜单管理"
    description="维护菜单层级、路由和按钮权限；授权变更重新登录后生效"
  >
    <Alert v-if="!canRead" message="没有菜单查询权限" type="error" />
    <template v-else>
      <Card :bordered="false" class="mb-4!">
        <Form :model="query" layout="inline" @finish="search">
          <FormItem label="菜单名称">
            <Input
              v-model:value="query.name"
              placeholder="请输入菜单名称"
              allow-clear
              :maxlength="50"
            />
          </FormItem>
          <FormItem label="状态">
            <Select
              v-model:value="query.status"
              :options="statusOptions"
              placeholder="全部状态"
              allow-clear
              style="width: 140px"
            />
          </FormItem>
          <FormItem>
            <Space>
              <Button type="primary" html-type="submit" :disabled="saving">
                <span>查询</span>
              </Button>
              <Button :disabled="saving" @click="reset">
                <span>重置</span>
              </Button>
            </Space>
          </FormItem>
        </Form>
      </Card>
      <Alert
        v-if="failed"
        message="菜单列表加载失败，请重试"
        type="error"
        class="mb-4!"
      />
      <Card :bordered="false" title="菜单列表">
        <template #extra>
          <Space wrap>
            <Button
              v-if="has('system:menu:create')"
              type="primary"
              :disabled="saving || loading"
              @click="openEditor()"
            >
              <span>新增菜单</span>
            </Button>
            <Popconfirm
              v-if="has('system:menu:delete')"
              :title="`确认删除选中的 ${selected.length} 项菜单？`"
              :disabled="!selected.length || saving"
              @confirm="remove([...selected], true)"
            >
              <Button danger :disabled="!selected.length || saving || loading">
                <span>批量删除</span>
              </Button>
            </Popconfirm>
            <Button
              :disabled="saving || loading"
              @click="expanded = rows.map((row) => row.id)"
            >
              <span>展开全部</span>
            </Button>
            <Button :disabled="saving || loading" @click="expanded = []">
              <span>折叠全部</span>
            </Button>
            <Button :disabled="saving || loading" @click="load">
              <span>刷新</span>
            </Button>
          </Space>
        </template>
        <Table
          :columns="columns"
          :data-source="tree"
          :pagination="false"
          :loading="loading"
          row-key="id"
          :expanded-row-keys="expanded"
          :row-selection="
            has('system:menu:delete')
              ? {
                  selectedRowKeys: selected,
                  checkStrictly: true,
                  onChange: (keys) => (selected = keys as number[]),
                  getCheckboxProps: () => ({ disabled: saving || loading }),
                }
              : undefined
          "
          :scroll="{ x: 1600 }"
          @expanded-rows-change="expanded = $event as number[]"
        >
          <template #bodyCell="{ column, record }">
            <Tag v-if="column.key === 'type'">
              {{
                typeOptions.find((item) => item.value === record.type)?.label ??
                record.type
              }}
            </Tag>
            <Tag
              v-else-if="column.key === 'status'"
              :color="record.status === 0 ? 'success' : 'default'"
            >
              {{ record.status === 0 ? '正常' : '停用' }}
            </Tag>
            <span v-else-if="column.key === 'visible'">{{
              record.visible === false ? '隐藏' : '显示'
            }}</span>
            <Space v-else-if="column.key === 'action'">
              <Button
                v-if="has('system:menu:update')"
                type="link"
                size="small"
                :disabled="saving"
                @click="openEditor(record.id)"
              >
                <span>编辑</span>
              </Button>
              <Button
                v-if="has('system:menu:create') && record.type !== 3"
                type="link"
                size="small"
                :disabled="saving"
                @click="openEditor(undefined, record.id)"
              >
                <span>新增子项</span>
              </Button>
              <Popconfirm
                v-if="has('system:menu:delete')"
                title="确认删除该菜单？"
                :disabled="saving"
                @confirm="remove([record.id])"
              >
                <Button danger type="link" size="small" :disabled="saving">
                  <span>删除</span>
                </Button>
              </Popconfirm>
            </Space>
          </template>
        </Table>
      </Card>
    </template>
    <Modal
      :open="editorOpen"
      :title="editingId ? '编辑菜单' : '新增菜单'"
      :confirm-loading="saving"
      :ok-button-props="{ disabled: !canSave }"
      :cancel-button-props="{ disabled: saving }"
      :closable="!saving"
      :mask-closable="false"
      :keyboard="!saving"
      :width="720"
      @ok="save"
      @cancel="close"
    >
      <Alert
        v-if="editorFailed"
        message="菜单信息加载失败，请重试"
        type="error"
        class="mb-4!"
      >
        <template #action>
          <Button @click="loadEditor"><span>重试</span></Button>
        </template>
      </Alert>
      <Spin :spinning="editorLoading">
        <Form
          v-if="editorLoaded"
          ref="formRef"
          :model="form"
          layout="vertical"
          :disabled="saving || !has(writeCode)"
        >
          <FormItem
            label="上级菜单"
            name="parentId"
            :rules="[{ required: true, message: '请选择上级菜单' }]"
          >
            <TreeSelect
              v-model:value="form.parentId"
              :tree-data="parentTree"
              :field-names="{
                label: 'name',
                value: 'id',
                children: 'children',
              }"
              show-search
              tree-node-filter-prop="name"
            />
          </FormItem>
          <FormItem label="菜单类型" name="type" :rules="[{ required: true }]">
            <Select v-model:value="form.type" :options="typeOptions" />
          </FormItem>
          <FormItem
            label="菜单名称"
            name="name"
            :rules="[
              { required: true, whitespace: true, message: '请输入菜单名称' },
            ]"
          >
            <Input v-model:value="form.name" :maxlength="50" />
          </FormItem>
          <FormItem
            label="显示顺序"
            name="sort"
            :rules="[{ required: true, message: '请输入显示顺序' }]"
          >
            <InputNumber
              v-model:value="form.sort"
              :precision="0"
              :min="0"
              class="w-full"
            />
          </FormItem>
          <FormItem
            v-if="form.type === 3"
            label="权限标识"
            name="permission"
            :rules="[
              {
                required: true,
                whitespace: true,
                message: '请输入按钮权限标识',
              },
            ]"
          >
            <Input
              v-model:value="form.permission"
              :maxlength="100"
              placeholder="例如 system:menu:create 或制图节点权限码"
            />
          </FormItem>
          <template v-else>
            <FormItem label="路由地址" name="path">
              <Input v-model:value="form.path" :maxlength="200" />
            </FormItem>
            <FormItem label="图标" name="icon">
              <Input
                v-model:value="form.icon"
                placeholder="例如 lucide:settings"
              />
            </FormItem>
            <template v-if="form.type === 2">
              <FormItem label="组件路径" name="component">
                <Input
                  v-model:value="form.component"
                  :maxlength="200"
                  placeholder="例如 aigc/model/index"
                />
              </FormItem>
              <FormItem label="组件名称" name="componentName">
                <Input
                  v-model:value="form.componentName"
                  placeholder="例如 SystemAiModel"
                />
              </FormItem>
              <FormItem label="缓存页面">
                <Switch v-model:checked="form.keepAlive" />
              </FormItem>
            </template>
            <FormItem label="总是显示">
              <Switch v-model:checked="form.alwaysShow" />
            </FormItem>
          </template>
          <FormItem label="状态" name="status" :rules="[{ required: true }]">
            <Select v-model:value="form.status" :options="statusOptions" />
          </FormItem>
          <FormItem label="是否可见">
            <Switch v-model:checked="form.visible" />
          </FormItem>
        </Form>
      </Spin>
    </Modal>
  </Page>
</template>
