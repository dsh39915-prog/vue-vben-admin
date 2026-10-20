<script setup lang="ts">
import type { LaunchTask } from '#/api';

import { onMounted, onUnmounted, ref } from 'vue';

import {
  Alert,
  Button,
  Descriptions,
  DescriptionsItem,
  Divider,
  Modal,
  Spin,
} from 'ant-design-vue';

import { getLaunchTaskApi } from '#/api';

import TaskSummary from './task-summary.vue';

const props = defineProps<{ task: LaunchTask }>();
const emit = defineEmits<{ close: [] }>();
const loading = ref(true);
const failed = ref(false);
const detail = ref<LaunchTask>();
let latestRequest = 0;
const taskFields = [
  ['id', '任务 ID'],
  ['createUserId', '创建人 ID'],
  ['createTime', '创建时间'],
] as const;
const flowFields = [
  ['procInstId', '流程实例 ID'],
  ['processName', '流程名称'],
  ['currentNodeKey', '节点 Key'],
  ['currentNodeAssigneeId', '处理人 ID'],
  ['currentNodeTaskId', '节点任务 ID'],
  ['currentNodeCreateTime', '节点创建时间'],
] as const;
function display(key: keyof LaunchTask) {
  const value = detail.value?.[key];
  return value === null || value === undefined || value === ''
    ? '-'
    : String(value);
}
async function load() {
  const request = ++latestRequest;
  loading.value = true;
  failed.value = false;
  detail.value = undefined;
  try {
    const data = await getLaunchTaskApi(props.task.id);
    if (request !== latestRequest) return;
    if (!data) {
      failed.value = true;
      return;
    }
    detail.value = { ...props.task, ...data };
  } catch {
    if (request === latestRequest) failed.value = true;
  } finally {
    if (request === latestRequest) loading.value = false;
  }
}
onMounted(load);
onUnmounted(() => {
  latestRequest += 1;
});
</script>
<template>
  <Modal
    open
    title="上新任务详情"
    :width="1000"
    :footer="null"
    @cancel="emit('close')"
  >
    <Spin :spinning="loading">
      <Alert
        v-if="failed"
        type="error"
        message="任务信息加载失败或记录不存在，请重试"
      >
        <template #action>
          <Button size="small" @click="load">
            <span>重试</span>
          </Button>
        </template>
      </Alert>
      <template v-if="detail">
        <TaskSummary :task="detail" />
        <Divider orientation="left">记录信息</Divider>
        <Descriptions :column="2" bordered size="small">
          <DescriptionsItem
            v-for="[key, label] in taskFields"
            :key="key"
            :label="label"
          >
            <span class="whitespace-pre-wrap break-all">{{
              display(key)
            }}</span>
          </DescriptionsItem>
        </Descriptions>
        <Divider orientation="left">流程信息</Divider>
        <Descriptions :column="2" bordered size="small">
          <DescriptionsItem
            v-for="[key, label] in flowFields"
            :key="key"
            :label="label"
          >
            <span class="whitespace-pre-wrap break-all">{{
              display(key)
            }}</span>
          </DescriptionsItem>
        </Descriptions>
      </template>
    </Spin>
  </Modal>
</template>
