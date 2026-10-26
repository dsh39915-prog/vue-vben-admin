<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { message } from 'ant-design-vue';

import ImageUploadItem from './image-upload-item.vue';
import ImageUploadTrigger from './image-upload-trigger.vue';

const props = withDefaults(
  defineProps<{
    modelValue?: File;
    disabled?: boolean;
    label?: string;
  }>(),
  { label: '图片', modelValue: undefined },
);
const emit = defineEmits<{ 'update:modelValue': [File | undefined] }>();
const input = ref<HTMLInputElement>();
const previewUrl = ref('');
const dragging = ref(false);
const fileSize = computed(() => {
  const size = props.modelValue?.size ?? 0;
  return size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
});
function releasePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
}
watch(
  () => props.modelValue,
  (file) => {
    releasePreview();
    if (file) previewUrl.value = URL.createObjectURL(file);
  },
  { immediate: true },
);
onBeforeUnmount(releasePreview);
function choose(file?: File) {
  if (props.disabled || !file) return;
  if (!file.type.startsWith('image/') || !file.size) {
    message.warning('请选择非空的图片文件');
    return;
  }
  emit('update:modelValue', file);
}
function change(event: Event) {
  const target = event.target as HTMLInputElement;
  choose(target.files?.[0]);
  target.value = '';
}
function drop(event: DragEvent) {
  dragging.value = false;
  if (event.dataTransfer?.files.length !== 1) {
    if (!props.disabled) message.warning('请每次选择一张图片');
    return;
  }
  choose(event.dataTransfer.files[0]);
}
</script>

<template>
  <div
    class="image-file-picker flex min-w-0 flex-col items-start gap-2"
    :class="{ 'is-dragging': dragging && !disabled, 'is-disabled': disabled }"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="drop"
  >
    <input
      ref="input"
      type="file"
      accept="image/*"
      style="display: none"
      aria-hidden="true"
      :tabindex="-1"
      :aria-label="`选择${label}`"
      :disabled="disabled"
      @change="change"
    />
    <ImageUploadTrigger
      v-if="!modelValue"
      :disabled="disabled"
      :label="`选择${label}`"
      @click="input?.click()"
    />
    <div v-else class="flex w-full min-w-0 flex-col gap-2">
      <div class="image-file-picker-preview">
        <ImageUploadItem
          :src="previewUrl"
          :original-url="previewUrl"
          :alt="modelValue.name"
          :disabled="disabled"
          removable
          replaceable
          @replace="input?.click()"
          @remove="emit('update:modelValue', undefined)"
        />
      </div>
      <div class="flex min-w-0 items-center gap-3">
        <span
          class="min-w-0 flex-1 truncate text-sm"
          :title="modelValue.name"
          >{{ modelValue.name }}</span>
        <span class="text-muted-foreground shrink-0 text-xs">{{
          fileSize
        }}</span>
      </div>
    </div>
    <span class="text-muted-foreground text-xs">
      {{ modelValue ? '点击图片查看大图' : '可拖拽图片至此处，选择后可预览' }}
    </span>
  </div>
</template>

<style scoped>
.image-file-picker {
  max-width: 100%;
}
.image-file-picker.is-dragging {
  border-radius: 10px;
  background: hsl(var(--primary) / 5%);
  outline: 1px dashed hsl(var(--primary));
}
</style>
