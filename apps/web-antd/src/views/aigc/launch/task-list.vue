<script setup lang="ts">
import type { LaunchTask, LaunchTaskFilters } from '#/api';

import { computed, onMounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  message,
  Popconfirm,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  deleteLaunchTaskApi,
  enableLaunchTaskApi,
  getLaunchTaskPageApi,
  terminateLaunchTaskApi,
} from '#/api';

import { useAigcPage } from '../common/use-page';
import OverdueStatus from './components/overdue-status.vue';
import TaskEditor from './components/task-editor.vue';
import TaskFilters from './components/task-filters.vue';
import TaskImport from './components/task-import.vue';
import {
  flowStatusOptions,
  normalizeTaskFilters,
  optionLabel,
  statusColor,
  visualLevelOptions,
} from './helpers';

const router = useRouter();
const templateUrl = `${import.meta.env.BASE_URL}template-tasks.xlsx`;
const query = ref<LaunchTaskFilters>({});
const {
  rows,
  loading,
  pagination,
  load,
  search: searchPage,
  change,
} = useAigcPage(
  async ({ page, pageSize, ...filters }) => {
    const data = await getLaunchTaskPageApi({
      ...filters,
      pageNo: page,
      pageSize,
    });
    return {
      records: data.list,
      total: data.total,
      current: page,
      size: pageSize,
    };
  },
  { ...query.value },
);
const editingId = ref<number>();
const busyId = ref<number>();
const importOpen = ref(false);
const importing = ref(false);
const selectedIds = ref<number[]>([]);
const batchDeleting = ref(false);
const deleteConfirmOpen = ref(false);
const busy = computed(
  () => busyId.value !== undefined || batchDeleting.value || importing.value,
);
const rowSelection = computed(() => {
  const disabled = loading.value || busy.value;
  return {
    selectedRowKeys: selectedIds.value,
    onChange: (keys: (number | string)[]) => {
      if (!loading.value && !busy.value) selectedIds.value = keys.map(Number);
    },
    getCheckboxProps: () => ({ disabled }),
  };
});
watch(rows, () => {
  selectedIds.value = [];
  deleteConfirmOpen.value = false;
});
const columns = [
  { title: '款号', dataIndex: 'styleNo', width: 150, fixed: 'left' as const },
  { title: '开发年份季节', dataIndex: 'productSeason', width: 130 },
  { title: '品类', dataIndex: 'category', width: 120 },
  { title: '视觉层级', key: 'visualLevel', width: 100 },
  { title: '主推平台', dataIndex: 'mainPlatform', width: 190 },
  { title: '流程状态', key: 'flowStatus', width: 110 },
  { title: '所在节点', dataIndex: 'currentNodeName', width: 190 },
  { title: '日期逾期情况', key: 'dateOverdueStatus', width: 180 },
  { title: '耗时逾期情况', key: 'timeOverdueStatus', width: 180 },
  { title: '当前处理人', key: 'assignee', width: 130 },
  { title: '上新时间', dataIndex: 'launchTime', width: 180 },
  { title: '流程开始时间', dataIndex: 'flowStartTime', width: 180 },
  { title: '商品要求货期', dataIndex: 'productDeadline', width: 180 },
  { title: '操作', key: 'action', width: 270, fixed: 'right' as const },
];
function search() {
  if (busy.value) return;
  return searchPage(normalizeTaskFilters(query.value));
}
function reset() {
  query.value = {};
  void search();
}
function openEditor(id: number) {
  if (busy.value) return;
  editingId.value = id;
}
function changeDeleteConfirmation(open: boolean) {
  if (open && (busy.value || loading.value)) return;
  if (open && !selectedIds.value.length) {
    message.warning('请先勾选要删除的任务');
    return;
  }
  deleteConfirmOpen.value = open;
}
async function deleteSelected() {
  if (busy.value || loading.value || !selectedIds.value.length) return;
  const ids = [...selectedIds.value];
  deleteConfirmOpen.value = false;
  batchDeleting.value = true;
  try {
    if ((await deleteLaunchTaskApi(ids)) !== true) {
      message.error('删除未成功，请重试');
      return;
    }
    message.success(`已删除 ${ids.length} 个任务`);
    selectedIds.value = [];
    await load();
  } catch {
    /* The shared request interceptor displays API errors. */
  } finally {
    batchDeleting.value = false;
  }
}
async function mutate(id: number, action: 'delete' | 'enable' | 'terminate') {
  if (busy.value || loading.value) return;
  busyId.value = id;
  try {
    const api = {
      delete: deleteLaunchTaskApi,
      enable: enableLaunchTaskApi,
      terminate: terminateLaunchTaskApi,
    }[action];
    if ((await api(id)) !== true) {
      message.error('操作未成功，请重试');
      return;
    }
    message.success(
      { delete: '删除成功', enable: '启用成功', terminate: '终止成功' }[action],
    );
    await load();
  } catch {
    /* The shared request interceptor displays API errors. */
  } finally {
    busyId.value = undefined;
  }
}
onMounted(load);
function guardImport() {
  if (importing.value) {
    message.warning('正在导入任务，请完成后再离开页面');
    return false;
  }
  if (busy.value) {
    message.warning('正在处理任务，请完成后再离开页面');
    return false;
  }
  return true;
}
onBeforeRouteLeave(guardImport);
onBeforeRouteUpdate(guardImport);
</script>
<template>
  <Page
    title="上新任务管理"
    description="管理商品上新任务、流程状态、处理人及计划时间"
  >
    <Card class="mb-4!" :bordered="false">
      <TaskFilters
        v-model="query"
        manager
        default-expanded
        :loading="loading || busy"
        @search="search"
        @reset="reset"
      />
    </Card>
    <Card title="任务列表" :bordered="false">
      <template #extra>
        <Space>
          <span v-if="selectedIds.length">已选择 {{ selectedIds.length }} 项</span>
          <Popconfirm
            :open="deleteConfirmOpen"
            :title="`确定删除选中的 ${selectedIds.length} 个上新任务？`"
            @open-change="changeDeleteConfirmation"
            @confirm="deleteSelected"
          >
            <Button danger :loading="batchDeleting">
              <span>批量删除</span>
            </Button>
          </Popconfirm>
          <Button :href="templateUrl" download="template-tasks.xlsx">
            <span>Excel模板下载</span>
          </Button>
          <Button :loading="loading" :disabled="busy" @click="load">
            <span>刷新</span>
          </Button>
          <Button
            type="primary"
            :disabled="busy || importOpen"
            @click="importOpen = true"
          >
            <span>Excel导入</span>
          </Button>
        </Space>
      </template>
      <Table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="{ ...pagination, disabled: busy }"
        :row-selection="rowSelection"
        :scroll="{ x: 2330 }"
        row-key="id"
        @change="change"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'visualLevel'">
            {{ optionLabel(visualLevelOptions, record.visualLevel) }}
          </template>
          <Tag
            v-else-if="column.key === 'flowStatus'"
            :color="statusColor(record.flowStatus)"
          >
            {{ optionLabel(flowStatusOptions, record.flowStatus) }}
          </Tag>
          <template v-else-if="column.key === 'assignee'">
            {{
              record.currentNodeAssigneeName ||
              record.currentNodeAssigneeId ||
              '-'
            }}
          </template>
          <OverdueStatus
            v-else-if="column.key === 'dateOverdueStatus'"
            :task="record as LaunchTask"
            kind="date"
          />
          <OverdueStatus
            v-else-if="column.key === 'timeOverdueStatus'"
            :task="record as LaunchTask"
            kind="time"
          />
          <Space v-else-if="column.key === 'action'" :size="0">
            <Button
              type="link"
              size="small"
              :disabled="busy"
              @click="
                router.push({
                  path: '/launch/process',
                  query: { taskId: String(record.id) },
                })
              "
            >
              <span>流程详情</span>
            </Button>
            <Button
              type="link"
              size="small"
              :disabled="busy"
              @click="openEditor(record.id)"
            >
              <span>编辑</span>
            </Button>
            <Popconfirm
              v-if="record.flowStatus === 0"
              title="确定启用该草稿任务？"
              @confirm="mutate(record.id, 'enable')"
            >
              <Button type="link" size="small" :disabled="busy">
                <span>启用</span>
              </Button>
            </Popconfirm>
            <Popconfirm
              v-if="[1, 2, 4].includes(record.flowStatus)"
              title="确定终止该任务？"
              @confirm="mutate(record.id, 'terminate')"
            >
              <Button
                type="link"
                size="small"
                danger
                :disabled="busy"
              >
                <span>终止</span>
              </Button>
            </Popconfirm>
            <Popconfirm
              title="确定删除该上新任务？"
              @confirm="mutate(record.id, 'delete')"
            >
              <Button
                type="link"
                size="small"
                danger
                :loading="busyId === record.id"
                :disabled="busy"
              >
                <span>删除</span>
              </Button>
            </Popconfirm>
          </Space>
        </template>
      </Table>
    </Card>
    <TaskImport
      v-if="importOpen"
      @busy="importing = $event"
      @imported="load"
      @close="importOpen = false"
    />
    <TaskEditor
      v-if="editingId !== undefined"
      :id="editingId"
      @saved="load"
      @close="editingId = undefined"
    />
  </Page>
</template>
