<script setup lang="ts">
import type { TreeProps } from 'ant-design-vue';

import type { SystemGrants, SystemMenuTreeNode, SystemModule } from '#/api';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Radio,
  Space,
  Spin,
  Tree,
} from 'ant-design-vue';

import { getSystemMenuTreeApi, getSystemResourceListApi } from '#/api';

import { useSystemAccess } from './access';
import {
  grantBranchKeys,
  grantCheckState,
  grantModuleTree,
  toggleGrantNode,
} from './role-grants';

const props = defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ ready: [value: boolean] }>();
const grants = defineModel<SystemGrants>({ required: true });
const { can } = useSystemAccess();
const canRead = computed(() => can('menus', 'read') && can('modules', 'read'));
const rows = ref<SystemMenuTreeNode[]>([]);
const modules = ref<SystemModule[]>([]);
const loading = ref(false);
const failed = ref(false);
const activeModule = ref<number>();
const expandedKeys = ref<(number | string)[]>([]);
let requestId = 0;

const moduleOptions = computed(() => {
  const options = new Map(
    modules.value.map((module) => [
      module.id,
      { id: module.id, name: module.name, sortOrder: module.sortOrder },
    ]),
  );
  function visit(items: SystemMenuTreeNode[]) {
    for (const row of items) {
      const id = row.moduleId ?? -1;
      if (!options.has(id))
        options.set(id, {
          id,
          name: id === -1 ? '未分配模块' : `模块 ID: ${id}`,
          sortOrder: Number.MAX_SAFE_INTEGER,
        });
      visit(row.children ?? []);
    }
  }
  visit(rows.value);
  return [...options.values()].toSorted((a, b) => a.sortOrder - b.sortOrder);
});
const tree = computed(() =>
  activeModule.value === undefined
    ? []
    : grantModuleTree(rows.value, activeModule.value),
);
const checkedKeys = computed(() => grantCheckState(tree.value, grants.value));
const blocked = computed(
  () => props.disabled || loading.value || failed.value || !canRead.value,
);
const moduleChecked = computed(
  () =>
    activeModule.value !== undefined &&
    grants.value.moduleIds.includes(activeModule.value),
);

function expand() {
  expandedKeys.value = grantBranchKeys(tree.value);
}
function expandFirstBranch() {
  const keys: string[] = [];
  let node = tree.value.find((row) => row.children?.length);
  while (node?.children?.length) {
    keys.push(node.key);
    node = node.children.find((row) => row.children?.length);
  }
  expandedKeys.value = keys;
}
function changeModule() {
  expandFirstBranch();
}
function changeModuleAccess(checked: boolean) {
  const id = activeModule.value;
  if (blocked.value || id === undefined || id < 1) return;
  const ids = new Set(grants.value.moduleIds);
  if (checked) ids.add(id);
  else ids.delete(id);
  grants.value = { ...grants.value, moduleIds: [...ids] };
}
const check: NonNullable<TreeProps['onCheck']> = (_keys, event) => {
  if (blocked.value || typeof event.node.key !== 'string') return;
  grants.value = toggleGrantNode(
    tree.value,
    grants.value,
    event.node.key,
    event.checked,
  );
};
async function load() {
  emit('ready', false);
  if (!canRead.value) return;
  const request = ++requestId;
  loading.value = true;
  failed.value = false;
  const results = await Promise.allSettled([
    getSystemMenuTreeApi(),
    getSystemResourceListApi('modules'),
  ]);
  if (request !== requestId) return;
  const [menuResult, moduleResult] = results;
  if (menuResult.status === 'fulfilled') rows.value = menuResult.value;
  if (moduleResult.status === 'fulfilled')
    modules.value = Array.isArray(moduleResult.value)
      ? moduleResult.value
      : moduleResult.value.records;
  failed.value = results.some((result) => result.status === 'rejected');
  if (!failed.value) {
    if (
      !moduleOptions.value.some((module) => module.id === activeModule.value)
    ) {
      activeModule.value = (
        moduleOptions.value.find((module) =>
          grants.value.moduleIds.includes(module.id),
        ) ?? moduleOptions.value[0]
      )?.id;
    }
    expandFirstBranch();
  }
  loading.value = false;
  emit('ready', !failed.value);
}
onMounted(() => void load());
onBeforeUnmount(() => {
  ++requestId;
  emit('ready', false);
});
</script>

<template>
  <div class="role-grant-tree">
    <Alert
      v-if="!canRead"
      message="当前账号缺少读取菜单树或模块的权限，无法配置授权"
      type="warning"
      show-icon
    />
    <Alert
      v-else-if="failed"
      message="授权选项加载失败，请重试"
      type="error"
      show-icon
    >
      <template #action>
        <Button size="small" :disabled="disabled" @click="load"> 重试 </Button>
      </template>
    </Alert>
    <Spin :spinning="loading">
      <template v-if="canRead">
        <div class="mb-4">
          <div id="role-grant-modules" class="mb-2 font-medium">模块：</div>
          <Radio.Group
            v-model:value="activeModule"
            class="grant-module-tabs"
            button-style="solid"
            :disabled="blocked"
            aria-labelledby="role-grant-modules"
            @change="changeModule"
          >
            <Radio.Button
              v-for="module in moduleOptions"
              :key="module.id"
              :value="module.id"
            >
              {{ module.name }}
            </Radio.Button>
          </Radio.Group>
        </div>
        <div
          v-if="activeModule !== undefined"
          class="mb-3 flex flex-wrap items-center justify-between gap-3"
        >
          <Checkbox
            v-if="activeModule > 0"
            :checked="moduleChecked"
            :disabled="blocked"
            @change="changeModuleAccess($event.target.checked)"
          >
            允许访问当前模块
          </Checkbox>
          <Space :size="8">
            <Button size="small" :disabled="blocked" @click="expand">
              展开全部
            </Button>
            <Button size="small" :disabled="blocked" @click="expandedKeys = []">
              收起全部
            </Button>
          </Space>
        </div>
        <p v-if="tree.length > 0" class="text-muted-foreground mb-3 text-sm">
          勾选节点可批量选择下级，半选表示部分授权。模块访问单独勾选。
        </p>
        <Tree
          v-if="tree.length > 0"
          v-model:expanded-keys="expandedKeys"
          :tree-data="tree"
          :checked-keys="checkedKeys"
          :disabled="blocked"
          checkable
          check-strictly
          block-node
          aria-label="菜单与权限授权树"
          @check="check"
        />
        <Empty
          v-else-if="!loading && !failed"
          description="当前模块暂无菜单或权限"
        />
      </template>
    </Spin>
  </div>
</template>

<style scoped>
.grant-module-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.grant-module-tabs :deep(.ant-radio-button-wrapper) {
  height: 36px;
  line-height: 34px;
  border-inline-start-width: 1px;
  border-radius: 4px;
}

.grant-module-tabs :deep(.ant-radio-button-wrapper::before) {
  display: none;
}

.role-grant-tree :deep(.ant-tree-treenode) {
  padding: 4px 0;
}
</style>
