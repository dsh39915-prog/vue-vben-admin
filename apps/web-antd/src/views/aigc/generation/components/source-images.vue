<script setup lang="ts">
import type { UploadProps } from 'ant-design-vue';

import type { WorkflowImage } from '#/api';

import { computed, nextTick, onUnmounted, ref } from 'vue';

import { Button, message, Upload } from 'ant-design-vue';

import { uploadWorkflowImageApi } from '#/api';

import ImageUploadItem from '../../common/image-upload-item.vue';
import ImageUploadTrigger from '../../common/image-upload-trigger.vue';
const props = defineProps<{
  modelValue: WorkflowImage[];
  disabled?: boolean;
  label?: string;
  multiple?: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [WorkflowImage[]];
  busy: [boolean];
}>();
const imageLabel = computed(
  () => props.label || (props.multiple ? '参考图' : '原图'),
);
const pending = ref(0);
let active = true;
let queue = Promise.resolve();

function uploadImage(file: File, replaceIndex?: number) {
  if (props.disabled) return Upload.LIST_IGNORE;
  if (replaceIndex !== undefined && !props.modelValue[replaceIndex])
    return Upload.LIST_IGNORE;
  if (!file.type.startsWith('image/')) {
    message.warning('请选择图片文件');
    return Upload.LIST_IGNORE;
  }
  pending.value += 1;
  emit('busy', true);
  // Upload in selection order, keeping all three addresses attached to their image.
  queue = queue.then(async () => {
    try {
      if (!active) return;
      const result = await uploadWorkflowImageApi(file);
      if (!active) return;
      if (!result?.originalUrl || !result.previewUrl || !result.thumbnailUrl)
        throw new Error('上传未返回完整图片地址，请重新上传');
      const image: WorkflowImage = {
        originalUrl: result.originalUrl,
        previewUrl: result.previewUrl,
        thumbnailUrl: result.thumbnailUrl,
      };
      emit(
        'update:modelValue',
        replaceIndex === undefined
          ? props.multiple
            ? [...props.modelValue, image]
            : [image]
          : props.modelValue.map((existing, index) =>
              index === replaceIndex ? image : existing,
            ),
      );
      await nextTick();
    } catch (error) {
      if (active && error instanceof Error) message.error(error.message);
    } finally {
      pending.value -= 1;
      if (active) emit('busy', pending.value > 0);
    }
  });
  return Upload.LIST_IGNORE;
}
const upload: UploadProps['beforeUpload'] = (file) => uploadImage(file);
function remove(index: number) {
  if (props.disabled || pending.value) return;
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== index),
  );
}
function move(index: number, offset: number) {
  if (props.disabled || pending.value) return;
  const target = index + offset;
  if (target < 0 || target >= props.modelValue.length) return;
  const images = [...props.modelValue];
  [images[index], images[target]] = [images[target]!, images[index]!];
  emit('update:modelValue', images);
}
onUnmounted(() => {
  active = false;
});
</script>

<template>
  <div class="flex flex-wrap items-start gap-3">
    <div v-if="modelValue.length" class="contents">
      <div
        v-for="(image, index) in modelValue"
        :key="index"
        class="flex w-[120px] flex-col items-center gap-2"
      >
        <ImageUploadItem
          :src="image.thumbnailUrl || image.previewUrl || image.originalUrl"
          :preview-src="image.previewUrl || image.originalUrl"
          :original-url="image.originalUrl"
          :alt="multiple ? `${imageLabel} ${index + 1}` : imageLabel"
          :disabled="disabled"
          :loading="pending > 0"
          removable
          replaceable
          :remove-label="
            multiple ? `移除${imageLabel} ${index + 1}` : `移除${imageLabel}`
          "
          :replace-label="
            multiple ? `替换${imageLabel} ${index + 1}` : `替换${imageLabel}`
          "
          :before-upload="(file) => uploadImage(file, index)"
          @remove="remove(index)"
        />
        <span class="text-muted-foreground text-xs">
          {{ multiple ? `${imageLabel} ${index + 1}` : imageLabel }}
        </span>
        <div class="flex gap-1">
          <template v-if="multiple && modelValue.length > 1">
            <Button
              size="small"
              :disabled="disabled || pending > 0 || index === 0"
              :aria-label="`前移${imageLabel} ${index + 1}`"
              @click="move(index, -1)"
            >
              ←
            </Button>
            <Button
              size="small"
              :disabled="
                disabled || pending > 0 || index === modelValue.length - 1
              "
              :aria-label="`后移${imageLabel} ${index + 1}`"
              @click="move(index, 1)"
            >
              →
            </Button>
          </template>
        </div>
      </div>
    </div>
    <Upload
      v-if="multiple || !modelValue.length"
      :before-upload="upload"
      :show-upload-list="false"
      :multiple="multiple"
      accept="image/*"
      :disabled="disabled || pending > 0"
    >
      <ImageUploadTrigger
        :loading="pending > 0"
        :disabled="disabled || pending > 0"
        :multiple="multiple"
        :label="`上传${imageLabel}`"
      />
    </Upload>
  </div>
</template>
