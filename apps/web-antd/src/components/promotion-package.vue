<script setup lang="ts">
import { optionLabel, packageOptions } from '#/views/app-info/data';

defineProps<{
  channel?: null | string;
  cooperation?: number | string;
  isRemd?: null | number;
}>();
</script>

<template>
  <span
    v-if="isRemd === 2"
    class="inline-flex items-center gap-1 whitespace-nowrap"
  >
    <span class="text-red-500">推广包</span>
    <span>{{ `[${channel?.trim() || '—'}] [${cooperation ?? '—'}]` }}</span>
  </span>
  <span v-else>
    {{ optionLabel(packageOptions, isRemd) }}
  </span>
</template>
