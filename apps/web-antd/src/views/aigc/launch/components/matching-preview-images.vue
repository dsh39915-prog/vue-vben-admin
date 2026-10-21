<script setup lang="ts">
import type { WorkflowImage } from '#/api';

import { computed } from 'vue';

import { Image } from 'ant-design-vue';

import { imageUrl } from '../workflow-helpers';

const props = withDefaults(
  defineProps<{
    items: { image?: WorkflowImage; label: string }[];
    columns?: number;
  }>(),
  { columns: 3 },
);
const visibleItems = computed(() =>
  props.items.filter((item) => item.image && imageUrl(item.image)),
);
</script>

<template>
  <div
    class="preview-images flex w-full flex-wrap items-start gap-3"
    :style="{ maxWidth: `${columns * 120 + (columns - 1) * 12}px` }"
  >
    <figure
      v-for="(item, index) in visibleItems"
      :key="index"
      class="m-0 min-w-0 max-w-full"
      :style="{ width: '120px' }"
    >
      <Image
        v-if="item.image"
        :src="imageUrl(item.image)"
        :preview="{ src: item.image.previewUrl || item.image.originalUrl }"
        :alt="item.label"
        width="100%"
        height="auto"
        class="rounded object-contain"
      />
    </figure>
  </div>
</template>
