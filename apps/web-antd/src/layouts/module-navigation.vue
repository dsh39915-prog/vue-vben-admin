<script setup lang="ts">
import type { ModuleMenuGroup } from './module-menus';

import { Button } from 'ant-design-vue';

defineProps<{
  failed: boolean;
  groups: ModuleMenuGroup[];
  loading: boolean;
  selected?: null | number;
}>();
defineEmits<{ retry: []; select: [id: null | number] }>();
</script>

<template>
  <nav
    aria-label="模块导航"
    :aria-busy="loading"
    class="flex h-full min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1"
  >
    <button
      v-for="group in groups"
      :key="group.id ?? 'unassigned'"
      type="button"
      :title="group.name"
      :aria-pressed="selected === group.id"
      :class="
        selected === group.id
          ? 'border-primary text-primary bg-primary/5'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      "
      class="h-full max-w-72 shrink-0 truncate border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px]"
      @click="$emit('select', group.id)"
    >
      {{ group.name }}
    </button>
    <span v-if="loading && groups.length === 0">模块加载中…</span>
    <Button
      v-if="failed"
      type="link"
      size="small"
      class="shrink-0"
      @click="$emit('retry')"
    >
      重试模块
    </Button>
  </nav>
</template>
