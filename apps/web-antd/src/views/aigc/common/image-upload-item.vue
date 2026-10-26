<script setup lang="ts">
import type { UploadProps } from 'ant-design-vue';

import { ArrowLeftRight, CircleMinus, ZoomIn } from '@vben/icons';

import { Button, Tooltip, Upload } from 'ant-design-vue';

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
    replaceLabel?: string;
    beforeUpload?: UploadProps['beforeUpload'];
  }>(),
  {
    previewSrc: undefined,
    originalUrl: undefined,
    alt: undefined,
    beforeUpload: undefined,
    removeLabel: '移除图片',
    replaceLabel: '替换图片',
  },
);
const emit = defineEmits<{ remove: []; replace: [] }>();
</script>

<template>
  <div class="image-upload-item relative size-[120px] shrink-0">
    <ImageThumbnail
      :src="src"
      :preview="{ src: previewSrc || originalUrl || src }"
      :alt="alt"
    />
    <Tooltip v-if="removable && !disabled" :title="removeLabel">
      <Button
        class="absolute! right-1 top-1 z-10"
        size="small"
        shape="circle"
        danger
        :aria-label="removeLabel"
        :disabled="loading"
        @click="emit('remove')"
      >
        <template #icon><CircleMinus class="size-3.5" /></template>
      </Button>
    </Tooltip>
    <div class="absolute bottom-1 right-1 z-10 flex gap-1">
      <Tooltip v-if="originalUrl" title="查看原图">
        <Button
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
