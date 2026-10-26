<script setup lang="ts">
import { Page } from '@vben/common-ui';
import { ArrowLeft } from '@vben/icons';

import { Alert, Button, Empty } from 'ant-design-vue';

import TaskFlowDetails from './components/task-flow-details.vue';
import TaskSummary from './components/task-summary.vue';
import { useLaunchTask } from './use-launch-task';
const { task, loading, failed, metadataFailed, load, router } = useLaunchTask(
  () => false,
);
</script>
<template>
  <Page
    title="流程管理"
    description="查看上新任务的节点计划、执行明细和流转记录"
  >
    <Button
      type="link"
      class="mb-4! inline-flex! items-center gap-2 px-0!"
      @click="router.push('/launch/tasks')"
    >
      <template #icon><ArrowLeft class="size-4" /></template>
      <span>返回任务列表</span>
    </Button>
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
  </Page>
</template>
