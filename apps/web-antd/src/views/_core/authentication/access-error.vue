<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Button, Result, Space } from 'ant-design-vue';

import { useAuthStore } from '#/store';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const loading = ref(false);
async function retry() {
  if (loading.value) return;
  loading.value = true;
  let target = '/';
  try {
    const redirect = route.query.redirect;
    let path = '';
    try {
      path = typeof redirect === 'string' ? decodeURIComponent(redirect) : '';
    } catch {
      // 损坏的回跳参数使用默认首页。
    }
    if (
      path.startsWith('/') &&
      !path.startsWith('//') &&
      path.split(/[?#]/, 1)[0] !== '/auth/access-error'
    )
      target = path;
    await router.replace(target);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <Result
    status="warning"
    title="页面加载失败"
    sub-title="暂时无法加载账号和菜单信息，请检查网络后重试。"
  >
    <template #extra>
      <Space>
        <Button type="primary" :loading="loading" @click="retry">
          重新加载
        </Button>
        <Button :disabled="loading" @click="auth.logout(false, false)">
          重新登录
        </Button>
      </Space>
    </template>
  </Result>
</template>
