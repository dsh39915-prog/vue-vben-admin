<script setup lang="ts">
import type { UploadProps } from 'ant-design-vue';

import { ref } from 'vue';

import { ArrowLeftRight, CircleMinus, ZoomIn } from '@vben/icons';

import { Button, Popconfirm, Tooltip, Upload } from 'ant-design-vue';

import ImageThumbnail from './image-thumbnail.vue';

withDefaults(
  defineProps<{
    src: string;
    previewSrc?: string;
    originalUrl?: string;
    alt?: string;
    disabled?: boolean;
    loading?: boolean;
    removable?: boolean;
    replaceable?: boolean;
    removeLabel?: string;
    removeConfirm?: string;
    replaceLabel?: string;
    beforeUpload?: UploadProps['beforeUpload'];
  }>(),
  {
    previewSrc: undefined,
    originalUrl: undefined,
    alt: undefined,
    beforeUpload: undefined,
    removeLabel: '移除图片',
    removeConfirm: undefined,
    replaceLabel: '替换图片',
  },
);
const emit = defineEmits<{ remove: []; replace: [] }>();
const removeConfirmOpen = ref(false);
</script>

<template>
  <div class="image-upload-item relative size-[120px] shrink-0">
    <ImageThumbnail
      :src="src"
      :preview="{ src: previewSrc || originalUrl || src }"
      :alt="alt"
    />
    <Popconfirm
      v-if="removable && !disabled"
      v-model:open="removeConfirmOpen"
      :title="removeConfirm"
      :disabled="!removeConfirm || loading"
      @confirm="emit('remove')"
    >
      <Tooltip :title="removeLabel" :open="removeConfirmOpen ? false : undefined">
        <Button
          class="image-upload-action image-upload-action-remove absolute! right-1 top-1 z-10"
          size="small"
          shape="circle"
          type="text"
          danger
          :aria-label="removeLabel"
          :disabled="loading"
          @click="!removeConfirm && emit('remove')"
        >
          <template #icon><CircleMinus class="size-3.5" /></template>
        </Button>
      </Tooltip>
    </Popconfirm>
    <div class="absolute bottom-1 right-1 z-10 flex gap-1">
      <Tooltip v-if="originalUrl" title="查看原图">
        <Button
          class="image-upload-action"
          size="small"
          shape="circle"
          :href="originalUrl"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="查看原图"
        >
          <template #icon><ZoomIn class="size-3.5" /></template>
        </Button>
      </Tooltip>
      <Tooltip v-if="replaceable && !disabled" :title="replaceLabel">
        <Upload
          v-if="beforeUpload"
          data-image-action="replace"
          :before-upload="beforeUpload"
          :show-upload-list="false"
          accept="image/*"
          :disabled="loading"
        >
          <Button
            class="image-upload-action"
            size="small"
            shape="circle"
            :loading="loading"
            :aria-label="replaceLabel"
          >
            <template #icon><ArrowLeftRight class="size-3.5" /></template>
          </Button>
        </Upload>
        <Button
          v-else
          class="image-upload-action"
          size="small"
          shape="circle"
          :loading="loading"
          :aria-label="replaceLabel"
          @click="emit('replace')"
        >
          <template #icon><ArrowLeftRight class="size-3.5" /></template>
        </Button>
      </Tooltip>
    </div>
  </div>
</template>

<style scoped>
.image-upload-action.ant-btn {
  display: inline-flex;
  width: 24px;
  min-width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: hsl(var(--background));
  line-height: 1;
}

.image-upload-action :deep(svg) {
  display: block;
  flex-shrink: 0;
}

.image-upload-action :deep(.ant-btn-loading-icon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.image-upload-action-remove.ant-btn {
  border: 0;
  box-shadow: none;
}
</style>
