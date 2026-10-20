<script setup lang="ts">
import type { LaunchTask } from '#/api';

import { computed } from 'vue';

import { Tag } from 'ant-design-vue';

import { optionLabel, overdueOptions } from '../helpers';
const props = defineProps<{
  task: Pick<
    LaunchTask,
    | 'dateOverdueDesc'
    | 'dateOverdueStatus'
    | 'flowStatus'
    | 'timeOverdueDesc'
    | 'timeOverdueStatus'
  >;
  kind: 'date' | 'time';
}>();
const status = computed(() =>
  props.kind === 'date'
    ? props.task.dateOverdueStatus
    : props.task.timeOverdueStatus,
);
const description = computed(() =>
  props.kind === 'date'
    ? props.task.dateOverdueDesc
    : props.task.timeOverdueDesc,
);
const hidden = computed(() => [0, 5].includes(props.task.flowStatus));
const label = computed(() => optionLabel(overdueOptions, status.value));
</script>
<template>
  <span v-if="hidden">-</span>
  <div v-else class="flex flex-col items-start gap-1">
    <Tag
      v-if="status !== undefined && status !== null"
      :color="status === 1 ? 'error' : 'default'"
    >
      {{ label }}
    </Tag>
    <span v-else-if="!description">-</span>
    <p
      v-if="description && description !== label"
      class="whitespace-pre-wrap text-sm"
    >
      {{ description }}
    </p>
  </div>
</template>
