<script setup lang="ts">
import { Image } from 'ant-design-vue';

defineOptions({ inheritAttrs: false });
</script>

<template>
  <span class="image-thumbnail">
    <Image v-bind="$attrs" width="100%" height="100%" />
  </span>
</template>

<style scoped>
.image-thumbnail {
  box-sizing: border-box;
  display: inline-flex;
  width: 120px;
  height: 120px;
  flex: 0 0 120px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--muted) / 35%);
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
  vertical-align: top;
}

.image-thumbnail :deep(.ant-image) {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.image-thumbnail :deep(.ant-image-img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
