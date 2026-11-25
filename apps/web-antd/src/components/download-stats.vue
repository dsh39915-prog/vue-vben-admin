<script setup lang="ts">
defineProps<{
  base?: null | number;
  count?: null | number;
}>();
</script>

<template>
  <span class="inline-flex whitespace-nowrap">
    <span>{{ count ?? '—' }}</span>
    <span class="text-red-500">({{ base ?? '—' }})</span>
  </span>
</template>
