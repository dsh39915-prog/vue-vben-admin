<script setup lang="ts">
import { computed, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Button, Card, Empty, Space } from 'ant-design-vue';

import FlowAction from './components/flow-action.vue';
import TaskFlowDetails from './components/task-flow-details.vue';
import TaskPicker from './components/task-picker.vue';
import TaskSummary from './components/task-summary.vue';
import { useLaunchTask } from './use-launch-task';
import { canHandleTask } from './workflow-helpers';
const operation = ref<'freeze' | 'unfreeze'>();
const {
  task,
  loading,
  failed,
  metadataFailed,
  pickerOpen,
  load,
  choose,
  router,
} = useLaunchTask(() => operation.value !== undefined);
const frozen = computed(
  () =>
    ![3, 5].includes(task.value?.flowStatus ?? 5) &&
    (task.value?.flowStatus === 4 || task.value?.currentNodeStatus === 4),
);
</script>
<template>
  <Page
    title="流程管理"
    description="查看上新任务的节点计划、执行明细和流转记录"
  >
    <Card class="mb-4!" :bordered="false">
      <Space wrap>
        <Button
          type="primary"
          :disabled="loading || !!operation"
          @click="pickerOpen = true"
        >
          <span>选择任务</span>
        </Button>
        <Button
          :disabled="!task || !!operation"
          :loading="loading"
          @click="load"
        >
          <span>刷新流程</span>
        </Button>
        <Button
          v-if="task && canHandleTask(task)"
          :disabled="!!operation"
          @click="
            router.push({
              path: '/launch/workbench',
              query: { taskId: String(task.id) },
            })
          "
        >
          <span>处理任务</span>
        </Button>
        <Button
          v-if="task && canHandleTask(task) && !loading"
          :disabled="!!operation"
          @click="operation = 'freeze'"
        >
          <span>冻结节点</span>
        </Button>
        <Button
          v-if="frozen && task?.procInstId && task.currentNodeKey"
          :disabled="!!operation || loading"
          @click="operation = 'unfreeze'"
        >
          <span>解冻节点</span>
        </Button>
      </Space>
    </Card>
    <Alert v-if="failed" :message="failed" type="error" class="mb-4!">
      <template #action>
        <Button @click="load">
          <span>重试</span>
        </Button>
      </template>
    </Alert>
    <Alert
      v-if="metadataFailed"
      type="warning"
      message="当前节点信息加载失败，节点操作暂不可用。"
      class="mb-4!"
    />
    <Empty v-if="!task && !loading && !failed" description="请选择上新任务" />
    <template v-if="task">
      <TaskSummary :task="task" />
      <TaskFlowDetails :task="task" />
    </template>
    <TaskPicker
      v-if="pickerOpen"
      @select="choose"
      @close="pickerOpen = false"
    />
    <FlowAction
      v-if="operation && task"
      :task="task"
      :operation="operation"
      @close="operation = undefined"
      @changed="load"
    />
  </Page>
</template>
