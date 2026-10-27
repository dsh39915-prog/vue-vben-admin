<script setup lang="ts">
import type {
  FlowNodeDetail,
  FlowNodeDetailInfo,
  FlowTransferRecord,
  LaunchTask,
} from '#/api';

import { onUnmounted, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Card,
  Empty,
  Modal,
  Spin,
  Table,
  TabPane,
  Tabs,
} from 'ant-design-vue';

import {
  getFlowNodeDetailInfoApi,
  getFlowNodesApi,
  getFlowTransfersApi,
} from '#/api';

import FlowRecordAttachments from './flow-record-attachments.vue';
const props = defineProps<{ task: LaunchTask }>();
const nodes = ref<FlowNodeDetail[]>([]);
const transfers = ref<FlowTransferRecord[]>([]);
const nodesLoading = ref(false);
const transfersLoading = ref(false);
const nodesFailed = ref(false);
const transfersFailed = ref(false);
const nodeInfo = ref<FlowNodeDetailInfo>();
const detailLoading = ref(false);
const detailError = ref('');
const detail = ref<
  | { kind: 'node'; record: FlowNodeDetail }
  | { kind: 'transfer'; record: FlowTransferRecord }
>();
let nodeRequest = 0;
let transferRequest = 0;
let detailRequest = 0;
const nodeInfoFields = [
  ['nodeName', '节点名称'],
  ['nodeStatusText', '当前状态'],
  ['totalExecuteCount', '总执行次数'],
  ['totalRejectCount', '被驳回次数'],
  ['planStartTime', '计划开始时间'],
  ['planEndTime', '计划完成时间'],
  ['firstActualStartTime', '实际开始时间（首次）'],
  ['lastActualCompleteTime', '实际完成时间（最近）'],
  ['planDuration', '计划耗时'],
  ['actualDuration', '实际耗时'],
  ['dateOverdueDesc', '日期逾期情况'],
  ['timeOverdueDesc', '耗时逾期情况'],
] as const;
const operateFields = [
  ['operateTypeName', '处理结果'],
  ['actualStartTime', '实际开始时间'],
  ['actualCompleteTime', '实际完成时间'],
  ['actualDuration', '实际耗时'],
  ['operatorName', '处理人'],
] as const;
function detailValue(key: string, value: null | number | string | undefined) {
  if (value == null || value === '') return '-';
  if (key === 'totalExecuteCount' || key === 'totalRejectCount')
    return `${value}次`;
  if (key === 'planDuration' || key === 'actualDuration') return `${value}小时`;
  return value;
}
function closeDetail() {
  detailRequest += 1;
  detail.value = undefined;
  nodeInfo.value = undefined;
  detailLoading.value = false;
  detailError.value = '';
}
async function openNodeDetail(record: FlowNodeDetail) {
  closeDetail();
  detail.value = { kind: 'node', record };
  const request = ++detailRequest;
  const { planId } = record;
  if (planId == null || !String(planId).trim()) {
    detailError.value = '缺少节点计划ID，请刷新节点列表后重试';
    return;
  }
  detailLoading.value = true;
  try {
    const data = await getFlowNodeDetailInfoApi(planId);
    if (request !== detailRequest) return;
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error('节点详情接口未返回有效数据');
    nodeInfo.value = data;
  } catch (error) {
    if (request === detailRequest)
      detailError.value =
        error instanceof Error ? error.message : '节点详情加载失败，请重试';
  } finally {
    if (request === detailRequest) detailLoading.value = false;
  }
}
function openTransferDetail(record: FlowTransferRecord) {
  closeDetail();
  detail.value = { kind: 'transfer', record };
}
const nodeFields = [
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
] as const;
const nodeColumns = [
  ...nodeFields,
  { title: '操作', key: 'action', width: 90, fixed: 'right' as const },
];
const transferColumns = [
  { title: '操作时间', dataIndex: 'operateTime', width: 180 },
  { title: '节点', dataIndex: 'nodeName', width: 190 },
  { title: '处理结果', dataIndex: 'operateTypeName', width: 150 },
  { title: '操作人', dataIndex: 'operatorName', width: 150 },
  { title: '审核意见', dataIndex: 'contentText' },
  { title: '操作', key: 'action', width: 90, fixed: 'right' as const },
];
const transferFields = [
  ['nodeName', '节点名称'],
  ['operateTypeName', '处理结果'],
  ['operatorName', '处理人'],
  ['operateTime', '操作时间'],
] as const;
async function loadNodes() {
  const id = props.task.id;
  const request = ++nodeRequest;
  if (detail.value?.kind === 'node') closeDetail();
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
  if (detail.value?.kind === 'transfer') closeDetail();
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
    closeDetail();
    void loadNodes();
    void loadTransfers();
  },
  { immediate: true },
);
onUnmounted(() => {
  nodeRequest += 1;
  transferRequest += 1;
  detailRequest += 1;
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
          :scroll="{ x: 1740 }"
          :row-key="
            (record: FlowNodeDetail) =>
              String(record.planId ?? record.nodeName ?? '')
          "
        >
          <template #bodyCell="{ column, record }">
            <Button
              v-if="column.key === 'action'"
              type="link"
              @click="openNodeDetail(record as FlowNodeDetail)"
            >
              <span>详情</span>
            </Button>
          </template>
        </Table>
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
          :scroll="{ x: 990 }"
          :row-key="(_record: FlowTransferRecord, index?: number) => index ?? 0"
        >
          <template #bodyCell="{ column, record }">
            <Button
              v-if="column.key === 'action'"
              type="link"
              @click="openTransferDetail(record as FlowTransferRecord)"
            >
              <span>详情</span>
            </Button>
          </template>
        </Table>
      </Card>
    </TabPane>
  </Tabs>
  <Modal
    v-if="detail"
    open
    :title="detail.kind === 'node' ? '节点明细详情' : '流转记录详情'"
    :width="detail.kind === 'node' ? 820 : 640"
    :footer="null"
    :body-style="{ maxHeight: 'calc(100dvh - 180px)', overflowY: 'auto' }"
    @cancel="closeDetail"
  >
    <Spin v-if="detail.kind === 'node'" :spinning="detailLoading">
      <Alert v-if="detailError" type="error" :message="detailError" show-icon>
        <template #action>
          <Button @click="openNodeDetail(detail.record)">重试</Button>
        </template>
      </Alert>
      <template v-else-if="nodeInfo">
        <dl class="node-detail-grid node-summary">
          <div
            v-for="[key, label] in nodeInfoFields"
            :key="key"
            class="detail-field"
          >
            <dt>{{ label }}：</dt>
            <dd>{{ detailValue(key, nodeInfo[key]) }}</dd>
          </div>
        </dl>
        <h3 class="mb-3 text-base font-semibold">处理轮次记录</h3>
        <section
          v-for="(round, index) in nodeInfo.roundRecordList"
          :key="index"
          class="node-round"
          :aria-label="`第${round.roundNo}轮`"
        >
          <header class="node-round-heading">
            <span class="shrink-0 font-medium">第{{ round.roundNo }}轮</span>
            <span class="min-w-0 break-words">来源：{{ round.roundSource || '-' }}</span>
          </header>
          <section
            v-for="(operation, operateIndex) in round.operateList"
            :key="operateIndex"
            class="node-operation"
          >
            <dl class="node-detail-grid">
              <div
                v-for="[key, label] in operateFields"
                :key="key"
                class="detail-field"
                :class="{ 'is-full': key === 'operateTypeName' }"
              >
                <dt>{{ label }}：</dt>
                <dd>{{ detailValue(key, operation[key]) }}</dd>
              </div>
              <div class="detail-field is-full">
                <dt>备注信息：</dt>
                <dd>{{ operation.contentText || '-' }}</dd>
              </div>
            </dl>
            <FlowRecordAttachments :value="operation.imageUrls" indented />
          </section>
          <p
            v-if="!round.operateList?.length"
            class="mb-0 text-muted-foreground"
          >
            暂无操作记录
          </p>
        </section>
        <Empty
          v-if="!nodeInfo.roundRecordList?.length"
          description="暂无轮次记录"
        />
      </template>
      <div v-else class="h-32"></div>
    </Spin>
    <section v-else class="transfer-detail">
      <dl class="transfer-detail-fields">
        <div v-for="[key, label] in transferFields" :key="key">
          <dt>{{ label }}</dt>
          <dd>{{ detail.record[key] || '-' }}</dd>
        </div>
        <div>
          <dt>审核意见/备注说明</dt>
          <dd>
            <p class="mb-0">{{ detail.record.contentText || '-' }}</p>
            <div class="transfer-detail-attachments">
              <FlowRecordAttachments
                :value="detail.record.imageUrls"
                show-empty
              />
            </div>
          </dd>
        </div>
      </dl>
    </section>
  </Modal>
</template>

<style scoped>
.transfer-detail {
  padding: 16px 0 4px;
}

.transfer-detail-fields {
  display: grid;
  gap: 24px;
  margin: 0;
}

.transfer-detail-fields dt {
  font-size: 13px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

.transfer-detail-fields dd {
  padding-left: 20px;
  margin: 8px 0 0;
  line-height: 1.75;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.transfer-detail-attachments {
  margin-top: 12px;
  white-space: normal;
}

.node-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 24px;
  margin: 0;
  line-height: 1.7;
}

.node-summary {
  margin: 12px 0 28px;
}

.detail-field {
  min-width: 0;
  overflow-wrap: anywhere;
}

.detail-field dt,
.detail-field dd {
  display: inline;
  margin: 0;
}

.detail-field dt {
  color: hsl(var(--muted-foreground));
}

.detail-field dd {
  white-space: pre-wrap;
}

.detail-field.is-full {
  grid-column: 1 / -1;
}

.node-round {
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.node-round-heading {
  display: flex;
  gap: 16px 32px;
  align-items: baseline;
  margin-bottom: 18px;
}

.node-operation + .node-operation {
  margin-top: 28px;
}

@media (max-width: 639px) {
  .node-detail-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }

  .node-round {
    padding: 12px;
  }

  .node-round-heading {
    flex-wrap: wrap;
    gap: 8px 20px;
  }
}
</style>
