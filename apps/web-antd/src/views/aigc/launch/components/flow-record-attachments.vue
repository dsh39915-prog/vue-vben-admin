<script setup lang="ts">
import type { FlowTransferRecord } from '#/api';

import { computed } from 'vue';

import { Alert, Image } from 'ant-design-vue';

import ImageUploadItem from '../../common/image-upload-item.vue';
import { decodeImages, imageUrl } from '../workflow-helpers';

const props = defineProps<{
  value?: FlowTransferRecord['imageUrls'];
  showEmpty?: boolean;
  indented?: boolean;
}>();
const attachments = computed(() => {
  const raw = props.value;
  try {
    if (!raw || raw === 'null' || (typeof raw === 'string' && !raw.trim()))
      return { images: [], failed: false };
    const list: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (list === null) return { images: [], failed: false };
    if (!Array.isArray(list)) throw new Error('Invalid attachments');
    const images = list.flatMap((item) => decodeImages(item));
    if (images.some((image) => !imageUrl(image, true)))
      throw new Error('Invalid attachment URL');
    return { images, failed: false };
  } catch {
    return { images: [], failed: true };
  }
});
</script>

<template>
  <Alert
    v-if="attachments.failed"
    type="warning"
    message="图片附件数据格式不正确，暂无法展示，请刷新记录后重试"
    show-icon
  />
  <Image.PreviewGroup v-else-if="attachments.images.length">
    <div
      class="flex flex-wrap gap-3"
      :class="{ 'mt-3 pl-[70px] max-sm:pl-0': indented }"
      aria-label="图片附件"
    >
      <ImageUploadItem
        v-for="(image, index) in attachments.images"
        :key="`${image.originalUrl}:${index}`"
        :src="imageUrl(image)"
        :preview-src="image.previewUrl || image.originalUrl"
        :original-url="imageUrl(image, true)"
        :alt="`图片附件 ${index + 1}`"
      />
    </div>
  </Image.PreviewGroup>
  <p v-else-if="showEmpty" class="mb-0 text-muted-foreground">暂无图片附件</p>
</template>
