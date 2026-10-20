<script setup lang="ts">
import type { UploadProps } from 'ant-design-vue';

import type { LibraryType, WorkflowImage } from '#/api';

import { nextTick, onUnmounted, ref } from 'vue';

import {
  Button,
  Checkbox,
  Image,
  Input,
  message,
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
  if (!props.disabled) emit('update:modelValue', [image]);
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
const upload: UploadProps['beforeUpload'] = (file) => {
  if (props.disabled) return false;
  if (!file.type.startsWith('image/')) {
    message.warning('请选择图片文件');
    return false;
  }
  if (
    props.multiple &&
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
      emit(
        'update:modelValue',
        props.multiple ? [...props.modelValue, value] : [value],
      );
      await nextTick();
    } catch (error) {
      if (active && error instanceof Error) message.error(error.message);
    } finally {
      uploading.value -= 1;
      if (active) emit('busy', -1);
    }
  });
  return false;
};
</script>
<template>
  <div class="flex flex-col gap-3">
    <div v-if="modelValue.length" class="flex flex-wrap gap-3">
      <div
        v-for="(img, index) in modelValue"
        :key="index"
        class="flex w-44 max-w-full flex-col gap-2 rounded border border-solid border-[hsl(var(--border))] p-2"
      >
        <Image
          :src="imageUrl(img)"
          :preview="{ src: img.previewUrl || img.originalUrl }"
          :height="100"
          :width="150"
          class="max-w-full! object-contain"
        />
        <a
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
          v-if="!disabled && !protectedImage(img)"
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
    <Upload
      v-if="
        !disabled &&
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
    <LibraryPicker
      v-if="pickerOpen && libraryType !== undefined"
      :library-type="libraryType"
      @select="selectLibrary"
      @close="closePicker"
    />
  </div>
</template>
