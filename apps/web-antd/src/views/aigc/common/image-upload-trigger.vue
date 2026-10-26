<script setup lang="ts">
import { Button } from 'ant-design-vue';

withDefaults(
  defineProps<{
    label?: string;
    disabled?: boolean;
    loading?: boolean;
    multiple?: boolean;
  }>(),
  { label: '选择图片' },
);
</script>

<template>
  <Button
    class="image-upload-trigger"
    :aria-label="label"
    :disabled="disabled"
    :loading="loading"
  >
    <span class="image-upload-trigger-content">
      <span>{{ label }}</span>
      <span class="text-muted-foreground text-xs font-normal">
        {{ multiple ? '可选择多张图片' : '点击选择图片' }}
      </span>
    </span>
  </Button>
</template>

<style scoped>
.image-upload-trigger {
  display: inline-flex;
  width: 120px;
  max-width: 100%;
  height: 120px;
  min-height: 120px;
  align-items: center;
  justify-content: center;
  padding: 16px 10px;
  border-style: dashed;
  border-radius: 10px;
  background: hsl(var(--muted) / 35%);
  white-space: normal;
}

.image-upload-trigger > .image-upload-trigger-content {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
</style>
