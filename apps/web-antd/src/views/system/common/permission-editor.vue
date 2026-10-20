<script setup lang="ts">
import type { RoleDataScope, SimpleMenuRecord } from '#/api';

import { computed, onUnmounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';

import {
  Alert,
  Button,
  Form,
  FormItem,
  message,
  Modal,
  Select,
  Space,
  Spin,
  Tree,
  TreeSelect,
} from 'ant-design-vue';

import {
  assignRoleDataScopeApi,
  assignRoleMenusApi,
  assignUserRolesApi,
  getAllSimpleMenuListApi,
  getAllSimpleRoleListApi,
  getRoleApi,
  getRoleMenuIdsApi,
  getSimpleDeptListApi,
  getUserRoleIdsApi,
} from '#/api';
import { useSystemAccess } from '#/features/system/access';
import { buildSystemTree, validateSystemIds } from '#/features/system/tree';

const props = defineProps<{
  kind: 'data' | 'menus' | 'roles';
  targetId: number;
  targetName: string;
}>();
const emit = defineEmits<{ close: []; saved: [] }>();
const has = useSystemAccess();
const permission = computed(
  () =>
    `system:permission:${props.kind === 'menus' ? 'assign-role-menu' : props.kind === 'roles' ? 'assign-user-role' : 'assign-role-data-scope'}`,
);
const allowed = computed(() => has(permission.value));
const title = computed(
  () =>
    ({ data: '数据权限', menus: '菜单权限', roles: '分配角色' })[props.kind] +
    ' · ' +
    props.targetName,
);
const failed = ref(false);
const loaded = ref(false);
const loading = ref(false);
const saving = ref(false);
const selected = ref<number[]>([]);
const menus = ref<SimpleMenuRecord[]>([]);
const roles = ref<{ label: string; value: number }[]>([]);
const depts = ref<{ id: number; name: string; parentId?: number }[]>([]);
const dataScope = ref<RoleDataScope>();
const scopeOptions = [
  { label: '全部数据权限', value: 1 },
  { label: '指定部门数据权限', value: 2 },
  { label: '本部门数据权限', value: 3 },
  { label: '本部门及以下数据权限', value: 4 },
  { label: '仅本人数据权限', value: 5 },
];
const menuTree = computed(() => buildSystemTree(menus.value));
const menuKeys = computed(() => new Set(menus.value.map((menu) => menu.id)));
const unknownMenus = computed(() =>
  selected.value.filter((id) => !menuKeys.value.has(id)),
);
const deptTree = computed(() =>
  buildSystemTree([
    ...depts.value,
    ...selected.value
      .filter((id) => !depts.value.some((dept) => dept.id === id))
      .map((id) => ({ id, name: `已分配部门 #${id}`, parentId: 0 })),
  ]),
);
let latest = 0;
async function load() {
  const request = ++latest;
  loaded.value = false;
  failed.value = false;
  selected.value = [];
  menus.value = [];
  roles.value = [];
  depts.value = [];
  dataScope.value = undefined;
  if (!allowed.value) return;
  loading.value = true;
  try {
    const id = props.targetId;
    if (props.kind === 'menus') {
      const [list, ids] = await Promise.all([
        getAllSimpleMenuListApi(),
        getRoleMenuIdsApi(id),
      ]);
      if (request !== latest) return;
      validateSystemIds(ids);
      if (!Array.isArray(list)) throw new Error('Invalid menu list');
      buildSystemTree(list);
      menus.value = list;
      selected.value = [...new Set(ids)];
    } else if (props.kind === 'roles') {
      const [list, ids] = await Promise.all([
        getAllSimpleRoleListApi(),
        getUserRoleIdsApi(id),
      ]);
      if (request !== latest) return;
      validateSystemIds(ids);
      if (!Array.isArray(list)) throw new Error('Invalid roles');
      roles.value = list
        .filter((role) => role.id)
        .map((role) => ({
          label: role.name + (role.status === 1 ? '（停用）' : ''),
          value: role.id!,
        }));
      roles.value.push(
        ...ids
          .filter((id) => !roles.value.some((role) => role.value === id))
          .map((id) => ({ label: `已分配角色 #${id}`, value: id })),
      );
      selected.value = [...new Set(ids)];
    } else {
      const [role, list] = await Promise.all([
        getRoleApi(id),
        getSimpleDeptListApi(),
      ]);
      if (request !== latest) return;
      if (
        !role ||
        role.id !== id ||
        !scopeOptions.some((option) => option.value === role.dataScope) ||
        !Array.isArray(list)
      )
        throw new Error('Invalid data scope');
      const ids = role.dataScopeDeptIds ?? [];
      validateSystemIds(ids);
      const items = list.map((dept) => ({
        id: dept.id!,
        name: dept.name,
        parentId: dept.parentId,
      }));
      buildSystemTree(items);
      dataScope.value = role.dataScope as RoleDataScope;
      selected.value = ids;
      depts.value = items;
    }
    if (request === latest && allowed.value) loaded.value = true;
  } catch {
    if (request === latest) failed.value = true;
  } finally {
    if (request === latest) loading.value = false;
  }
}
async function save() {
  if (!allowed.value || !loaded.value || loading.value || saving.value) return;
  if (
    props.kind === 'data' &&
    (!dataScope.value || (dataScope.value === 2 && !selected.value.length))
  ) {
    message.warning('请选择数据范围及指定部门');
    return;
  }
  saving.value = true;
  try {
    const ids = [...new Set(selected.value)];
    const result =
      props.kind === 'menus'
        ? await assignRoleMenusApi(props.targetId, ids)
        : props.kind === 'roles'
          ? await assignUserRolesApi(props.targetId, ids)
          : await assignRoleDataScopeApi({
              roleId: props.targetId,
              dataScope: dataScope.value!,
              dataScopeDeptIds: dataScope.value === 2 ? ids : [],
            });
    if (result !== true) {
      message.warning('权限未保存，请重试');
      return;
    }
    message.success('权限已保存，相关用户重新登录后生效');
    emit('saved');
    emit('close');
  } catch {
    /* Shared interceptor. */
  } finally {
    saving.value = false;
  }
}
function check(keys: number[] | { checked: number[] }) {
  if (!saving.value && allowed.value)
    selected.value = [
      ...new Set([
        ...unknownMenus.value,
        ...(Array.isArray(keys) ? keys : keys.checked),
      ]),
    ];
}
function close() {
  if (!saving.value) emit('close');
}
onBeforeRouteLeave(() => !saving.value);
onBeforeRouteUpdate(() => !saving.value);
onUnmounted(() => {
  latest++;
});
watch(
  () => [props.kind, props.targetId, allowed.value],
  () => {
    void load();
  },
  { immediate: true },
);
</script>
<template>
  <Modal
    open
    :title="title"
    :width="720"
    ok-text="保存授权"
    :confirm-loading="saving"
    :ok-button-props="{ disabled: !allowed || !loaded || loading || saving }"
    :cancel-button-props="{ disabled: saving }"
    :closable="!saving"
    :mask-closable="false"
    :keyboard="!saving"
    @ok="save"
    @cancel="close"
  >
    <Alert v-if="!allowed" message="当前账号没有该授权操作权限" type="error" />
    <template v-else>
      <Alert
        v-if="failed"
        message="授权信息加载失败，请重试；读取成功前无法保存"
        type="error"
        class="mb-4!"
      >
        <template #action>
          <Button @click="load"><span>重试</span></Button>
        </template>
      </Alert>
      <Spin :spinning="loading">
        <template v-if="loaded">
          <template v-if="kind === 'menus'">
            <Alert
              message="菜单和按钮独立勾选，不会因选择目录自动授予其下全部权限。"
              type="info"
              class="mb-4!"
            />
            <Alert
              v-if="unknownMenus.length"
              :message="`有 ${unknownMenus.length} 项已有授权未在菜单列表返回，保存时将保留。`"
              type="warning"
              class="mb-4!"
            />
            <Space class="mb-4" wrap>
              <Button
                :disabled="saving"
                @click="selected = [...new Set([...selected, ...menuKeys])]"
              >
                <span>全选已列菜单</span>
              </Button>
              <Button :disabled="saving" @click="selected = [...unknownMenus]">
                <span>清空已列菜单</span>
              </Button>
            </Space>
            <Tree
              :tree-data="menuTree"
              :field-names="{ title: 'name', key: 'id', children: 'children' }"
              checkable
              check-strictly
              :checked-keys="{ checked: selected, halfChecked: [] }"
              :disabled="saving"
              :height="420"
              @check="check($event as { checked: number[] })"
            />
          </template>
          <Form v-else layout="vertical">
            <FormItem v-if="kind === 'roles'" label="用户拥有的角色">
              <Select
                v-model:value="selected"
                :options="roles"
                mode="multiple"
                option-filter-prop="label"
                placeholder="请选择角色；清空后移除全部角色"
                :disabled="saving"
              />
            </FormItem>
            <template v-else>
              <FormItem label="数据范围" required>
                <Select
                  v-model:value="dataScope"
                  :options="scopeOptions"
                  :disabled="saving"
                />
              </FormItem>
              <FormItem v-if="dataScope === 2" label="指定部门" required>
                <TreeSelect
                  v-model:value="selected"
                  :tree-data="deptTree"
                  :field-names="{
                    label: 'name',
                    value: 'id',
                    children: 'children',
                  }"
                  multiple
                  show-search
                  tree-node-filter-prop="name"
                  :disabled="saving"
                  placeholder="请选择部门"
                />
              </FormItem>
            </template>
          </Form>
        </template>
      </Spin>
    </template>
  </Modal>
</template>
