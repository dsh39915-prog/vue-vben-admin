<script setup lang="ts">
import type { AiImageRecord, AiImageResultRecord } from '#/api';

import { computed, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import {
  Button,
  Card,
  Empty,
  Image,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
} from 'ant-design-vue';

import {
  enhanceAiImageResultApi,
  getAiImageApi,
  getAiImageHistoryApi,
  regenerateAiImageResultApi,
} from '#/api';

import { imagePreviewUrls } from '../helpers';

const props = defineProps<{
  imgId?: number;
  open: boolean;
  readOnly?: boolean;
}>();
const emit = defineEmits<{ changed: []; 'update:open': [value: boolean] }>();
const router = useRouter();
const loading = ref(false);
const busy = ref(false);
const image = ref<AiImageRecord>();
const history = ref<AiImageResultRecord[]>([]);
const originalPreview = computed(
  () =>
    imagePreviewUrls(
      image.value?.originalImg,
      image.value?.previewOriginalImg,
    )[0],
);
const referencePreviews = computed(() =>
  imagePreviewUrls(image.value?.referenceImg, image.value?.previewReferenceImg),
);
const mode = ref<'current' | 'history'>('current');
const slotNo = ref<number>();
let latestRequest = 0;
const results = computed(() =>
  mode.value === 'history' ? history.value : (image.value?.results ?? []),
);
const slotOptions = computed(() =>
  [
    ...new Set(
      [...(image.value?.results ?? []), ...history.value].map(
        (item) => item.slotNo,
      ),
    ),
  ]
    .sort((a, b) => a - b)
    .map((value) => ({ label: `第 ${value} 张`, value })),
);

async function refresh() {
  if (!props.open || props.imgId === undefined) return;
  const request = ++latestRequest;
  loading.value = true;
  try {
    const [data, versions] = await Promise.all([
      getAiImageApi(props.imgId),
      mode.value === 'history'
        ? getAiImageHistoryApi(props.imgId, slotNo.value)
        : Promise.resolve([]),
    ]);
    if (request !== latestRequest) return;
    if (data === null) {
      message.warning('该生图记录不存在');
      emit('update:open', false);
      return;
    }
    image.value = data;
    history.value = versions;
  } catch {
    if (request === latestRequest) {
      image.value = undefined;
      history.value = [];
    }
  } finally {
    if (request === latestRequest) loading.value = false;
  }
}
function showHistory(slot?: number) {
  mode.value = 'history';
  slotNo.value = slot;
  void refresh();
}
async function processResult(id: number, enhance: boolean) {
  if (busy.value || props.readOnly) return;
  busy.value = true;
  try {
    await (enhance
      ? enhanceAiImageResultApi(id)
      : regenerateAiImageResultApi(id));
    message.success('任务已提交，可在任务中心查看进度');
    await refresh();
    emit('changed');
  } catch {
    /* The request interceptor displays errors. */
  } finally {
    busy.value = false;
  }
}
function showTasks() {
  emit('update:open', false);
  void router.push('/task-center');
}
watch(
  () => [props.open, props.imgId],
  () => {
    latestRequest += 1;
    image.value = undefined;
    history.value = [];
    mode.value = 'current';
    slotNo.value = undefined;
    if (props.open) void refresh();
  },
  { immediate: true },
);
onUnmounted(() => {
  latestRequest += 1;
});
</script>
<template>
  <Modal
    :open="open"
    title="图片生成结果"
    :width="1100"
    :footer="null"
    :mask-closable="false"
    :closable="!busy"
    :keyboard="!busy"
    @cancel="emit('update:open', false)"
  >
    <Space class="mb-4!" wrap>
      <div>生图记录 #{{ imgId }} · {{ image?.styleNo || '未填写款号' }}</div>
      <Select
        v-model:value="mode"
        :disabled="busy"
        :options="[
          { label: '当前结果', value: 'current' },
          { label: '历史版本', value: 'history' },
        ]"
        style="width: 130px"
        @change="refresh"
      />
      <Select
        v-if="mode === 'history'"
        v-model:value="slotNo"
        :disabled="busy"
        :options="slotOptions"
        allow-clear
        placeholder="全部槽位"
        style="width: 130px"
        @change="refresh"
      />
      <Button :loading="loading" :disabled="busy" @click="refresh">
        <span>刷新结果</span>
      </Button>
      <Button v-if="!readOnly" :disabled="busy" @click="showTasks">
        <span>查看任务</span>
      </Button>
    </Space>
    <p v-if="image?.prompt" class="mb-4 whitespace-pre-wrap text-sm">
      {{ image.prompt }}
    </p>
    <div v-if="image" class="mb-4 text-sm">
      <p>
        {{ image.size || '-' }} · {{ image.quality || '-' }} ·
        {{ image.aspectRatio || '-' }} · {{ image.num }} 张
      </p>
      <p>
        操作人：{{ image.operator || image.operatorId || '-' }} · 创建人 ID：{{
          image.createUserId ?? '-'
        }}
      </p>
      <Space class="mt-2" wrap>
        <Image v-if="originalPreview" :src="originalPreview" :width="70" />
        <Image
          v-for="(url, index) in referencePreviews"
          :key="index"
          :src="url"
          :width="70"
        />
      </Space>
    </div>
    <Spin :spinning="loading">
      <Empty
        v-if="!loading && results.length === 0"
        description="暂无图片结果，任务完成后可刷新查看"
      />
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card v-for="result in results" :key="result.id" size="small">
          <template #title>
            <Space>
              <span>第 {{ result.slotNo }} 张</span>
              <Tag v-if="result.isCurrent === 1" color="success">
                <span>当前版本</span>
              </Tag>
            </Space>
          </template>
          <Image
            :src="
              result.previewUrl || result.thumbnailUrl || result.originalUrl
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
          <div class="my-2 text-sm">
            <p>结果 #{{ result.id }} · 任务 #{{ result.taskId }}</p>
            <p v-if="result.width && result.height">
              {{ result.width }} × {{ result.height }}
            </p>
            <p v-if="result.parentResultId">
              来源结果 #{{ result.parentResultId }}
            </p>
            <p>{{ result.createTime || '-' }}</p>
          </div>
          <Space wrap :size="4">
            <Popconfirm
              v-if="!readOnly"
              title="确定重新生成这张图片？"
              @confirm="processResult(result.id, false)"
            >
              <Button size="small" :disabled="busy || loading">
                <span>重新生成</span>
              </Button>
            </Popconfirm>
            <Popconfirm
              v-if="!readOnly"
              title="确定对这张图片进行材质增强？"
              @confirm="processResult(result.id, true)"
            >
              <Button size="small" :disabled="busy || loading">
                <span>材质增强</span>
              </Button>
            </Popconfirm>
            <Button
              size="small"
              :disabled="busy"
              @click="showHistory(result.slotNo)"
            >
              <span>槽位历史</span>
            </Button>
            <a
              :href="result.originalUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>查看原图</span>
            </a>
          </Space>
        </Card>
      </div>
    </Spin>
  </Modal>
</template>
