<script setup lang="ts">
import type { LaunchTask, LaunchTaskFilters } from '#/api';

import { computed, ref, watch } from 'vue';
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  useRoute,
  useRouter,
} from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  message,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  getDrawingTaskPage,
  matchesDrawingScope,
  useDrawingAccess,
} from '#/features/drawing/access';
import { getDrawingNode } from '#/features/drawing/nodes';

import { useAigcPage } from '../common/use-page';
import BatchAssign from './components/batch-assign.vue';
import OverdueStatus from './components/overdue-status.vue';
import TaskFilters from './components/task-filters.vue';
import {
  flowStatusOptions,
  normalizeTaskFilters,
  optionLabel,
  statusColor,
  visualLevelOptions,
} from './helpers';
import Workbench from './workbench.vue';
import {
  assignNodeKeys,
  auditNodeKeys,
  canHandleTask,
} from './workflow-helpers';
const route = useRoute();
const router = useRouter();
const access = useDrawingAccess();
const node = computed(() => getDrawingNode(route.meta.drawingNodeKey));
const allowed = computed(() =>
  Boolean(node.value && access.canVisit(node.value.key)),
);
const selectedIds = ref<(number | string)[]>([]);
const batchTasks = ref<LaunchTask[]>([]);
const batchSaving = ref(false);
const supportsBatch = computed(
  () => allowed.value && assignNodeKeys.includes(node.value?.key ?? ''),
);
const selectedTasks = computed(() =>
  rows.value.filter((task) =>
    selectedIds.value.some((id) => String(id) === String(task.id)),
  ),
);
function selectable(task: LaunchTask) {
  if (!supportsBatch.value || !node.value || !canHandleTask(task)) return false;
  try {
    return matchesDrawingScope(task, access.scopeFor(node.value.key));
  } catch {
    return false;
  }
}
const rowSelection = computed(() =>
  supportsBatch.value
    ? {
        selectedRowKeys: selectedIds.value,
        onChange: (keys: (number | string)[]) => {
          if (!loading.value && !batchSaving.value) selectedIds.value = keys;
        },
        getCheckboxProps: (task: LaunchTask) => ({
          disabled: loading.value || batchSaving.value || !selectable(task),
        }),
      }
    : undefined,
);
const query = ref<LaunchTaskFilters>({});
const failed = ref('');
let latestFetch = 0;
const {
  rows,
  loading,
  pagination,
  total,
  load: refresh,
  search,
  change: changePage,
} = useAigcPage(async ({ page, pageSize, ...filters }) => {
  const request = ++latestFetch;
  failed.value = '';
  const key = node.value?.key;
  if (!key) throw new Error('制图环节不存在');
  try {
    const result = await getDrawingTaskPage(
      { ...filters, pageNo: page, pageSize },
      access.scopeFor(key),
    );
    return {
      records: result.list,
      total: result.total,
      current: page,
      size: pageSize,
    };
  } catch (error) {
    if (request === latestFetch)
      failed.value =
        error instanceof Error ? error.message : '任务加载失败，请重试';
    throw error;
  }
}, {} as LaunchTaskFilters);
const actionLabel = computed(() =>
  auditNodeKeys.includes(node.value?.key ?? '')
    ? '审核'
    : assignNodeKeys.includes(node.value?.key ?? '')
      ? '分配'
      : '提交',
);
const columns = [
  { title: '款号', dataIndex: 'styleNo', width: 150, fixed: 'left' as const },
  { title: '开发年份季节', dataIndex: 'productSeason', width: 130 },
  { title: '品类', dataIndex: 'category', width: 120 },
  { title: '视觉重要层级', key: 'visualLevel', width: 120 },
  { title: '主推平台', dataIndex: 'mainPlatform', width: 180 },
  { title: '当前节点', dataIndex: 'currentNodeName', width: 200 },
  { title: '节点状态', key: 'nodeStatus', width: 100 },
  {
    title: '节点计划完成时间',
    dataIndex: 'currentNodePlanEndTime',
    width: 180,
  },
  { title: '日期逾期情况', key: 'dateOverdue', width: 180 },
  { title: '耗时逾期情况', key: 'timeOverdue', width: 180 },
  { title: '当前处理人', key: 'assignee', width: 130 },
  { title: '上新时间', dataIndex: 'launchTime', width: 180 },
  { title: '操作', key: 'action', width: 180, fixed: 'right' as const },
];
function load() {
  if (batchSaving.value) return;
  selectedIds.value = [];
  return search(normalizeTaskFilters(query.value));
}
function reload() {
  if (batchSaving.value) return;
  selectedIds.value = [];
  return refresh();
}
function change(next: { current?: number; pageSize?: number }) {
  if (batchSaving.value) return;
  selectedIds.value = [];
  return changePage(next);
}
function openBatch() {
  if (
    loading.value ||
    batchSaving.value ||
    !selectedTasks.value.length ||
    selectedTasks.value.some((task) => !selectable(task))
  )
    return;
  batchTasks.value = selectedTasks.value.map((task) => ({ ...task }));
}
function batchChanged() {
  batchTasks.value = [];
  selectedIds.value = [];
  void refresh();
}
function guardBatch() {
  if (!batchSaving.value) return true;
  message.warning('正在分配任务，请完成后再切换页面');
  return false;
}
onBeforeRouteLeave(guardBatch);
onBeforeRouteUpdate(guardBatch);
watch(rows, () => {
  selectedIds.value = [];
});
function reset() {
  query.value = {};
  void load();
}
function openTask(task: LaunchTask, details = false) {
  return router.push({
    path: route.path,
    query: { taskId: String(task.id), ...(details ? { view: 'details' } : {}) },
  });
}
watch(
  () => [node.value?.key, route.query.taskId, access.userId.value],
  () => {
    selectedIds.value = [];
    batchTasks.value = [];
    if (allowed.value && !route.query.taskId) void load();
  },
  { immediate: true },
);
</script>
<template>
  <Workbench
    v-if="allowed && node && route.query.taskId"
    :key="node.key"
    :node-key="node.key"
    :read-only="route.query.view === 'details'"
  />
  <Page
    v-else
    :title="node?.title || '制图流程'"
    :description="
      access.manager.value
        ? '查看当前环节的全部任务'
        : '查看分配给自己的当前环节任务'
    "
  >
    <Alert v-if="!allowed" message="没有该制图环节的访问权限" type="error" />
    <template v-else>
      <Card :bordered="false" class="mb-4!">
        <TaskFilters
          v-model="query"
          node
          :manager="access.manager.value"
          :loading="loading || batchSaving"
          @search="load"
          @reset="reset"
        />
      </Card>
      <Card :title="`待处理任务（${total}）`" :bordered="false">
        <template #extra>
          <Space>
            <p v-if="supportsBatch" class="mb-0">
              已选择 {{ selectedIds.length }} 项（当前页）
            </p>
            <Button
              v-if="supportsBatch"
              type="primary"
              :disabled="loading || batchSaving || !selectedIds.length"
              @click="openBatch"
            >
              <span>批量分配</span>
            </Button>
            <Button :loading="loading" :disabled="batchSaving" @click="reload">
              <span>刷新</span>
            </Button>
          </Space>
        </template>
        <Alert v-if="failed" :message="failed" type="error" class="mb-4!" />
        <Table
          :columns="columns"
          :data-source="rows"
          :loading="loading"
          :pagination="{ ...pagination, disabled: loading || batchSaving }"
          :row-selection="rowSelection"
          :scroll="{ x: 2100 }"
          row-key="id"
          @change="change"
        >
          <template #bodyCell="{ column, record }">
            <Tag
              v-if="column.key === 'nodeStatus'"
              :color="statusColor(record.currentNodeStatus)"
            >
              {{ optionLabel(flowStatusOptions, record.currentNodeStatus) }}
            </Tag>
            <template v-else-if="column.key === 'visualLevel'">
              {{ optionLabel(visualLevelOptions, record.visualLevel) }}
            </template>
            <template v-else-if="column.key === 'assignee'">
              {{
                record.currentNodeAssigneeName ||
                record.currentNodeAssigneeId ||
                '-'
              }}
            </template>
            <OverdueStatus
              v-else-if="column.key === 'dateOverdue'"
              :task="record as LaunchTask"
              kind="date"
            />
            <OverdueStatus
              v-else-if="column.key === 'timeOverdue'"
              :task="record as LaunchTask"
              kind="time"
            />
            <Space v-else-if="column.key === 'action'" :size="0">
              <Button type="link" @click="openTask(record as LaunchTask, true)">
                <span>流程详情</span>
              </Button>
              <Button type="link" @click="openTask(record as LaunchTask)">
                <span>{{
                  record.flowStatus === 4 || record.currentNodeStatus === 4
                    ? '查看'
                    : actionLabel
                }}</span>
              </Button>
            </Space>
          </template>
        </Table>
      </Card>
    </template>
    <BatchAssign
      v-if="node && batchTasks.length"
      :node-key="node.key"
      :tasks="batchTasks"
      @busy="batchSaving = $event"
      @changed="batchChanged"
      @close="batchTasks = []"
    />
  </Page>
</template>
