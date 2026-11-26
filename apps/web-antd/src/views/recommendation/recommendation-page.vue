<script setup lang="ts">
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';

import type {
  Recommendation,
  RecommendationContext,
  RecommendationOrderInput,
  RecommendationVersion,
} from '#/api';

import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  getRecommendationListApi,
  updateRecommendationOrderApi,
  updateRecommendationSlotApi,
} from '#/api';
import CacheReloadButton from '#/components/cache-reload-button.vue';
import DownloadStats from '#/components/download-stats.vue';
import PromotionPackage from '#/components/promotion-package.vue';
import { useMenuTitle } from '#/composables/use-menu-title';
import { usePagedList } from '#/composables/use-paged-list';

import { coopOptions, sortOptions, statusOptions } from '../app-info/data';
import { recommendationCacheTarget } from './cache-target';
import { audienceOptions, platformOptions, sectionOptions } from './data';
import {
  defaultRecommendationSelection,
  recommendationFilters,
} from './filter-selection';
import RecommendationFilters from './recommendation-filters.vue';

const props = defineProps<{ iosVersion: RecommendationVersion }>();
const title = useMenuTitle();
const selection = ref(defaultRecommendationSelection());
const cacheTarget = computed(() => recommendationCacheTarget(selection.value));
let appliedSelection = { ...selection.value };
let appliedFilters = recommendationFilters(selection.value);
const working = ref(false);
const {
  records,
  loading,
  failed: listFailed,
  pagination,
  load: loadList,
} = usePagedList(
  (page, pageSize) =>
    getRecommendationListApi({
      ...appliedFilters,
      iosVersion: props.iosVersion,
      page,
      pageSize,
    }),
  { pageSize: 50 },
);
const actionsDisabled = computed(
  () => loading.value || working.value || listFailed.value,
);
watch(selection, (value) => {
  pagination.current = 1;
  appliedSelection = { ...value };
  appliedFilters = recommendationFilters(value);
  void loadList(1);
});

function changePage(value: TablePaginationConfig) {
  const size = value.pageSize ?? pagination.pageSize;
  void loadList(size === pagination.pageSize ? (value.current ?? 1) : 1, size);
}
async function reloadAfterUpdate() {
  await loadList();
  if (
    !listFailed.value &&
    records.value.length === 0 &&
    pagination.current > 1
  ) {
    const lastPage = Math.max(
      1,
      Math.ceil(pagination.total / pagination.pageSize),
    );
    await loadList(Math.min(pagination.current - 1, lastPage));
  }
}

const columns: TableColumnsType<Recommendation> = [
  { dataIndex: 'remdId', title: '推荐位置', width: 100, fixed: 'left' },
  { dataIndex: 'id', title: '应用 ID', width: 110 },
  { dataIndex: 'appName', title: '应用名称', width: 220, ellipsis: true },
  {
    dataIndex: 'shortShortNote',
    title: '简短描述',
    width: 220,
    ellipsis: true,
  },
  { dataIndex: 'sort', title: '类型', width: 80 },
  { dataIndex: 'typeName', title: '分类', width: 100 },
  { dataIndex: 'platform', title: '运行平台', width: 140 },
  { dataIndex: 'isRemd', title: '是否推广包', width: 300 },
  { dataIndex: 'channelId', title: '渠道 ID', width: 110 },
  { dataIndex: 'sourceId', title: '来源 ID', width: 240, ellipsis: true },
  { dataIndex: 'size', title: '大小', width: 110 },
  { key: 'downloadStats', title: '下载统计', width: 140, align: 'center' },
  { dataIndex: 'updateTime', title: '更新时间', width: 180 },
  { dataIndex: 'status', title: '状态', width: 100 },
  { key: 'action', title: '操作', width: 190, fixed: 'right' },
];
function rowKey(record: Recommendation) {
  return `${record.id ?? 'empty'}:${record.remdId}`;
}
function canUpdate(record: Recommendation) {
  return (
    record.id !== null &&
    record.id > 0 &&
    record.type !== null &&
    record.type > 0
  );
}
function orderInput(
  record: Recommendation,
  order: number,
): RecommendationOrderInput | undefined {
  if (!canUpdate(record)) return;
  return {
    id: record.id as number,
    type: appliedFilters.column,
    platform: appliedFilters.platform,
    iosVersion: props.iosVersion,
    order,
    info: '',
  };
}
function label(
  options: { label: string; value: number }[],
  value: null | number,
) {
  return options.find((item) => item.value === value)?.label ?? value ?? '—';
}

