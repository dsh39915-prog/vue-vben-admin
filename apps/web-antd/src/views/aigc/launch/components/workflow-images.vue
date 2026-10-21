<script setup lang="ts">
import type { UploadProps } from 'ant-design-vue';

import type { LibraryType, WorkflowImage } from '#/api';

import { nextTick, onUnmounted, ref } from 'vue';

import { ExternalLink, RotateCw, X } from '@vben/icons';

import {
  Button,
  Checkbox,
  Image,
  Input,
  message,
  Tooltip,
  Upload,
} from 'ant-design-vue';

import { uploadWorkflowImageApi } from '#/api';

import { imageUrl } from '../workflow-helpers';
import LibraryPicker from './library-picker.vue';
const props = withDefaults(
  defineProps<{
    modelValue: WorkflowImage[];
    disabled?: boolean;
    multiple?: boolean;
    kind?: 'base' | 'style' | 'temp';
    styleNo?: string;
    maxCount?: number;
    libraryType?: LibraryType;
    protectedUrls?: string[];
    compact?: boolean;
  }>(),
  {
    kind: 'temp',
    styleNo: '',
    maxCount: undefined,
    libraryType: undefined,
    protectedUrls: undefined,
  },
);
const emit = defineEmits<{
  'update:modelValue': [WorkflowImage[]];
  busy: [number];
}>();
const uploading = ref(0);
const pickerOpen = ref(false);
function openPicker() {
  pickerOpen.value = true;
  emit('busy', 1);
}
function closePicker() {
  pickerOpen.value = false;
  emit('busy', -1);
}
function selectLibrary(image: WorkflowImage) {
  if (!props.disabled) {
    if (
      props.multiple &&
      props.maxCount !== undefined &&
      props.modelValue.length >= props.maxCount
    ) {
      message.warning('最多选择 ' + props.maxCount + ' 张图片');
      return;
    }
    emit(
      'update:modelValue',
      props.multiple ? [...props.modelValue, image] : [image],
    );
  }
  closePicker();
}
function protectedImage(image: WorkflowImage) {
  return props.protectedUrls?.includes(image.originalUrl) ?? false;
}
let active = true;
let queue = Promise.resolve();
onUnmounted(() => {
  active = false;
});
function update(index: number, patch: Partial<WorkflowImage>) {
  if (props.disabled || protectedImage(props.modelValue[index]!)) return;
  emit(
    'update:modelValue',
    props.modelValue.map((img, i) =>
      i === index ? { ...img, ...patch } : img,
    ),
  );
}
function uploadImage(file: File, replaceIndex?: number) {
  if (props.disabled) return false;
  if (
    replaceIndex !== undefined &&
    (!props.modelValue[replaceIndex] ||
      protectedImage(props.modelValue[replaceIndex]))
  )
    return false;
  if (!file.type.startsWith('image/')) {
    message.warning('请选择图片文件');
    return false;
  }
  if (
    props.multiple &&
    replaceIndex === undefined &&
    props.maxCount !== undefined &&
    props.modelValue.length + uploading.value >= props.maxCount
  ) {
    message.warning('最多上传 ' + props.maxCount + ' 张图片');
    return false;
  }
  emit('busy', 1);
  uploading.value += 1;
  queue = queue.then(async () => {
    try {
      const img = await uploadWorkflowImageApi(file);
      if (
        !img?.originalUrl ||
        !img.previewUrl ||
        !img.thumbnailUrl ||
        !img.imageId
      )
        throw new Error('上传结果缺少图片地址或图片标识');
      if (!active) return;
      const value: WorkflowImage = {
        originalUrl: img.originalUrl,
        previewUrl: img.previewUrl,
        thumbnailUrl: img.thumbnailUrl,
        ...(props.kind === 'temp' ? { imageId: img.imageId } : {}),
        ...(props.kind === 'style'
          ? { styleNo: props.styleNo ?? '', isMain: 0 }
          : {}),
      };
      await nextTick();
      const images =
        replaceIndex === undefined
          ? props.multiple
            ? [...props.modelValue, value]
            : [value]
          : props.modelValue.map((existing, index) =>
              index === replaceIndex
                ? {
                    ...value,
                    ...(props.kind === 'style'
                      ? { styleNo: existing.styleNo, isMain: existing.isMain }
                      : {}),
                  }
                : existing,
            );
      emit('update:modelValue', images);
      await nextTick();
    } catch (error) {
      if (active && error instanceof Error) message.error(error.message);
    } finally {
      uploading.value -= 1;
      if (active) emit('busy', -1);
    }
  });
  return false;
}
const upload: UploadProps['beforeUpload'] = (file) => uploadImage(file);
</script>
<template>
  <div
    :class="
      compact ? 'flex flex-wrap items-start gap-3' : 'flex flex-col gap-3'
    "
  >
    <div
      v-if="modelValue.length"
      :class="compact ? 'contents' : 'flex flex-wrap gap-3'"
    >
      <div
        v-for="(img, index) in modelValue"
        :key="index"
        :class="
          compact
            ? 'flex w-[120px] max-w-full flex-col gap-1'
            : 'flex w-44 max-w-full flex-col gap-2 rounded border border-solid border-[hsl(var(--border))] p-2'
        "
      >
        <div class="relative">
          <Image
            :src="imageUrl(img)"
            :preview="{ src: img.previewUrl || img.originalUrl }"
            :height="compact ? 120 : 100"
            :width="compact ? '100%' : 150"
            class="max-w-full! object-contain"
          />
          <template v-if="compact">
            <Tooltip title="移除图片">
              <Button
                v-if="!disabled && !protectedImage(img)"
                class="absolute! -right-2 -top-2 z-10"
                size="small"
                shape="circle"
                danger
                aria-label="移除图片"
                :disabled="uploading > 0"
                @click="
                  emit(
                    'update:modelValue',
                    modelValue.filter((_, i) => i !== index),
                  )
                "
              >
                <template #icon><X class="size-3.5" /></template>
              </Button>
            </Tooltip>
            <div class="absolute bottom-1 right-1 z-10 flex gap-1">
              <Tooltip title="查看原图">
                <Button
                  size="small"
                  shape="circle"
                  :href="imageUrl(img, true)"
                  :disabled="false"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="查看原图"
                >
                  <template #icon><ExternalLink class="size-3.5" /></template>
                </Button>
              </Tooltip>
              <Tooltip
                v-if="!disabled && !protectedImage(img)"
                title="替换图片"
              >
                <Upload
                  data-image-action="replace"
                  :before-upload="(file) => uploadImage(file, index)"
                  :show-upload-list="false"
                  accept="image/*"
                  :disabled="uploading > 0 || pickerOpen"
                >
                  <Button
                    size="small"
                    shape="circle"
                    :loading="uploading > 0"
                    aria-label="替换图片"
                  >
                    <template #icon><RotateCw class="size-3.5" /></template>
                  </Button>
                </Upload>
              </Tooltip>
            </div>
          </template>
        </div>
        <a
          v-if="!compact"
          :href="imageUrl(img, true)"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>查看原图</span>
        </a>
        <template v-if="kind === 'style'">
          <Input
            :value="img.styleNo"
            :disabled="disabled || protectedImage(img)"
            placeholder="图片款号"
            @update:value="update(index, { styleNo: $event })"
          />
          <Checkbox
            :checked="img.isMain === 1"
            :disabled="disabled || protectedImage(img)"
            @change="update(index, { isMain: $event.target.checked ? 1 : 0 })"
          >
            主服饰
          </Checkbox>
        </template>
        <Button
          v-if="!compact && !disabled && !protectedImage(img)"
          size="small"
          danger
          :disabled="uploading > 0"
          @click="
            emit(
              'update:modelValue',
              modelValue.filter((_, i) => i !== index),
            )
          "
        >
          <span>移除图片</span>
        </Button>
      </div>
    </div>
    <span v-else-if="disabled" class="text-muted-foreground">暂无图片</span>
    <div
      data-workflow-add
      :class="
        compact ? 'flex self-center flex-col items-start gap-2' : 'contents'
      "
    >
      <Upload
        v-if="
          !disabled &&
          (!compact || multiple || !modelValue.length) &&
          (maxCount === undefined || !multiple || modelValue.length < maxCount)
        "
        :before-upload="upload"
        :show-upload-list="false"
        :multiple="multiple"
        accept="image/*"
        :disabled="disabled || uploading > 0 || pickerOpen"
      >
        <Button :loading="uploading > 0">
          <span>{{
            !multiple && modelValue.length ? '替换图片' : '上传图片'
          }}</span>
        </Button>
      </Upload>
      <Button
        v-if="!disabled && libraryType !== undefined"
        class="self-start"
        :disabled="uploading > 0 || pickerOpen"
        @click="openPicker"
      >
        从图库选择
      </Button>
    </div>
    <LibraryPicker
      v-if="pickerOpen && libraryType !== undefined"
      :library-type="libraryType"
      @select="selectLibrary"
      @close="closePicker"
    />
  </div>
</template>
