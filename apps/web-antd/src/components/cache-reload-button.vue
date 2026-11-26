<script setup lang="ts">
import type { MobileCacheType } from '#/api';

import { ref } from 'vue';

import { Button, message } from 'ant-design-vue';

import { reloadMobileCacheApi } from '#/api';

const props = defineProps<{
  cacheType: MobileCacheType;
  disabled?: boolean;
  label: string;
  size?: 'large' | 'middle' | 'small';
}>();
const loading = ref(false);

async function reload() {
  if (loading.value || props.disabled) return;
  const { cacheType, label } = props;
  loading.value = true;
  try {
    await reloadMobileCacheApi(cacheType);
    message.success(`${label}缓存刷新成功`);
  } catch {
    // 请求拦截器展示失败原因，允许重新点击重试。
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <Button
    :loading="loading"
    :disabled="disabled || loading"
    :size="size"
    :title="`刷新${label}缓存`"
    @click="reload"
  >
    刷新缓存
  </Button>
</template>