const editorOpen = ref(false);
const editorMode = ref<'order' | 'slot'>('order');
const slotOperation = ref<-1 | 1>(1);
const editor = reactive({
  position: undefined as number | undefined,
  info: '',
});
const formRef = ref<FormInstance>();
let selectedOrder: RecommendationOrderInput | undefined;
let selectedContext: RecommendationContext | undefined;
const selectedName = ref('');
const contextLabel = ref('');
const editorTitle = computed(() => {
  if (editorMode.value === 'order')
    return `调整推荐位置：${selectedName.value}`;
  return slotOperation.value === 1 ? '添加推荐空位' : '删除推荐空位';
});
function validPosition(_rule: unknown, value: unknown) {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 2_147_483_647
  )
    return Promise.resolve();
  return Promise.reject(new Error('请输入有效的正整数推荐位置'));
}
async function openEditor(record?: Recommendation, operType: -1 | 1 = 1) {
  if (actionsDisabled.value) return;
  selectedContext = { ...appliedFilters, iosVersion: props.iosVersion };
  selectedOrder = record ? orderInput(record, record.remdId) : undefined;
  if (record && !selectedOrder) return;
  editorMode.value = record ? 'order' : 'slot';
  slotOperation.value = operType;
  editor.position = record?.remdId;
  editor.info = '';
  selectedName.value = record?.appName ?? '';
  const audience =
    audienceOptions.find((item) => item.value === appliedSelection.audience)
      ?.label ?? '';
  const platform =
    platformOptions.find((item) => item.value === appliedFilters.platform)
      ?.label ?? appliedFilters.platform;
  const contextParts = [platform, audience];
  if (appliedSelection.audience !== 'featured') {
    contextParts.push(
      sectionOptions.find((item) => item.value === appliedSelection.section)
        ?.label ?? '',
    );
  }
  contextLabel.value = contextParts.join(' / ');
  editorOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}
async function save() {
  if (working.value) return;
  working.value = true;
  try {
    await formRef.value?.validate();
    if (editor.position === undefined) return;
    if (editorMode.value === 'order' && selectedOrder) {
      await updateRecommendationOrderApi({
        ...selectedOrder,
        order: editor.position,
        info: editor.info.trim(),
      });
    } else if (editorMode.value === 'slot' && selectedContext) {
      await updateRecommendationSlotApi({
        ...selectedContext,
        remdNum: editor.position,
        operType: slotOperation.value,
      });
    } else {
      return;
    }
    message.success('操作成功');
    editorOpen.value = false;
    await reloadAfterUpdate();
  } catch {
    // 请求拦截器显示服务端错误，保留弹窗以便重试。
  } finally {
    working.value = false;
  }
}
async function cancelRecommendation(record: Recommendation) {
  if (actionsDisabled.value) return;
  const data = orderInput(record, 0);
  if (!data) return;
  working.value = true;
  try {
    await updateRecommendationOrderApi(data);
    message.success('已取消推荐');
    await reloadAfterUpdate();
  } catch {
    // 请求拦截器显示服务端错误，保留列表以便重试。
  } finally {
    working.value = false;
  }
}
onMounted(() => {
  void loadList();
});
</script>

