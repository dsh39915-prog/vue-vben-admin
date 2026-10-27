<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';

import type {
  AiImageResultBatch,
  AiImageSourcePage,
  AiStyleImageGroup,
  WorkflowImage,
} from '#/api';

import {
  computed,
  onActivated,
  onDeactivated,
  onUnmounted,
  reactive,
  ref,
  watch,
} from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';

import {
  CircleAlert,
  CircleCheckBig,
  CircleX,
  Inbox,
  LoaderCircle,
} from '@vben/icons';

import {
  Button,
  Card,
  Checkbox,
  Empty,
  Form,
  FormItem,
  Input,
  message,
  Select,
  Space,
  Spin,
  Tag,
} from 'ant-design-vue';

import {
  deleteAiImageResultApi,
  getAiImageApi,
  getAiImageResultBatchesApi,
  getAiImageResultsByStyleIdApi,
} from '#/api';

import ImageUploadItem from '../../common/image-upload-item.vue';
import {
  sourcePageOptions,
  taskStatusColors,
  taskStatusOptions,
} from '../helpers';
import ResultModal from './result-modal.vue';
import ResultUpload from './result-upload.vue';

const props = defineProps<{
  styleId?: string;
  styleNo?: string;
  sourcePage?: AiImageSourcePage;
  embedded?: boolean;
  readOnly?: boolean;
  selectable?: boolean;
  selectedUrls?: string[];
  disabled?: boolean;
  initialBatchId?: 'all' | number;
}>();
const emit = defineEmits<{
  busy: [boolean];
  select: [WorkflowImage];
  batchChange: ['all' | number];
}>();
const uploadOpen = ref(false);
const uploading = ref(false);
const deletingId = ref<number>();
const mutating = computed(
  () => uploading.value || deletingId.value !== undefined,
);
const query = reactive({ styleId: '', sourcePage: props.sourcePage ?? 0 });
const formRef = ref<FormInstance>();
const groups = ref<AiStyleImageGroup[]>([]);
const batches = ref<AiImageResultBatch[]>([]);
const batchCounts = ref(new Map<number, number>());
const uploadBatches = computed(() =>
  batches.value.filter(
    (batch) => Number.isSafeInteger(batch.imgId) && batch.imgId > 0,
  ),
);
type BatchSelection = 'all' | number;
const batchId = ref<BatchSelection>('all');
const batchesLoading = ref(false);
const resultsLoading = ref(false);
const loading = computed(() => batchesLoading.value || resultsLoading.value);
const batchOptions = computed(() => [
  { label: '全部批次', value: 'all' },
  ...batches.value.map((batch) => ({
    label: batch.name || `生图记录 #${batch.imgId}`,
    value: batch.imgId,
  })),
]);
const submittedKey = ref('');
const submittedSourcePage = ref<AiImageSourcePage>(props.sourcePage ?? 0);
const failed = ref(false);
const resultsOpen = ref(false);
const imgId = ref<number>();
const imageCount = computed(() =>
  groups.value.reduce((total, group) => total + (group.list?.length ?? 0), 0),
);
const hasPendingBatches = computed(() => groups.value.some(isPending));
const polling = ref(false);
const pollFailed = ref(false);
let latestRequest = 0;
let active = true;
let timer: ReturnType<typeof setTimeout> | undefined;

