<script setup lang="ts">
import type { FlowNodeDetail, FlowTransferRecord, LaunchTask } from '#/api';

import { onUnmounted, ref, watch } from 'vue';

import { Alert, Button, Card, Table, TabPane, Tabs } from 'ant-design-vue';

import { getFlowNodesApi, getFlowTransfersApi } from '#/api';
const props = defineProps<{ task: LaunchTask }>();
const nodes = ref<FlowNodeDetail[]>([]);
const transfers = ref<FlowTransferRecord[]>([]);
const nodesLoading = ref(false);
const transfersLoading = ref(false);
const nodesFailed = ref(false);
const transfersFailed = ref(false);
let nodeRequest = 0;
let transferRequest = 0;
const nodeColumns = [
  { title: '节点', dataIndex: 'nodeName', width: 190 },
  { title: '状态', dataIndex: 'nodeStatusText', width: 100 },
  { title: '处理人', dataIndex: 'assigneeName', width: 120 },
  { title: '计划开始', dataIndex: 'planStartTime', width: 180 },
  { title: '计划完成', dataIndex: 'planEndTime', width: 180 },
  { title: '计划耗时', dataIndex: 'planDuration', width: 100 },
  { title: '实际开始', dataIndex: 'actualStartTime', width: 180 },
  { title: '实际完成', dataIndex: 'actualCompleteTime', width: 180 },
  { title: '实际耗时', dataIndex: 'actualDuration', width: 100 },
  { title: '日期逾期', dataIndex: 'dateOverdueDesc', width: 130 },
  { title: '耗时逾期', dataIndex: 'timeOverdueDesc', width: 130 },
];
const transferColumns = [
  { title: '操作时间', dataIndex: 'operateTime', width: 180 },
  { title: '节点', dataIndex: 'nodeName', width: 190 },
  { title: '处理结果', dataIndex: 'operateTypeName', width: 150 },
  { title: '操作人', dataIndex: 'operatorName', width: 150 },
  { title: '审核意见', dataIndex: 'contentText' },
];
async function loadNodes() {
  const id = props.task.id;
  const request = ++nodeRequest;
  nodes.value = [];
  nodesFailed.value = false;
  if (!id) {
    nodesLoading.value = false;
    return;
  }
  nodesLoading.value = true;
  try {
    const data = await getFlowNodesApi(String(id), 0);
    if (request !== nodeRequest) return;
    if (!Array.isArray(data)) throw new Error('Invalid nodes');
    nodes.value = data;
  } catch {
    if (request === nodeRequest) nodesFailed.value = true;
  } finally {
    if (request === nodeRequest) nodesLoading.value = false;
  }
}
async function loadTransfers() {
  const proc = props.task.procInstId;
  const request = ++transferRequest;
  transfers.value = [];
  transfersFailed.value = false;
  if (!proc) {
    transfersLoading.value = false;
    return;
  }
  transfersLoading.value = true;
  try {
    const data = await getFlowTransfersApi(proc);
    if (request === transferRequest) transfers.value = data;
  } catch {
    if (request === transferRequest) transfersFailed.value = true;
  } finally {
    if (request === transferRequest) transfersLoading.value = false;
  }
}
watch(
  () => props.task,
  () => {
    void loadNodes();
    void loadTransfers();
  },
  { immediate: true },
);
onUnmounted(() => {
  nodeRequest += 1;
  transferRequest += 1;
});
</script>
<template>
  <Tabs>
    <TabPane key="nodes" tab="节点明细">
      <Card
        :title="`${task.styleNo} · 节点明细`"
        class="mb-4!"
        :bordered="false"
      >
        <template #extra>
          <Button :loading="nodesLoading" @click="loadNodes">
            <span>刷新节点</span>
          </Button>
        </template>
        <Alert
          v-if="nodesFailed"
          type="error"
          message="节点明细加载失败，请重试"
          class="mb-4!"
        />
        <Table
          :columns="nodeColumns"
          :data-source="nodes"
          :loading="nodesLoading"
          :pagination="false"
          :scroll="{ x: 1650 }"
          :row-key="(_record: FlowNodeDetail, index?: number) => index ?? 0"
        />
      </Card>
    </TabPane>
    <TabPane key="transfers" tab="流转记录">
      <Card title="流转记录" :bordered="false">
        <template #extra>
          <Button :loading="transfersLoading" @click="loadTransfers">
            <span>刷新记录</span>
          </Button>
        </template>
        <Alert
          v-if="transfersFailed"
          type="error"
          message="流转记录接口未返回有效数据或加载失败，请重试"
          class="mb-4!"
        />
        <Table
          :columns="transferColumns"
          :data-source="transfers"
          :loading="transfersLoading"
          :pagination="false"
          :scroll="{ x: 900 }"
          :row-key="(_record: FlowTransferRecord, index?: number) => index ?? 0"
        />
      </Card>
    </TabPane>
  </Tabs>
</template>