<template>
  <Page :title="title">
    <Card class="filter-card" title="筛选条件">
      <RecommendationFilters v-model="selection" :disabled="working" />
    </Card>
    <Card title="推荐列表">
      <template #extra>
        <Space>
          <CacheReloadButton
            :cache-type="cacheTarget.type"
            :label="cacheTarget.label"
            :disabled="working || loading || editorOpen"
          />
          <Button :loading="loading" :disabled="working" @click="loadList()">
            刷新
          </Button>
          <Button
            type="primary"
            :disabled="actionsDisabled"
            @click="openEditor()"
          >
            添加空位
          </Button>
          <Button
            danger
            :disabled="actionsDisabled"
            @click="openEditor(undefined, -1)"
          >
            删除空位
          </Button>
        </Space>
      </template>
      <Alert
        v-if="listFailed"
        class="mb-4"
        message="推荐列表加载失败，请刷新重试"
        type="error"
        show-icon
      />
      <Table
        :columns="columns"
        :data-source="records"
        :loading="loading"
        :row-key="rowKey"
        :scroll="{ x: 2600 }"
        :pagination="{
          ...pagination,
          disabled: loading || working,
          showSizeChanger: true,
          pageSizeOptions: ['20', '50', '100'],
          showTotal: (total) => `共 ${total} 条`,
        }"
        @change="changePage"
      >
        <template #bodyCell="{ column, record, text }">
          <Space
            v-if="
              column.key === 'action' && canUpdate(record as Recommendation)
            "
          >
            <Button
              type="link"
              size="small"
              :disabled="actionsDisabled"
              @click="openEditor(record as Recommendation)"
            >
              调整位置
            </Button>
            <Popconfirm
              :title="`确定取消「${record.appName}」的推荐吗？`"
              ok-text="取消推荐"
              cancel-text="返回"
              :disabled="actionsDisabled"
              @confirm="cancelRecommendation(record as Recommendation)"
            >
              <Button
                type="link"
                size="small"
                danger
                :disabled="actionsDisabled"
              >
                取消推荐
              </Button>
            </Popconfirm>
          </Space>
          <template v-else-if="column.key === 'action'">—</template>
          <DownloadStats
            v-else-if="column.key === 'downloadStats'"
            :count="record.downloadCount"
            :base="record.downloadBase"
          />
          <template v-else-if="column.dataIndex === 'appName'">
            <span :style="{ color: record.scolor || undefined }">{{
              record.id > 0 ? (record.appName ?? '—') : '推荐空位'
            }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'sort'">
            {{ label(sortOptions, text) }}
          </template>
          <template v-else-if="column.dataIndex === 'platform'">
            {{
              { 101: 'iPhone', 102: 'iPad', 103: 'iPhone & iPad' }[
                text as 101 | 102 | 103
              ] ??
              text ??
              '—'
            }}
          </template>
          <PromotionPackage
            v-else-if="column.dataIndex === 'isRemd'"
            :is-remd="record.isRemd"
            :channel="record.channel"
            :cooperation="label(coopOptions, record.coopModel)"
          />
          <Tag
            v-else-if="column.dataIndex === 'status'"
            :color="text === 1 ? 'success' : 'default'"
          >
            {{ label(statusOptions, text) }}
          </Tag>
          <template v-else>{{ text ?? '—' }}</template>
        </template>
      </Table>
    </Card>
    <Modal
      v-model:open="editorOpen"
      :title="editorTitle"
      :confirm-loading="working"
      :mask-closable="false"
      :keyboard="!working"
      :closable="!working"
      :cancel-button-props="{ disabled: working }"
      :ok-text="editorMode === 'slot' && slotOperation === -1 ? '删除' : '保存'"
      @ok="save"
    >
      <p class="mb-4 text-sm text-muted-foreground">{{ contextLabel }}</p>
      <Alert
        v-if="editorMode === 'slot' && slotOperation === -1"
        class="mb-4"
        type="warning"
        message="将删除指定推荐位置的空位，请确认位置后提交。"
        show-icon
      />
      <Form
        ref="formRef"
        name="recommendation-editor"
        :model="editor"
        layout="vertical"
        :disabled="working"
        @finish="save"
      >
        <FormItem
          name="position"
          label="推荐位置"
          :rules="[{ validator: validPosition }]"
        >
          <InputNumber
            v-model:value="editor.position"
            class="w-full"
            :min="1"
            :max="2_147_483_647"
            :precision="0"
          />
        </FormItem>
        <FormItem v-if="editorMode === 'order'" name="info" label="修改说明">
          <Input.TextArea
            v-model:value="editor.info"
            :rows="3"
            :maxlength="500"
            allow-clear
          />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>