function isPending(group: AiStyleImageGroup) {
  return group.status === 0 || group.status === 1;
}
function generatedCount(group: AiStyleImageGroup) {
  return group.list?.filter((result) => result.isAiCreate !== 0).length ?? 0;
}
function placeholderCount(group: AiStyleImageGroup) {
  return isPending(group) || group.status === 3 || group.status === 4
    ? Math.max(
        0,
        (batchCounts.value.get(group.imgId) ?? (isPending(group) ? 0 : 1)) -
          generatedCount(group),
      )
    : 0;
}
async function loadBatchCounts(data: AiStyleImageGroup[], request: number) {
  await Promise.all(
    data
      .filter(
        (group) =>
          (isPending(group) || group.status === 3 || group.status === 4) &&
          !batchCounts.value.has(group.imgId),
      )
      .map(async (group) => {
        try {
          const detail = await getAiImageApi(group.imgId);
          if (
            request === latestRequest &&
            detail &&
            Number.isSafeInteger(detail.num) &&
            detail.num > 0
          )
            batchCounts.value.set(group.imgId, detail.num);
        } catch {
          // Retain the batch status if its generation parameters are unavailable.
        }
      }),
  );
}
function statusTitle(group: AiStyleImageGroup) {
  const titles: Record<number, string> = {
    0: '等待生成',
    1: '图片生成中',
    2: '生成已完成',
    3: '图片生成失败',
    4: '生成任务已取消',
    5: '参数已暂存',
  };
  return titles[group.status ?? -1] ?? '暂无图片';
}
function statusDescription(group: AiStyleImageGroup) {
  if (group.status === 1) {
    const source = group.sourcePage ?? submittedSourcePage.value;
    const label = source === 5 ? '模特图' : source === 6 ? '动作图' : '图片';
    return `AI 正在生成${label}，完成后将在这里展示。`;
  }
  const descriptions: Record<number, string> = {
    0: '任务已加入队列，开始生成后会自动更新。',
    2: '该批次暂未返回图片，可刷新查看结果。',
    3: '请前往任务中心查看失败原因，或重新发起生成。',
    4: '你可以重新发起图片生成。',
    5: '该批次尚未开始生成，生成后将在这里展示结果。',
  };
  return descriptions[group.status ?? -1] ?? '该批次尚未返回图片。';
}
function statusIcon(group: AiStyleImageGroup) {
  if (isPending(group)) return LoaderCircle;
  if (group.status === 3) return CircleAlert;
  if (group.status === 4) return CircleX;
  if (group.status === 2) return CircleCheckBig;
  return Inbox;
}
function stopPolling() {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
}
function schedulePolling() {
  stopPolling();
  if (!active || !hasPendingBatches.value || pollFailed.value || failed.value)
    return;
  timer = setTimeout(async () => {
    if (!active) return;
    if (
      document.hidden ||
      loading.value ||
      mutating.value ||
      props.disabled ||
      uploadOpen.value ||
      resultsOpen.value ||
      polling.value
    ) {
      schedulePolling();
      return;
    }
    const request = latestRequest;
    polling.value = true;
    try {
      const data = await getAiImageResultsByStyleIdApi(submittedKey.value, {
        sourcePage: submittedSourcePage.value,
        imgId: batchId.value === 'all' ? undefined : batchId.value,
      });
      if (active && request === latestRequest) {
        groups.value = data;
        await loadBatchCounts(data, request);
      }
    } catch {
      if (active && request === latestRequest) pollFailed.value = true;
    } finally {
      polling.value = false;
      if (request === latestRequest) schedulePolling();
    }
  }, 5000);
}

