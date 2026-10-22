<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';

import type {
  AiImageResultBatch,
  AiStyleImageGroup,
  WorkflowImage,
} from '#/api';

import { computed, onUnmounted, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';

import {
  Button,
  Card,
  Checkbox,
  Empty,
  Form,
  FormItem,
  Image,
  Input,
  message,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
} from 'ant-design-vue';

import {
  deleteAiImageResultApi,
  getAiImageResultBatchesApi,
  getAiImageResultsByStyleIdApi,
} from '#/api';

import ResultModal from './result-modal.vue';
import ResultUpload from './result-upload.vue';

const props = defineProps<{
  styleId?: string;
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
const query = reactive({ styleId: '' });
const formRef = ref<FormInstance>();
const groups = ref<AiStyleImageGroup[]>([]);
const batches = ref<AiImageResultBatch[]>([]);
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
const failed = ref(false);
const resultsOpen = ref(false);
const imgId = ref<number>();
const imageCount = computed(() =>
  groups.value.reduce((total, group) => total + (group.list?.length ?? 0), 0),
);
let latestRequest = 0;

async function loadResults(key: string, id: BatchSelection, request: number) {
  resultsLoading.value = true;
  try {
    const data = await getAiImageResultsByStyleIdApi(
      key,
      id === 'all' ? undefined : id,
    );
    if (request === latestRequest) groups.value = data;
  } catch {
    if (request === latestRequest) failed.value = true;
    // The request interceptor displays errors.
  } finally {
    if (request === latestRequest) resultsLoading.value = false;
  }
}
async function load(key: string, preferredBatchId: BatchSelection = 'all') {
  if (!key) return;
  const request = ++latestRequest;
  submittedKey.value = key;
  batchesLoading.value = true;
  resultsLoading.value = false;
  failed.value = false;
  groups.value = [];
  batches.value = [];
  batchId.value = 'all';
  resultsOpen.value = false;
  try {
    const data = await getAiImageResultBatchesApi(key);
    if (request !== latestRequest) return;
    batches.value = data;
    batchesLoading.value = false;
    batchId.value = data.some((batch) => batch.imgId === preferredBatchId)
      ? preferredBatchId
      : 'all';
    await loadResults(key, batchId.value, request);
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
  const request = ++latestRequest;
  groups.value = [];
  failed.value = false;
  resultsOpen.value = false;
  void loadResults(submittedKey.value, batchId.value, request);
}
function search() {
  if (mutating.value) return;
  query.styleId = query.styleId.trim();
  return load(query.styleId, props.initialBatchId);
}
function refresh() {
  if (mutating.value) return;
  return load(submittedKey.value, batchId.value);
}
defineExpose({ refresh });
function reset() {
  if (mutating.value) return;
  latestRequest += 1;
  query.styleId = '';
  submittedKey.value = '';
  batches.value = [];
  batchId.value = 'all';
  groups.value = [];
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
  deletingId.value = id;
  try {
    // The shared interceptor rejects nonzero codes; data is not a success flag.
    await deleteAiImageResultApi(id);
    message.success('图片已删除');
    await load(key, selectedBatch);
  } catch {
    // The request interceptor displays errors; retain results for retry.
  } finally {
    deletingId.value = undefined;
  }
}
function uploaded(id: number) {
  uploadOpen.value = false;
  void load(submittedKey.value, batchId.value === 'all' ? 'all' : id);
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
  () => props.styleId,
  (key) => {
    reset();
    if (key?.trim()) {
      query.styleId = key.trim();
      void search();
    }
  },
  { immediate: true },
);
onUnmounted(() => {
  latestRequest += 1;
  emit('busy', false);
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
    </div>
    <p
      v-if="!readOnly && submittedKey && !loading && !uploadBatches.length"
      class="mb-4 text-sm text-muted-foreground"
    >
      暂无可用批次，请先生成图片批次后再上传本地图片。
    </p>
    <Spin :spinning="loading">
      <Empty
        v-if="!loading && groups.length === 0"
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
        v-for="(group, groupIndex) in groups"
        :key="groupIndex"
        class="mb-4!"
        :title="group.name || `生图记录 #${group.imgId}`"
        size="small"
      >
        <template #extra>
          <Button
            type="link"
            :disabled="mutating || disabled"
            @click="showResults(group.imgId)"
          >
            <span>结果 / 历史</span>
          </Button>
        </template>
        <p v-if="group.createTime" class="mb-4 text-sm">
          创建时间：{{ group.createTime }}
        </p>
        <Empty v-if="!group.list?.length" description="暂无图片" />
        <div
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <div
            v-for="(result, index) in group.list"
            :key="result.id ?? index"
            class="relative"
          >
            <div class="mb-2 flex items-center justify-between gap-2">
              <Tag v-if="result.isAiCreate === 0"><span>本地上传</span></Tag>
              <Tag v-else-if="result.isAiCreate === 1" color="blue">
                <span>AI 生成</span>
              </Tag>
              <span v-else class="text-muted-foreground text-xs">来源未知</span>
              <Popconfirm
                v-if="!readOnly && result.isAiCreate === 0 && result.id != null"
                title="确定删除这张本地上传图片？"
                :disabled="mutating || loading || disabled"
                @confirm="remove(result.id)"
              >
                <Button
                  size="small"
                  danger
                  :aria-label="`删除本地图片 ${result.id}`"
                  :disabled="mutating || loading || disabled"
                  :loading="deletingId === result.id"
                >
                  <span>删除</span>
                </Button>
              </Popconfirm>
            </div>
            <Image
              :src="
                result.thumbnailUrl || result.previewUrl || result.originalUrl
              "
              :preview="{
                src:
                  result.previewUrl ||
                  result.originalUrl ||
                  result.thumbnailUrl ||
                  undefined,
              }"
              width="100%"
              :height="selectable ? 180 : undefined"
              :class="{ 'object-contain': selectable }"
            />
            <a
              v-if="result.originalUrl"
              :href="result.originalUrl"
              class="mt-2 inline-block"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>查看原图</span>
            </a>
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
                <span>用于本款模特图</span>
              </Checkbox>
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
    :batches="uploadBatches"
    :initial-img-id="batchId === 'all' ? undefined : batchId"
    @busy="uploading = $event"
    @close="uploadOpen = false"
    @saved="uploaded"
  />
</template>
