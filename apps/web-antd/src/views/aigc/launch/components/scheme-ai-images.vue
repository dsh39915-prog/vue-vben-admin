<script setup lang="ts">
import type { WorkflowImage } from '#/api';

import { computed, onUnmounted, ref, watch } from 'vue';

import { Alert, Button, Checkbox, Spin } from 'ant-design-vue';

import { queryMatchStylesApi } from '#/api';

import ImageUploadItem from '../../common/image-upload-item.vue';
import { imageUrl } from '../workflow-helpers';

const props = defineProps<{
  modelValue: WorkflowImage[];
  styleNo: string;
  editable: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [WorkflowImage[]];
  busy: [number];
}>();
const candidates = ref<WorkflowImage[]>([]);
const loading = ref(false);
const failed = ref('');
let latest = 0;

function unique(images: WorkflowImage[]) {
  const seen = new Set<string>();
  return images.filter((image) => {
    if (!image.originalUrl || seen.has(image.originalUrl)) return false;
    seen.add(image.originalUrl);
    return true;
  });
}
const images = computed(() =>
  unique([
    ...(props.editable ? candidates.value : []),
    ...props.modelValue,
  ]),
);
function selected(image: WorkflowImage) {
  return props.modelValue.some(
    (item) => item.originalUrl === image.originalUrl,
  );
}
function select(image: WorkflowImage, checked: boolean) {
  if (!props.editable || props.disabled || loading.value) return;
  // Keep restored selections available after unchecking them.
  candidates.value = unique([...candidates.value, image]);
  emit(
    'update:modelValue',
    checked
      ? unique([...props.modelValue, { ...image }])
      : props.modelValue.filter(
          (item) => item.originalUrl !== image.originalUrl,
        ),
  );
}
function finishLoading() {
  if (!loading.value) return;
  loading.value = false;
  emit('busy', -1);
}
async function load() {
  const request = ++latest;
  const styleNo = props.styleNo.trim();
  candidates.value = [];
  failed.value = '';
  if (!props.editable || !styleNo) {
    finishLoading();
    return;
  }
  if (!loading.value) {
    loading.value = true;
    emit('busy', 1);
  }
  try {
    const styles = await queryMatchStylesApi(styleNo);
    if (request !== latest) return;
    candidates.value = unique(
      styles
        .filter((style) => style.styleNo.trim() === styleNo)
        .flatMap((style) =>
          [
            ...(style.aiModelImageUrls ?? []),
            ...(style.aiActionImageUrls ?? []),
          ].map((image) => ({
            originalUrl: image.originalUrl,
            previewUrl: image.previewUrl,
            thumbnailUrl: image.thumbnailUrl,
            styleNo: style.styleNo,
            isMain: 0,
          })),
        ),
    );
  } catch (error) {
    if (request === latest)
      failed.value =
        error instanceof Error ? error.message : 'AI生成内容加载失败，请重试';
  } finally {
    if (request === latest) finishLoading();
  }
}
watch(() => [props.styleNo, props.editable], load, { immediate: true });
onUnmounted(() => {
  latest += 1;
  finishLoading();
});
</script>

<template>
  <div data-scheme-ai-images>
    <Alert v-if="failed" :message="failed" type="error" class="mb-3!">
      <template #action>
        <Button size="small" :disabled="disabled" @click="load">重试</Button>
      </template>
    </Alert>
    <Spin :spinning="loading" tip="正在读取AI生成内容">
      <div v-if="images.length" class="flex flex-wrap items-start gap-3">
        <div
          v-for="(image, index) in images"
          :key="image.originalUrl"
          class="flex w-[120px] flex-col gap-2"
        >
          <ImageUploadItem
            :src="imageUrl(image)"
            :preview-src="image.previewUrl || image.originalUrl"
            :original-url="imageUrl(image, true)"
            :alt="`AI生成图片 ${index + 1}`"
          />
          <Checkbox
            v-if="editable"
            :checked="selected(image)"
            :disabled="disabled || loading"
            :aria-label="`选择AI生成图片 ${index + 1}`"
            @change="select(image, $event.target.checked)"
          >
            选用此图
          </Checkbox>
        </div>
      </div>
      <p v-else-if="!loading && !failed" class="mb-0 text-muted-foreground">
        暂无ai生成内容
      </p>
      <div v-else-if="loading" class="h-20"></div>
    </Spin>
  </div>
</template>