async function loadResults(
  key: string,
  sourcePage: AiImageSourcePage,
  id: BatchSelection,
  request: number,
) {
  stopPolling();
  resultsLoading.value = true;
  try {
    const data = await getAiImageResultsByStyleIdApi(key, {
      sourcePage,
      imgId: id === 'all' ? undefined : id,
    });
    if (request === latestRequest) {
      groups.value = data;
      await loadBatchCounts(data, request);
    }
  } catch {
    if (request === latestRequest) failed.value = true;
    // The request interceptor displays errors.
  } finally {
    if (request === latestRequest) {
      resultsLoading.value = false;
      schedulePolling();
    }
  }
}
async function load(
  key: string,
  sourcePage: AiImageSourcePage,
  preferredBatchId: BatchSelection = 'all',
) {
  if (!key) return;
  stopPolling();
  pollFailed.value = false;
  const request = ++latestRequest;
  submittedKey.value = key;
  submittedSourcePage.value = sourcePage;
  batchesLoading.value = true;
  resultsLoading.value = false;
  failed.value = false;
  groups.value = [];
  batches.value = [];
  batchId.value = 'all';
  resultsOpen.value = false;
  uploadOpen.value = false;
  try {
    const data = await getAiImageResultBatchesApi(key, sourcePage);
    if (request !== latestRequest) return;
    batches.value = data;
    batchesLoading.value = false;
    batchId.value = data.some((batch) => batch.imgId === preferredBatchId)
      ? preferredBatchId
      : 'all';
    await loadResults(key, sourcePage, batchId.value, request);
  } catch {
    if (request === latestRequest) failed.value = true;
    // The request interceptor displays errors.
  } finally {
    if (request === latestRequest) batchesLoading.value = false;
  }
}
function changeBatch() {
  if (mutating.value) return;
  if (!submittedKey.value) return;
  pollFailed.value = false;
  const request = ++latestRequest;
  groups.value = [];
  failed.value = false;
  resultsOpen.value = false;
  void loadResults(
    submittedKey.value,
    submittedSourcePage.value,
    batchId.value,
    request,
  );
}
function search() {
  if (mutating.value) return;
  query.styleId = query.styleId.trim();
  return load(
    query.styleId,
    props.sourcePage ?? query.sourcePage,
    props.initialBatchId,
  );
}
function changeSource() {
  if (mutating.value || !submittedKey.value) return;
  return load(submittedKey.value, query.sourcePage);
}
function refresh() {
  if (mutating.value) return;
  return load(submittedKey.value, submittedSourcePage.value, batchId.value);
}
defineExpose({ refresh });
function reset() {
  if (mutating.value) return;
  latestRequest += 1;
  stopPolling();
  pollFailed.value = false;
  query.styleId = '';
  query.sourcePage = props.sourcePage ?? 0;
  submittedKey.value = '';
  batches.value = [];
  batchId.value = 'all';
  groups.value = [];
  batchCounts.value.clear();
  batchesLoading.value = false;
  resultsLoading.value = false;
  failed.value = false;
  resultsOpen.value = false;
  uploadOpen.value = false;
  formRef.value?.clearValidate();
}
function showResults(id: number) {
  imgId.value = id;
  resultsOpen.value = true;
}
async function remove(id: number) {
  if (props.readOnly || props.disabled || mutating.value || loading.value)
    return;
  const key = submittedKey.value;
  const selectedBatch = batchId.value;
  const sourcePage = submittedSourcePage.value;
  deletingId.value = id;
  try {
    // The shared interceptor rejects nonzero codes; data is not a success flag.
    await deleteAiImageResultApi(id);
    message.success('图片已删除');
    await load(key, sourcePage, selectedBatch);
  } catch {
    // The request interceptor displays errors; retain results for retry.
  } finally {
    deletingId.value = undefined;
  }
}
function uploaded(id: number) {
  uploadOpen.value = false;
  void load(
    submittedKey.value,
    submittedSourcePage.value,
    batchId.value === 'all' ? 'all' : id,
  );
}
watch(mutating, (value) => emit('busy', value), { flush: 'sync' });
watch(batchId, (value) => emit('batchChange', value));
function guardMutation() {
  if (!mutating.value) return true;
  message.warning('正在处理结果图片，请完成后再离开页面');
  return false;
}
onBeforeRouteLeave(guardMutation);
onBeforeRouteUpdate(guardMutation);
watch(
  () => [props.styleId, props.sourcePage] as const,
  ([key]) => {
    reset();
    if (key?.trim()) {
      query.styleId = key.trim();
      void search();
    }
  },
  { immediate: true },
);
onUnmounted(() => {
  active = false;
  stopPolling();
  latestRequest += 1;
  emit('busy', false);
});
onActivated(() => {
  active = true;
  schedulePolling();
});
onDeactivated(() => {
  active = false;
  stopPolling();
});
</script>
<template>
  <Card v-if="!embedded" class="mb-4!" :bordered="false">
    <Form ref="formRef" :model="query" layout="inline" @finish="search">
      <FormItem
        label="款式 ID"
        name="styleId"
        :rules="[
          { required: true, whitespace: true, message: '请输入款式 ID' },
        ]"
      >
        <Input
          v-model:value="query.styleId"
          allow-clear
          :disabled="mutating"
          placeholder="请输入款式 ID"
          class="w-72! max-w-full"
        />
      </FormItem>
      <FormItem>
        <Space>
          <Button
            type="primary"
            html-type="submit"
            :loading="loading"
            :disabled="mutating"
          >
            <span>查询</span>
          </Button>
          <Button :disabled="mutating" @click="reset"><span>重置</span></Button>
        </Space>
      </FormItem>
    </Form>
  </Card>
  <Card title="生成结果与历史" :bordered="false">
    <template #extra>
      <Space>
        <Button
          v-if="!readOnly"
          :disabled="
            !submittedKey ||
            loading ||
            mutating ||
            !uploadBatches.length ||
            disabled
          "
          @click="uploadOpen = true"
        >
          <span>上传本地图片</span>
        </Button>
        <Button
          :loading="loading"
          :disabled="!submittedKey || mutating || disabled"
          @click="refresh"
        >
          <span>刷新</span>
        </Button>
      </Space>
    </template>
    <div
      v-if="sourcePage === undefined"
      class="mb-4 flex flex-wrap items-center gap-2"
    >
      <span>来源页面</span>
      <Select
        v-model:value="query.sourcePage"
        aria-label="结果来源页面"
        :options="sourcePageOptions"
        :disabled="mutating || disabled"
        class="w-40!"
        @change="changeSource"
      />
    </div>
    <p v-if="submittedKey && !embedded" class="mb-4 break-all text-sm">
      款式 ID：{{ submittedKey }}
      <template v-if="!loading && !failed">
        · {{ groups.length }} 条生图记录 · {{ imageCount }} 张图片
      </template>
    </p>
    <div v-if="submittedKey" class="mb-4 flex flex-wrap items-center gap-2">
      <span>历史批次</span>
      <Select
        v-model:value="batchId"
        aria-label="历史批次"
        :options="batchOptions"
        :loading="batchesLoading"
        :disabled="loading || mutating || disabled"
        class="w-72! max-w-full"
        show-search
        option-filter-prop="label"
        @change="changeBatch"
      />
      <span
        v-if="hasPendingBatches && !loading"
        class="text-xs text-muted-foreground"
        role="status"
      >
        {{
          pollFailed
            ? '自动更新已暂停，请点击刷新重试'
            : '生成完成后自动更新结果'
        }}
      </span>
    </div>
    <p
      v-if="!embedded && !readOnly && submittedKey && !loading && !uploadBatches.length"
      class="mb-4 text-sm text-muted-foreground"
    >
      暂无可用批次，请先生成图片批次后再上传本地图片。
    </p>
    <Spin :spinning="loading">
      <Empty
        v-if="!loading && groups.length === 0 && (failed || !embedded)"
        :description="
          failed
            ? '查询失败，请刷新重试'
            : submittedKey
              ? batches.length === 0
                ? '该款式暂无生成批次'
                : batchId === 'all'
                  ? '全部批次暂无图片'
                  : '该批次暂无图片'
              : '输入款式 ID 查询图片'
        "
      />
      <Card
        v-for="group in groups"
        :key="group.imgId"
        class="result-batch mb-4!"
        size="small"
      >
        <template #title>
          <div class="flex flex-wrap items-center gap-2">
            <span>{{ group.name || `生图记录 #${group.imgId}` }}</span>
            <Tag
              v-if="group.status != null"
              :color="taskStatusColors[group.status]"
              class="m-0!"
            >
              {{
                taskStatusOptions.find((item) => item.value === group.status)
                  ?.label ?? '状态未知'
              }}
            </Tag>
          </div>
        </template>
        <template #extra>
          <Button
            type="link"
            :disabled="mutating || disabled"
            @click="showResults(group.imgId)"
          >
            <span>结果 / 历史</span>
          </Button>
        </template>
        <div class="batch-meta">
          <span v-if="group.createTime">创建时间：{{ group.createTime }}</span>
          <span v-if="group.sourcePage !== undefined">来源页面：{{
              sourcePageOptions.find((item) => item.value === group.sourcePage)
                ?.label ?? group.sourcePage
            }}</span>
          <span>{{ group.list?.length ?? 0 }} 张图片</span>
        </div>
        <div
          v-if="!group.list?.length && !placeholderCount(group)"
          class="batch-status-panel"
          :data-state="group.status"
          :class="{ 'is-pending': isPending(group) }"
          role="status"
          aria-live="polite"
        >
          <div class="batch-status-icon">
            <component
              :is="statusIcon(group)"
              :class="{ 'batch-status-spin': isPending(group) }"
              aria-hidden="true"
            />
          </div>
          <div>
            <p class="batch-status-title">{{ statusTitle(group) }}</p>
            <p class="batch-status-description">
              {{ statusDescription(group) }}
            </p>
          </div>
        </div>
        <div
          v-if="group.list?.length || placeholderCount(group)"
          class="flex flex-wrap items-start gap-4"
        >
          <div
            v-for="(result, index) in group.list"
            :key="result.id ?? index"
            class="result-image flex w-[120px] flex-col gap-2"
          >
            <div class="relative size-[120px]">
              <ImageUploadItem
                :src="
                  result.thumbnailUrl || result.previewUrl || result.originalUrl
                "
                :preview-src="
                  result.previewUrl ||
                  result.originalUrl ||
                  result.thumbnailUrl ||
                  undefined
                "
                :original-url="result.originalUrl"
                :disabled="disabled"
                :loading="mutating || loading"
                :removable="!readOnly && result.isAiCreate === 0 && result.id != null"
                :remove-label="`删除本地图片 ${result.id}`"
                remove-confirm="确定删除这张本地上传图片？"
                @remove="remove(result.id)"
              />
              <div class="pointer-events-none absolute left-1 top-1 z-10">
                <Tag v-if="result.isAiCreate === 0" class="m-0!">
                  本地上传
                </Tag>
                <Tag v-else-if="result.isAiCreate === 1" color="blue" class="m-0!">
                  AI 生成
                </Tag>
                <Tag v-else class="m-0!">来源未知</Tag>
              </div>
            </div>
            <div v-if="selectable && !readOnly" class="mt-2">
              <Checkbox
                :checked="selectedUrls?.includes(result.originalUrl)"
                :disabled="
                  loading || mutating || disabled || !result.originalUrl
                "
                :aria-label="`选择结果 ${result.id}`"
                @change="
                  emit('select', {
                    originalUrl: result.originalUrl,
                    previewUrl: result.previewUrl || result.originalUrl,
                    thumbnailUrl:
                      result.thumbnailUrl ||
                      result.previewUrl ||
                      result.originalUrl,
                  })
                "
              >
                <span>用于本次提交</span>
              </Checkbox>
            </div>
          </div>
          <div
            v-for="slot in placeholderCount(group)"
            :key="`placeholder-${slot}`"
            class="flex w-[120px] flex-col gap-2"
          >
            <div
              class="batch-image-placeholder relative"
              :data-state="group.status"
              :data-pending-image="isPending(group) ? '' : undefined"
              :data-failed-image="group.status === 3 ? '' : undefined"
              :data-cancelled-image="group.status === 4 ? '' : undefined"
              role="status"
              :aria-label="`第 ${generatedCount(group) + slot} 张图片${statusTitle(group)}`"
              :title="!isPending(group) ? statusDescription(group) : undefined"
            >
              <Tag color="blue" class="pointer-events-none absolute left-1 top-1 m-0!">
                AI 生成
              </Tag>
              <component
                :is="statusIcon(group)"
                class="size-6"
                :class="{ 'batch-status-spin': isPending(group) }"
                aria-hidden="true"
              />
              <span>{{ statusTitle(group) }}</span>
              <span class="text-xs text-muted-foreground">
                第 {{ generatedCount(group) + slot }} 张
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Spin>
  </Card>
  <ResultModal
    v-model:open="resultsOpen"
    :img-id="imgId"
    :read-only="readOnly"
    @changed="refresh"
  />
  <ResultUpload
    v-if="uploadOpen && !readOnly"
    :style-id="submittedKey"
    :style-no="
      props.styleId?.trim() === submittedKey ? props.styleNo : undefined
    "
    :source-page="submittedSourcePage"
    :batches="uploadBatches"
    :initial-img-id="batchId === 'all' ? undefined : batchId"
    @busy="uploading = $event"
    @close="uploadOpen = false"
    @saved="uploaded"
  />
