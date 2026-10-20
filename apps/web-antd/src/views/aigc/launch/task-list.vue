<script setup lang="ts">
import type { LaunchTask, LaunchTaskFilters } from '#/api';

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

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
import TaskDetail from './components/task-detail.vue';
import TaskEditor from './components/task-editor.vue';
import TaskFilters from './components/task-filters.vue';
import {
  flowStatusOptions,
  normalizeTaskFilters,
  optionLabel,
  statusColor,
  visualLevelOptions,
} from './helpers';
import { canHandleTask } from './workflow-helpers';

const router = useRouter();
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
const detailTask = ref<LaunchTask>();
const busyId = ref<number>();
const columns = [
  { title: '款号', dataIndex: 'styleNo', width: 150, fixed: 'left' as const },
  { title: '开发年份季节', dataIndex: 'productSeason', width: 130 },
  { title: '品类', dataIndex: 'category', width: 120 },
  { title: '视觉层级', key: 'visualLevel', width: 100 },
  { title: '主推平台', dataIndex: 'mainPlatform', width: 190 },
  { title: '流程状态', key: 'flowStatus', width: 110 },
  { title: '当前节点', dataIndex: 'currentNodeName', width: 190 },
  { title: '当前处理人', key: 'assignee', width: 130 },
  {
    title: '节点计划完成时间',
    dataIndex: 'currentNodePlanEndTime',
    width: 180,
  },
  { title: '上新时间', dataIndex: 'launchTime', width: 180 },
  { title: '流程开始时间', dataIndex: 'flowStartTime', width: 180 },
  { title: '商品要求货期', dataIndex: 'productDeadline', width: 180 },
  { title: '日期逾期情况', key: 'dateOverdueStatus', width: 180 },
  { title: '耗时逾期情况', key: 'timeOverdueStatus', width: 180 },
  { title: '创建时间', dataIndex: 'createTime', width: 180 },
  { title: '操作', key: 'action', width: 400, fixed: 'right' as const },
];
function search() {
  return searchPage(normalizeTaskFilters(query.value));
}
function reset() {
  query.value = {};
  void search();
}
function openEditor(id: number) {
  editingId.value = id;
}
function showDetail(id: number) {
  detailTask.value = rows.value.find((item) => item.id === id);
}
async function mutate(id: number, action: 'delete' | 'enable' | 'terminate') {
  if (busyId.value !== undefined) return;
  busyId.value = id;
  try {
    const api = {
      delete: deleteLaunchTaskApi,
      enable: enableLaunchTaskApi,
      terminate: terminateLaunchTaskApi,
    }[action];
    await api(id);
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
        :loading="loading"
        @search="search"
        @reset="reset"
      />
    </Card>
    <Card title="任务列表" :bordered="false">
      <template #extra>
        <Button :loading="loading" @click="load"><span>刷新</span></Button>
      </template>
      <Table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 2500 }"
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
          <Space v-else-if="column.key === 'action'" :size="0" wrap>
            <Button
              v-if="
                canHandleTask(record as LaunchTask) || record.flowStatus === 4
              "
              type="link"
              size="small"
              :disabled="busyId !== undefined"
              @click="
                router.push({
                  path: '/launch/workbench',
                  query: { taskId: String(record.id) },
                })
              "
            >
              <span>处理</span>
            </Button>
            <Button
              type="link"
              size="small"
              :disabled="busyId !== undefined"
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
              :disabled="busyId !== undefined"
              @click="showDetail(record.id)"
            >
              <span>详情</span>
            </Button>
            <Button
              type="link"
              size="small"
              :disabled="busyId !== undefined"
              @click="openEditor(record.id)"
            >
              <span>编辑</span>
            </Button>
            <Popconfirm
              v-if="record.flowStatus === 0"
              title="确定启用该草稿任务？"
              @confirm="mutate(record.id, 'enable')"
            >
              <Button type="link" size="small" :disabled="busyId !== undefined">
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
                :disabled="busyId !== undefined"
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
                :disabled="busyId !== undefined"
              >
                <span>删除</span>
              </Button>
            </Popconfirm>
          </Space>
        </template>
      </Table>
    </Card>
    <TaskEditor
      v-if="editingId !== undefined"
      :id="editingId"
      @saved="load"
      @close="editingId = undefined"
    />
    <TaskDetail
      v-if="detailTask"
      :task="detailTask"
      @close="detailTask = undefined"
    />
  </Page>
</template>
