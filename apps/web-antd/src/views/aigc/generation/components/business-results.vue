<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue';

import type { AiBusinessKeyImageGroup, AiImageResultBatch } from '#/api';

import { computed, onUnmounted, reactive, ref, watch } from 'vue';

import {
  Button,
  Card,
  Empty,
  Form,
  FormItem,
  Image,
  Input,
  Select,
  Space,
  Spin,
} from 'ant-design-vue';

import {
  getAiImageResultBatchesApi,
  getAiImageResultsByBusinessKeyApi,
} from '#/api';

import ResultModal from './result-modal.vue';

const props = defineProps<{
  businessKey?: string;
  embedded?: boolean;
  readOnly?: boolean;
}>();
const query = reactive({ businessKey: '' });
const formRef = ref<FormInstance>();
const groups = ref<AiBusinessKeyImageGroup[]>([]);
const batches = ref<AiImageResultBatch[]>([]);
const batchId = ref<number>();
const batchesLoading = ref(false);
const resultsLoading = ref(false);
const loading = computed(() => batchesLoading.value || resultsLoading.value);
const batchOptions = computed(() =>
  batches.value.map((batch) => ({
    label: batch.name || `生图记录 #${batch.imgId}`,
    value: batch.imgId,
  })),
);
const submittedKey = ref('');
const failed = ref(false);
const resultsOpen = ref(false);
const imgId = ref<number>();
const imageCount = computed(() =>
  groups.value.reduce((total, group) => total + (group.list?.length ?? 0), 0),
);
let latestRequest = 0;

async function loadResults(key: string, id: number, request: number) {
  resultsLoading.value = true;
  try {
    const data = await getAiImageResultsByBusinessKeyApi(key, id);
    if (request === latestRequest) groups.value = data;
  } catch {
    if (request === latestRequest) failed.value = true;
    // The request interceptor displays errors.
  } finally {
    if (request === latestRequest) resultsLoading.value = false;
  }
}
async function load(key: string, preferredBatchId?: number) {
  if (!key) return;
  const request = ++latestRequest;
  submittedKey.value = key;
  batchesLoading.value = true;
  resultsLoading.value = false;
  failed.value = false;
  groups.value = [];
  batches.value = [];
  batchId.value = undefined;
  resultsOpen.value = false;
  try {
    const data = await getAiImageResultBatchesApi(key);
    if (request !== latestRequest) return;
    batches.value = data;
    batchesLoading.value = false;
    batchId.value = data.some((batch) => batch.imgId === preferredBatchId)
      ? preferredBatchId
      : data[0]?.imgId;
    if (batchId.value !== undefined) {
      await loadResults(key, batchId.value, request);
    }
  } catch {
    if (request === latestRequest) failed.value = true;
    // The request interceptor displays errors.
  } finally {
    if (request === latestRequest) batchesLoading.value = false;
  }
}
function changeBatch() {
  if (batchId.value === undefined || !submittedKey.value) return;
  const request = ++latestRequest;
  groups.value = [];
  failed.value = false;
  resultsOpen.value = false;
  void loadResults(submittedKey.value, batchId.value, request);
}
function search() {
  query.businessKey = query.businessKey.trim();
  return load(query.businessKey);
}
function refresh() {
  return load(submittedKey.value, batchId.value);
}
function reset() {
  latestRequest += 1;
  query.businessKey = '';
  submittedKey.value = '';
  batches.value = [];
  batchId.value = undefined;
  groups.value = [];
  batchesLoading.value = false;
  resultsLoading.value = false;
  failed.value = false;
  resultsOpen.value = false;
  formRef.value?.clearValidate();
}
function showResults(id: number) {
  imgId.value = id;
  resultsOpen.value = true;
}
watch(
  () => props.businessKey,
  (key) => {
    reset();
    if (key?.trim()) {
      query.businessKey = key.trim();
      void search();
    }
  },
  { immediate: true },
);
onUnmounted(() => {
  latestRequest += 1;
});
</script>
<template>
  <Card v-if="!embedded" class="mb-4!" :bordered="false">
    <Form ref="formRef" :model="query" layout="inline" @finish="search">
      <FormItem
        label="流程任务标识"
        name="businessKey"
        :rules="[
          { required: true, whitespace: true, message: '请输入流程任务标识' },
        ]"
      >
        <Input
          v-model:value="query.businessKey"
          allow-clear
          placeholder="请输入流程任务 Key"
          class="w-72! max-w-full"
        />
      </FormItem>
      <FormItem>
        <Space>
          <Button type="primary" html-type="submit" :loading="loading">
            <span>查询</span>
          </Button>
          <Button @click="reset"><span>重置</span></Button>
        </Space>
      </FormItem>
    </Form>
  </Card>
  <Card title="流程任务图片" :bordered="false">
    <template #extra>
      <Button :loading="loading" :disabled="!submittedKey" @click="refresh">
        <span>刷新</span>
      </Button>
    </template>
    <p v-if="submittedKey && !embedded" class="mb-4 break-all text-sm">
      流程任务：{{ submittedKey }}
      <template v-if="!loading && !failed">
        · {{ groups.length }} 条生图记录 · {{ imageCount }} 张图片
      </template>
    </p>
    <div v-if="submittedKey" class="mb-4 flex flex-wrap items-center gap-2">
      <span>生成批次</span>
      <Select
        v-model:value="batchId"
        aria-label="生成批次"
        :options="batchOptions"
        :loading="batchesLoading"
        :disabled="batchesLoading || batches.length === 0"
        placeholder="暂无生成批次"
        class="w-72! max-w-full"
        show-search
        option-filter-prop="label"
        @change="changeBatch"
      />
    </div>
    <Spin :spinning="loading">
      <Empty
        v-if="!loading && groups.length === 0"
        :description="
          failed
            ? '查询失败，请刷新重试'
            : submittedKey
              ? batches.length === 0
                ? '该流程任务暂无生成批次'
                : '该批次暂无图片'
              : '输入流程任务 Key 查询图片'
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
          <Button type="link" @click="showResults(group.imgId)">
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
          <div v-for="(result, index) in group.list" :key="index">
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
</template>