</template>

<style scoped>
.batch-image-placeholder {
  display: flex;
  flex: 0 0 120px;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  padding: 24px 8px 8px;
  font-size: 12px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 5%);
  border: 1px dashed hsl(var(--primary) / 35%);
  border-radius: 6px;
}

.batch-image-placeholder[data-state='3'] {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 5%);
  border-color: hsl(var(--destructive) / 35%);
}

.batch-image-placeholder[data-state='4'] {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 35%);
  border-color: hsl(var(--muted-foreground) / 35%);
}

.batch-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
  margin-bottom: 12px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.batch-status-panel {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: center;
  min-height: 132px;
  padding: 24px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 35%);
  border: 1px dashed hsl(var(--border));
  border-radius: 10px;
}

.batch-status-panel.is-pending {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 5%);
  border-color: hsl(var(--primary) / 25%);
}

.batch-status-panel[data-state='3'] {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 4%);
  border-color: hsl(var(--destructive) / 25%);
}

.batch-status-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: hsl(var(--background) / 80%);
  border-radius: 50%;
}

.batch-status-icon :deep(svg) {
  width: 24px;
  height: 24px;
}

.batch-status-title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.batch-status-description {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: hsl(var(--muted-foreground));
}

.batch-status-spin {
  animation: batch-status-spin 1.4s linear infinite;
}

@keyframes batch-status-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .batch-status-spin {
    animation: none;
  }
}

@media (max-width: 640px) {
  .batch-status-panel {
    justify-content: flex-start;
    padding: 20px 16px;
  }
}
</style>
