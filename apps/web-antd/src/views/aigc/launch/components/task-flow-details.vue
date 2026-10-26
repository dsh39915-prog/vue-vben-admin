<script setup lang="ts">
import type { FlowNodeDetail, FlowTransferRecord, LaunchTask } from '#/api';

import { computed, onUnmounted, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  Image,
  Modal,
  Table,
  TabPane,
  Tabs,
} from 'ant-design-vue';

import { getFlowNodesApi, getFlowTransfersApi } from '#/api';

import ImageUploadItem from '../../common/image-upload-item.vue';
import { decodeImages, imageUrl } from '../workflow-helpers';
const props = defineProps<{ task: LaunchTask }>();
const nodes = ref<FlowNodeDetail[]>([]);
const transfers = ref<FlowTransferRecord[]>([]);
const nodesLoading = ref(false);
const transfersLoading = ref(false);
const nodesFailed = ref(false);
const transfersFailed = ref(false);
const detail = ref<
  | { kind: 'node'; record: FlowNodeDetail }
  | { kind: 'transfer'; record: FlowTransferRecord }
>();
const attachments = computed(() => {
  const raw =
    detail.value?.kind === 'transfer' ? detail.value.record.imageUrls : null;
  try {
    if (!raw || raw === 'null' || (typeof raw === 'string' && !raw.trim()))
      return { images: [], failed: false };
    const list: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (list === null) return { images: [], failed: false };
    if (!Array.isArray(list)) throw new Error('Invalid attachments');
    const images = list.flatMap((item) => decodeImages(item));
    if (images.some((image) => !imageUrl(image, true)))
      throw new Error('Invalid attachment URL');
    return { images, failed: false };
  } catch {
    return { images: [], failed: true };
  }
});
let nodeRequest = 0;
let transferRequest = 0;
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
  if (detail.value?.kind === 'node') detail.value = undefined;
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
  if (detail.value?.kind === 'transfer') detail.value = undefined;
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
    detail.value = undefined;
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
          :scroll="{ x: 1740 }"
          :row-key="(_record: FlowNodeDetail, index?: number) => index ?? 0"
        >
          <template #bodyCell="{ column, record }">
            <Button
              v-if="column.key === 'action'"
              type="link"
              @click="detail = { kind: 'node', record: record as FlowNodeDetail }"
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
              @click="
                detail = { kind: 'transfer', record: record as FlowTransferRecord }
              "
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
    :width="760"
    :footer="null"
    :body-style="{ maxHeight: 'calc(100dvh - 180px)', overflowY: 'auto' }"
    @cancel="detail = undefined"
  >
    <Descriptions
      v-if="detail.kind === 'node'"
      :column="{ xs: 1, sm: 2 }"
      layout="vertical"
    >
      <DescriptionsItem
        v-for="field in nodeFields"
        :key="field.dataIndex"
        :label="field.title"
      >
        <span class="whitespace-pre-wrap break-words">{{
          detail.record[field.dataIndex] ?? '-'
        }}</span>
      </DescriptionsItem>
    </Descriptions>
    <template v-else>
      <Descriptions :column="1" layout="vertical">
        <DescriptionsItem
          v-for="[key, label] in transferFields"
          :key="key"
          :label="label"
        >
          <span class="whitespace-pre-wrap break-words">{{
            detail.record[key] || '-'
          }}</span>
        </DescriptionsItem>
        <DescriptionsItem label="审核意见/备注说明">
          <span class="whitespace-pre-wrap break-words">{{
            detail.record.contentText || '-'
          }}</span>
        </DescriptionsItem>
      </Descriptions>
      <Alert
        v-if="attachments.failed"
        type="warning"
        message="图片附件数据格式不正确，暂无法展示，请刷新记录后重试"
        show-icon
      />
      <Image.PreviewGroup v-else-if="attachments.images.length">
        <div class="flex flex-wrap gap-3" aria-label="图片附件">
          <ImageUploadItem
            v-for="(image, index) in attachments.images"
            :key="`${image.originalUrl}:${index}`"
            :src="imageUrl(image)"
            :preview-src="image.previewUrl || image.originalUrl"
            :original-url="imageUrl(image, true)"
            :alt="`图片附件 ${index + 1}`"
          />
        </div>
      </Image.PreviewGroup>
      <p v-else class="mb-0 text-muted-foreground">暂无图片附件</p>
    </template>
  </Modal>
</template>
