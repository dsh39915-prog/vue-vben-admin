<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';

import type { ResourceField } from './resource-config';
import type { AdminRow, EditorMode, ResourceForm } from './resource-types';

import type { SystemGrants, SystemResource } from '#/api';

import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import {
  Alert,
  Button,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Spin,
} from 'ant-design-vue';

import {
  assignSystemUserRolesApi,
  createSystemResourceApi,
  getSystemResourceDetailsApi,
  getSystemRoleGrantsApi,
  resetSystemUserPasswordApi,
  updateSystemResourceApi,
  updateSystemRoleGrantsApi,
} from '#/api';

import { useSystemAccess } from './access';
import { menuRowKey } from './menu-tree';
import { getResourceFields, passwordRules } from './resource-config';
import ResourceFields from './resource-fields.vue';
import { flattenResources as flatten } from './resource-types';
import RoleGrantTree from './role-grant-tree.vue';
import { useResourceRelations } from './use-resource-relations';

const props = defineProps<{
  records: AdminRow[];
  resource: SystemResource;
  selectedModule: number;
}>();
const emit = defineEmits<{
  busy: [value: boolean];
  saved: [
    value: {
      mode: EditorMode;
      parentKey?: number | string;
      resource: SystemResource;
    },
  ];
}>();
const route = useRoute();
const { can } = useSystemAccess(
  () => props.resource,
  () => route.meta.permissionCode,
);
const info = computed(() => ({ title: String(route.meta.title ?? '管理') }));
const isMenu = computed(() => props.resource === 'menus');
const editorResource = ref<SystemResource>(props.resource);
const fields = computed(() => getResourceFields(editorResource.value));
const working = ref(false);
const {
  relations,
  loading: relationLoading,
  failures: relationFailures,
  load: loadRelations,
  options: relationOptions,
  cancel: cancelRelations,
} = useResourceRelations(can);
function rowResource(row: AdminRow): SystemResource {
  return isMenu.value && row.nodeType === 'PERMISSION'
    ? 'permissions'
    : props.resource;
}
function optionsFor(field: ResourceField) {
  if (!field.relation) return field.options ?? [];
  let options = relationOptions(field.relation);
  if (
    field.key === 'parentId' &&
    selectedId.value !== undefined &&
    field.relation === editorResource.value
  ) {
    const excluded = new Set([selectedId.value]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const row of relations[field.relation] ?? []) {
        if (
          row.parentId !== null &&
          row.parentId !== undefined &&
          excluded.has(row.parentId) &&
          !excluded.has(row.id)
        ) {
          excluded.add(row.id);
          changed = true;
        }
      }
    }
    options = options.filter((option) => !excluded.has(option.value));
  }
  const selected: number[] = [];
  const value = form[field.key];
  if (Array.isArray(value))
    selected.push(
      ...value.filter((id): id is number => typeof id === 'number'),
    );
  else if (typeof value === 'number') selected.push(value);
  return [
    ...options,
    ...selected
      .filter((id) => !options.some((option) => option.value === id))
      .map((value) => ({ label: `ID: ${value}`, value })),
  ];
}

const modalOpen = ref(false);
const mode = ref<EditorMode>('add');
const selectedId = ref<number>();
const selectedLabel = ref('');
const form = reactive<ResourceForm>({
  newPassword: '',
  roleIds: [],
  menuIds: [],
  permissionIds: [],
  moduleIds: [],
});
const grantTreeReady = ref(false);
const roleGrants = computed<SystemGrants>({
  get: () => ({
    menuIds: form.menuIds ?? [],
    permissionIds: form.permissionIds ?? [],
    moduleIds: form.moduleIds ?? [],
  }),
  set: (value) => Object.assign(form, value),
});
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
      grants: '角色权限',
    })[mode.value] +
    (selectedLabel.value ? `：${selectedLabel.value}` : info.value.title),
);
const requiredRelations = computed<SystemResource[]>(() => {
  if (mode.value === 'password') return [];
  if (mode.value === 'roles') return ['roles'];
  if (mode.value === 'grants') return [];
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
    (mode.value === 'grants' && !grantTreeReady.value) ||
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
async function openModal(
  nextMode: typeof mode.value,
  id?: number,
  parent?: AdminRow,
  targetResource: SystemResource = props.resource,
) {
  const request = ++detailRequest;
  mode.value = nextMode;
  grantTreeReady.value = false;
  selectedId.value = id;
  editorResource.value = targetResource;
  const row = flatten(props.records).find(
    (item) => item.id === id && rowResource(item) === targetResource,
  );
  selectedLabel.value = row?.name || row?.realName || row?.username || '';
  for (const key of Object.keys(form)) form[key] = undefined;
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
  if (isMenu.value && nextMode === 'add') {
    form.moduleId = props.selectedModule > 0 ? props.selectedModule : null;
    if (parent) {
      form.moduleId = parent.moduleId;
      if (targetResource === 'permissions') {
        form.menuId =
          parent.nodeType === 'PERMISSION' ? parent.menuId : parent.id;
        form.parentId = parent.nodeType === 'PERMISSION' ? parent.id : null;
        form.permissionType = 3;
      } else {
        form.parentId = parent.id;
        form.menuType = parent.type === 1 ? 2 : 3;
      }
    }
  }
  detailFailed.value = false;
  detailLoading.value = true;
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
  try {
    let details: Promise<null | object> = Promise.resolve(null);
    if (id !== undefined && nextMode !== 'password') {
      details =
        nextMode === 'grants'
          ? getSystemRoleGrantsApi(id)
          : getSystemResourceDetailsApi(targetResource, id);
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
  cancelRelations();
  modalOpen.value = false;
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
        await createSystemResourceApi(editorResource.value, data);
      else if (id !== undefined)
        await updateSystemResourceApi(editorResource.value, id, data);
    }
    message.success('保存成功');
    let parentKey: number | string | undefined;
    if (isMenu.value && mode.value === 'add') {
      const permissionParent =
        editorResource.value === 'permissions' &&
        typeof form.parentId === 'number';
      const parentResource = permissionParent ? 'permissions' : 'menus';
      const parentId =
        editorResource.value === 'permissions'
          ? (form.parentId ?? form.menuId)
          : form.parentId;
      const parent = flatten(props.records).find(
        (row) => row.id === parentId && rowResource(row) === parentResource,
      );
      if (parent) parentKey = menuRowKey(parent);
    }
    modalOpen.value = false;
    form.password = '';
    form.newPassword = '';
    emit('saved', {
      resource: editorResource.value,
      mode: mode.value,
      parentKey,
    });
  } catch {
    // 统一显示接口错误，保留表单供重试。
  } finally {
    working.value = false;
  }
}
watch(working, (value) => emit('busy', value), { flush: 'sync' });
onBeforeUnmount(() => {
  ++detailRequest;
  emit('busy', false);
});
defineExpose({ open: openModal });
</script>

<template>
  <Modal
    :open="modalOpen"
    :title="modalTitle"
    :width="mode === 'grants' ? 900 : 760"
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
          <Button
            size="small"
            @click="openModal(mode, selectedId, undefined, editorResource)"
          >
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
        <ResourceFields
          v-if="entityMode"
          :model-value="form"
          :fields="activeFields"
          :options-for="optionsFor"
          :rules-for="rulesFor"
          :relation-disabled="
            (field) => Boolean(field.relation && !can(field.relation, 'read'))
          "
        />
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
          <RoleGrantTree
            v-if="modalOpen && !detailLoading"
            v-model="roleGrants"
            :disabled="working"
            @ready="grantTreeReady = $event"
          />
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
</template>
