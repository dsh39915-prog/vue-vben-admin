<script setup lang="ts">
import type { UploadProps } from 'ant-design-vue';

import type { WorkflowImage } from '#/api';

import { nextTick, onUnmounted, ref } from 'vue';

import { Button, Image, message, Upload } from 'ant-design-vue';

import { uploadWorkflowImageApi } from '#/api';

const props = defineProps<{
  modelValue: WorkflowImage[];
  disabled?: boolean;
  multiple?: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [WorkflowImage[]];
  busy: [boolean];
}>();
const pending = ref(0);
let active = true;
let queue = Promise.resolve();

const upload: UploadProps['beforeUpload'] = (file) => {
  if (props.disabled) return Upload.LIST_IGNORE;
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
        props.multiple ? [...props.modelValue, image] : [image],
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
};
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
  <div class="rounded-lg border border-dashed border-[hsl(var(--border))] p-4">
    <div v-if="modelValue.length" class="mb-3 flex flex-wrap gap-3">
      <div
        v-for="(image, index) in modelValue"
        :key="index"
        class="flex w-32 flex-col items-center gap-2"
      >
        <Image
          :src="image.thumbnailUrl || image.previewUrl || image.originalUrl"
          :preview="{ src: image.previewUrl || image.originalUrl }"
          :width="120"
          :height="120"
          class="object-contain"
        />
        <span class="text-muted-foreground text-xs">
          {{ multiple ? `参考图 ${index + 1}` : '原图' }}
        </span>
        <div class="flex gap-1">
          <template v-if="multiple && modelValue.length > 1">
            <Button
              size="small"
              :disabled="disabled || pending > 0 || index === 0"
              :aria-label="`前移参考图 ${index + 1}`"
              @click="move(index, -1)"
            >
              ←
            </Button>
            <Button
              size="small"
              :disabled="
                disabled || pending > 0 || index === modelValue.length - 1
              "
              :aria-label="`后移参考图 ${index + 1}`"
              @click="move(index, 1)"
            >
              →
            </Button>
          </template>
          <Button
            size="small"
            danger
            :disabled="disabled || pending > 0"
            :aria-label="multiple ? `移除参考图 ${index + 1}` : '移除原图'"
            @click="remove(index)"
          >
            移除
          </Button>
        </div>
      </div>
    </div>
    <Upload
      :before-upload="upload"
      :show-upload-list="false"
      :multiple="multiple"
      accept="image/*"
      :disabled="disabled || pending > 0"
    >
      <Button :loading="pending > 0" :disabled="disabled || pending > 0">
        <span>{{
          multiple
            ? '上传参考图（可多选）'
            : modelValue.length
              ? '替换原图'
              : '上传原图'
        }}</span>
      </Button>
    </Upload>
  </div>
</template>
