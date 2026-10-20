<script setup lang="ts">
import type { WorkflowImage } from '#/api';

import WorkflowImages from './workflow-images.vue';
const props = defineProps<{
  modelValue: (undefined | WorkflowImage)[];
  disabled?: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [(undefined | WorkflowImage)[]];
  busy: [number];
}>();
const labels = ['主图1', '主图2', '面料3', '主图4', '搭配5'];
function replace(index: number, values: WorkflowImage[]) {
  const slots = Array.from({ length: 5 }, (_, i) => props.modelValue[i]);
  slots[index] = values[0];
  emit('update:modelValue', slots);
}
</script>
<template>
  <div
    class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5"
  >
    <div
      v-for="(label, index) in labels"
      :key="label"
      class="flex min-w-0 flex-col gap-2 rounded border border-solid border-[hsl(var(--border))] p-3"
    >
      <strong><span class="text-red-500">* </span>{{ label }}</strong>
      <WorkflowImages
        :model-value="modelValue[index] ? [modelValue[index]!] : []"
        :disabled="disabled"
        @update:model-value="replace(index, $event)"
        @busy="emit('busy', $event)"
      />
    </div>
  </div>
</template>
